import { leaferGraphBasicKitPlugin } from "@leafergraph/core/basic-kit";
import type { GraphLink, NodeRuntimeState } from "@leafergraph/core/node";
import type { LeaferGraphLinkPropagationAnimationPreset } from "@leafergraph/core/theme";
import {
  createLeaferGraph,
  type LeaferGraph
} from "leafergraph";

import {
  EXAMPLE_EVENT_RELAY_NODE_TYPE,
  EXAMPLE_TICK_MONITOR_NODE_TYPE,
  miniGraphExampleDemoPlugin
} from "./example_demo_plugin";
import { createEmptyExampleDocument } from "./example_document";
import type { LeaferGraphOptions } from "@leafergraph/core/contracts";

const SYSTEM_ON_PLAY_NODE_TYPE = "system/on-play";
const SYSTEM_TIMER_NODE_TYPE = "system/timer";
const DEFAULT_DIAGNOSTIC_INTERVAL_MS = 25;
const DEFAULT_DIAGNOSTIC_LOG_LIMIT = 60;
const DIAGNOSTIC_CHAIN_NODE_GAP_X = 360;
const DEFAULT_FIT_VIEW_PADDING = 120;

export type DiagnosticStatus =
  | "idle"
  | "bootstrapping"
  | "ready"
  | "playing"
  | "stopped"
  | "resetting"
  | "destroyed"
  | "error";

export interface DiagnosticControllerLogEntry {
  readonly id: number;
  readonly timestamp: number;
  readonly message: string;
}

export interface DiagnosticControllerState {
  readonly status: DiagnosticStatus;
  readonly intervalMs: number;
  readonly nodeCount: number;
  readonly linkCount: number;
  readonly runCount: number;
  readonly hasDiagnosticChain: boolean;
  readonly lastError: string | null;
  readonly logs: readonly DiagnosticControllerLogEntry[];
}

export interface MiniGraphDiagnosticController {
  bootstrap(container: HTMLElement): Promise<void>;
  getState(): DiagnosticControllerState;
  subscribeState(listener: (state: DiagnosticControllerState) => void): () => void;
  setIntervalMs(value: number): void;
  createDiagnosticChain(): void;
  play(): boolean;
  stop(): boolean;
  reset(): void;
  fit(): void;
  destroy(): void;
}

export interface MiniGraphDiagnosticControllerOptions {
  readonly maxLogs?: number;
  readonly exposeDebug?: boolean;
  readonly now?: () => number;
  readonly linkPropagationAnimation?: LeaferGraphLinkPropagationAnimationPreset | false;
  readonly respectReducedMotion?: boolean;
  readonly graphFactory?: (
    container: HTMLElement,
    options: LeaferGraphOptions
  ) => LeaferGraph;
}

interface MutableDiagnosticState {
  status: DiagnosticStatus;
  intervalMs: number;
  nodeCount: number;
  linkCount: number;
  runCount: number;
  hasDiagnosticChain: boolean;
  lastError: string | null;
  logs: DiagnosticControllerLogEntry[];
}

interface DiagnosticChainIds {
  readonly startNodeId: string;
  readonly timerNodeId: string;
  readonly relayNodeId: string;
  readonly monitorNodeId: string;
  readonly linkIds: readonly string[];
}

class DiagnosticControllerDestroyedError extends Error {
  constructor(message = "mini-graph 诊断控制器已销毁") {
    super(message);
    this.name = "DiagnosticControllerDestroyedError";
  }
}

export function createMiniGraphDiagnosticController(
  options: MiniGraphDiagnosticControllerOptions = {}
): MiniGraphDiagnosticController {
  const maxLogs = Math.max(1, Math.floor(options.maxLogs ?? DEFAULT_DIAGNOSTIC_LOG_LIMIT));
  const now = options.now ?? (() => Date.now());
  const graphFactory = options.graphFactory ?? createLeaferGraph;
  const listeners = new Set<(state: DiagnosticControllerState) => void>();
  const cleanupCallbacks = new Set<() => void>();
  let graph: LeaferGraph | null = null;
  let bootstrapPromise: Promise<void> | null = null;
  let destroyRequested = false;
  let logSeed = 1;
  let chainIds: DiagnosticChainIds | null = null;

  const state: MutableDiagnosticState = {
    status: "idle",
    intervalMs: DEFAULT_DIAGNOSTIC_INTERVAL_MS,
    nodeCount: 0,
    linkCount: 0,
    runCount: 0,
    hasDiagnosticChain: false,
    lastError: null,
    logs: []
  };

  function snapshot(): DiagnosticControllerState {
    return {
      status: state.status,
      intervalMs: state.intervalMs,
      nodeCount: state.nodeCount,
      linkCount: state.linkCount,
      runCount: state.runCount,
      hasDiagnosticChain: state.hasDiagnosticChain,
      lastError: state.lastError,
      logs: state.logs.map((entry) => ({ ...entry }))
    };
  }

  function emit(): void {
    const currentSnapshot = snapshot();
    for (const listener of [...listeners]) {
      listener(currentSnapshot);
    }
  }

  function appendLog(message: string): void {
    state.logs = [
      {
        id: logSeed,
        timestamp: now(),
        message
      },
      ...state.logs
    ].slice(0, maxLogs);
    logSeed += 1;
    emit();
  }

  function refreshGraphCounts(): void {
    const document = graph?.getGraphDocument();
    state.nodeCount = document?.nodes.length ?? 0;
    state.linkCount = document?.links.length ?? 0;
    state.hasDiagnosticChain = Boolean(chainIds);
  }

  function clearTrackedChain(): void {
    chainIds = null;
    refreshGraphCounts();
  }

  function ensureUsableGraph(): LeaferGraph | null {
    if (destroyRequested || state.status === "destroyed") {
      return null;
    }

    return graph;
  }

  function stopInternal(): boolean {
    const currentGraph = graph;
    if (!currentGraph) {
      return false;
    }

    try {
      return currentGraph.stop();
    } catch {
      return false;
    }
  }

  function cleanupGraph(): void {
    // 停止图执行引擎，防止清理期间触发新事件
    if (graph) {
      try {
        graph.stop();
      } catch {
        // stop() 失败不影响后续清理
      }
    }

    for (const cleanup of [...cleanupCallbacks]) {
      cleanupCallbacks.delete(cleanup);
      try {
        cleanup();
      } catch {
        // 清理阶段不重新抛出，避免掩盖后续资源释放。
      }
    }

    if (graph) {
      try {
        graph.destroy();
      } catch {
        // 销毁图实例时继续尽力清理本地引用。
      }
    }

    graph = null;
    chainIds = null;
    state.nodeCount = 0;
    state.linkCount = 0;
    state.hasDiagnosticChain = false;
  }

  function bootstrap(container: HTMLElement): Promise<void> {
    if (state.status === "destroyed" || destroyRequested) {
      return Promise.reject(new DiagnosticControllerDestroyedError());
    }

    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    if (graph && ["ready", "playing", "stopped"].includes(state.status)) {
      return Promise.resolve();
    }

    state.status = "bootstrapping";
    state.lastError = null;
    emit();

    bootstrapPromise = (async () => {
      try {
        const nextGraph = graphFactory(container, {
          document: createEmptyExampleDocument(),
          plugins: [leaferGraphBasicKitPlugin, miniGraphExampleDemoPlugin],
          config: {
            graph: {
              runtime: {
                linkPropagationAnimation: options.linkPropagationAnimation ?? "expressive",
                respectReducedMotion: options.respectReducedMotion ?? false
              }
            }
          }
        });

        graph = nextGraph;
        await nextGraph.ready;

        if (destroyRequested) {
          cleanupGraph();
          throw new DiagnosticControllerDestroyedError("mini-graph 诊断控制器在初始化期间被销毁");
        }

        const unsubscribeNodeState = nextGraph.subscribeNodeState(() => {
          refreshGraphCounts();
          emit();
        });
        cleanupCallbacks.add(unsubscribeNodeState);
        refreshGraphCounts();
        state.status = "ready";
        state.lastError = null;
        appendLog("诊断图实例已就绪");
      } catch (error) {
        if (destroyRequested) {
          cleanupGraph();
          state.status = "destroyed";
          emit();
          throw error instanceof Error ? error : new Error("诊断图初始化已取消");
        }

        const message = error instanceof Error ? error.message : "诊断图初始化失败";
        state.status = "error";
        state.lastError = message;
        emit();
        throw error instanceof Error ? error : new Error(message);
      } finally {
        bootstrapPromise = null;
      }
    })();

    return bootstrapPromise;
  }

  function setIntervalMs(value: number): void {
    if (state.status === "destroyed") {
      return;
    }

    const nextInterval = Math.max(1, Math.floor(value));
    state.intervalMs = nextInterval;

    if (graph && chainIds) {
      graph.setNodeWidgetValue(chainIds.timerNodeId, 0, nextInterval);
    }

    appendLog(`诊断链间隔已设置为 ${nextInterval}ms`);
  }

  function createDiagnosticChain(): void {
    const currentGraph = ensureUsableGraph();
    if (!currentGraph || state.status === "bootstrapping") {
      return;
    }

    if (chainIds) {
      appendLog("诊断链已存在，跳过重复创建");
      return;
    }

    const origin = { x: 120, y: 120 };
    const startNode = currentGraph.createNode({
      type: SYSTEM_ON_PLAY_NODE_TYPE,
      x: origin.x,
      y: origin.y
    });
    const timerNode = currentGraph.createNode({
      type: SYSTEM_TIMER_NODE_TYPE,
      x: origin.x + DIAGNOSTIC_CHAIN_NODE_GAP_X,
      y: origin.y
    });
    const relayNode = currentGraph.createNode({
      type: EXAMPLE_EVENT_RELAY_NODE_TYPE,
      x: origin.x + DIAGNOSTIC_CHAIN_NODE_GAP_X * 2,
      y: origin.y
    });
    const monitorNode = currentGraph.createNode({
      type: EXAMPLE_TICK_MONITOR_NODE_TYPE,
      x: origin.x + DIAGNOSTIC_CHAIN_NODE_GAP_X * 3,
      y: origin.y
    });

    currentGraph.setNodeWidgetValue(timerNode.id, 0, state.intervalMs);

    const links: GraphLink[] = [
      currentGraph.createLink({
        source: { nodeId: startNode.id, slot: 0 },
        target: { nodeId: timerNode.id, slot: 0 }
      }),
      currentGraph.createLink({
        source: { nodeId: timerNode.id, slot: 0 },
        target: { nodeId: relayNode.id, slot: 0 }
      }),
      currentGraph.createLink({
        source: { nodeId: relayNode.id, slot: 0 },
        target: { nodeId: monitorNode.id, slot: 0 }
      })
    ];

    chainIds = {
      startNodeId: startNode.id,
      timerNodeId: timerNode.id,
      relayNodeId: relayNode.id,
      monitorNodeId: monitorNode.id,
      linkIds: links.map((link) => link.id)
    };

    currentGraph.setSelectedNodeIds(
      [startNode, timerNode, relayNode, monitorNode].map((node: NodeRuntimeState) => node.id),
      "replace"
    );
    refreshGraphCounts();
    currentGraph.fitView(DEFAULT_FIT_VIEW_PADDING);
    appendLog("已创建诊断动画链：Start Event -> Timer -> Event Relay -> Tick Monitor");
  }

  function play(): boolean {
    const currentGraph = ensureUsableGraph();
    if (!currentGraph || !chainIds || state.status === "playing") {
      return false;
    }

    const changed = currentGraph.play();
    if (changed) {
      state.status = "playing";
      state.runCount += 1;
      appendLog("诊断图已开始播放");
    }
    return changed;
  }

  function stop(): boolean {
    if (state.status === "destroyed") {
      return false;
    }

    const changed = stopInternal();
    if (changed || state.status === "playing") {
      state.status = "stopped";
      appendLog(changed ? "诊断图已停止" : "诊断图状态已标记为停止");
      return true;
    }
    return false;
  }

  function reset(): void {
    if (state.status === "destroyed") {
      return;
    }

    const currentGraph = graph;
    state.status = "resetting";
    emit();
    stopInternal();
    if (currentGraph) {
      currentGraph.replaceGraphDocument(createEmptyExampleDocument());
    }
    clearTrackedChain();
    state.status = currentGraph ? "ready" : "idle";
    appendLog("诊断图已重置为空文档");
  }

  function fit(): void {
    if (state.status === "destroyed") {
      return;
    }

    graph?.fitView(DEFAULT_FIT_VIEW_PADDING);
  }

  function destroy(): void {
    if (state.status === "destroyed") {
      return;
    }

    destroyRequested = true;
    stopInternal();
    cleanupGraph();
    state.status = "destroyed";
    state.lastError = null;
    emit();
    listeners.clear();
  }

  return {
    bootstrap,
    getState: snapshot,
    subscribeState(listener) {
      if (state.status === "destroyed") {
        listener(snapshot());
        return () => {};
      }

      listeners.add(listener);
      listener(snapshot());
      let subscribed = true;
      return () => {
        if (!subscribed) {
          return;
        }
        subscribed = false;
        listeners.delete(listener);
      };
    },
    setIntervalMs,
    createDiagnosticChain,
    play,
    stop,
    reset,
    fit,
    destroy
  };
}

