/**
 * 浏览器内 demo authority service 模块。
 *
 * @remarks
 * 负责在不接真实后端时提供一份“像 authority 一样工作”的文档与运行反馈服务，
 * 供 worker demo、transport、session 与 runtime control 链路联调使用。
 */
import type {
  GraphDocument,
  GraphOperation,
  LeaferGraphGraphExecutionState,
  LeaferGraphNodeStateChangeReason,
  RuntimeFeedbackEvent
} from "leafergraph";
import type {
  EditorRemoteAuthorityOperationContext,
  EditorRemoteAuthorityOperationResult,
  EditorRemoteAuthorityReplaceDocumentContext,
  EditorRemoteAuthorityRuntimeControlRequest,
  EditorRemoteAuthorityRuntimeControlResult
} from "../session/graph_document_authority_client";
import type {
  EditorRemoteAuthorityDocumentService
} from "../session/graph_document_authority_service";

/** 浏览器内 authority demo service 的最小创建参数。 */
export interface CreateDemoRemoteAuthorityServiceOptions {
  /** 初始图文档；未提供时使用内置 demo 文档。 */
  initialDocument?: GraphDocument;
  /** authority 标识，用于反馈事件。 */
  authorityName?: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

type GraphNodeSnapshot = GraphDocument["nodes"][number];
type GraphLinkSnapshot = GraphDocument["links"][number];
interface DemoGraphPlayRun {
  runId: string;
  source: "graph-play" | "graph-step";
  startedAt: number;
  queue: string[];
  stepCount: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface ExecuteNodeChainOptions {
  rootNodeId: string;
  source: "node-play" | "graph-play" | "graph-step";
  runId?: string;
  startedAt: number;
  timerRuntime?: DemoTimerRuntimeContext;
}

interface ExecuteNodeChainResult {
  changed: boolean;
  additionalAdvancedNodeIds: string[];
}

interface DemoTimerRuntimeContext {
  registerTimer?: (input: {
    nodeId: string;
    source: "graph-play" | "graph-step";
    runId: string;
    startedAt: number;
    intervalMs: number;
    immediate: boolean;
  }) => void;
  timerTickNodeId?: string;
}

interface DemoActiveGraphTimer {
  timerKey: string;
  runId: string;
  nodeId: string;
  source: "graph-play" | "graph-step";
  startedAt: number;
  intervalMs: number;
  handle: ReturnType<typeof setTimeout>;
}

let demoGraphRunSeed = 1;
const SYSTEM_TIMER_NODE_TYPE = "system/timer";
const SYSTEM_TIMER_DEFAULT_INTERVAL_MS = 1000;

function createDefaultDemoDocument(): GraphDocument {
  return {
    documentId: "demo-worker-doc",
    revision: "1",
    appKind: "demo-worker",
    nodes: [
      {
        id: "node-1",
        type: "demo.worker",
        title: "Node 1",
        layout: {
          x: 0,
          y: 0,
          width: 240,
          height: 140
        },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [],
        widgets: [],
        data: {}
      },
      {
        id: "node-2",
        type: "demo.worker",
        title: "Node 2",
        layout: {
          x: 320,
          y: 0,
          width: 240,
          height: 140
        },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [],
        widgets: [],
        data: {}
      }
    ],
    links: [
      {
        id: "link-1",
        source: {
          nodeId: "node-1",
          slot: 0
        },
        target: {
          nodeId: "node-2",
          slot: 0
        }
      }
    ],
    meta: {}
  };
}

function nextRevision(
  revision: GraphDocument["revision"]
): GraphDocument["revision"] {
  if (typeof revision === "number") {
    return revision + 1;
  }

  const numericRevision = Number(revision);
  if (Number.isFinite(numericRevision)) {
    return String(numericRevision + 1);
  }

  return `${revision}#1`;
}

function isStructurallyEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

function createIdleGraphExecutionState(): LeaferGraphGraphExecutionState {
  return {
    status: "idle",
    queueSize: 0,
    stepCount: 0
  };
}

function cloneGraphExecutionState(
  state: LeaferGraphGraphExecutionState
): LeaferGraphGraphExecutionState {
  return { ...state };
}

function createGraphRunId(source: "graph-play" | "graph-step"): string {
  const runId = `graph:${source}:${Date.now()}:${demoGraphRunSeed}`;
  demoGraphRunSeed += 1;
  return runId;
}

function resolveTimerIntervalMs(value: unknown): number {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return SYSTEM_TIMER_DEFAULT_INTERVAL_MS;
  }

  return Math.max(1, Math.floor(nextValue));
}

function resolveTimerImmediate(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return true;
}

/**
 * 创建浏览器内可直接挂到 worker / iframe host 的 authority demo service。
 *
 * @remarks
 * 这层的职责是提供一个“真 authority 风格”的最小示例：
 * - 文档快照由 service 持有
 * - 图操作由 authority 确认并推进 revision
 * - 运行反馈通过统一 `RuntimeFeedbackEvent` 回流
 */
export function createDemoRemoteAuthorityService(
  options: CreateDemoRemoteAuthorityServiceOptions = {}
): EditorRemoteAuthorityDocumentService {
  const documentListeners = new Set<(document: GraphDocument) => void>();
  const runtimeFeedbackListeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();
  const nodeExecutionStateMap = new Map<
    string,
    NonNullable<Extract<RuntimeFeedbackEvent, { type: "node.execution" }>["event"]["state"]>
  >();
  const authorityName = options.authorityName ?? "demo-worker";
  let generatedNodeSequence = 0;
  let generatedLinkSequence = 0;
  let currentDocument = clone(
    options.initialDocument ?? createDefaultDemoDocument()
  );
  let graphExecutionState = createIdleGraphExecutionState();
  let activeGraphPlayRun: DemoGraphPlayRun | null = null;
  const activeGraphTimersByKey = new Map<string, DemoActiveGraphTimer>();
  let timerActivatedInCurrentGraphStepTick = false;
  let stepCursor = 0;

  const emitRuntimeFeedback = (event: RuntimeFeedbackEvent): void => {
    const snapshot = clone(event);
    for (const listener of runtimeFeedbackListeners) {
      listener(snapshot);
    }
  };

  const emitDocument = (): void => {
    const snapshot = clone(currentDocument);
    for (const listener of documentListeners) {
      listener(snapshot);
    }
  };

  const commitDocument = (nextDocument: GraphDocument): void => {
    currentDocument = nextDocument;
    emitDocument();
  };

  const hasNodeId = (nodeId: string): boolean =>
    currentDocument.nodes.some((node) => node.id === nodeId);
  const hasLinkId = (linkId: string): boolean =>
    currentDocument.links.some((link) => link.id === linkId);

  const createGraphTimerKey = (runId: string, nodeId: string): string =>
    `${runId}::${nodeId}`;

  const hasActiveGraphTimersForRun = (runId: string): boolean => {
    for (const timer of activeGraphTimersByKey.values()) {
      if (timer.runId === runId) {
        return true;
      }
    }

    return false;
  };

  const stopGraphTimerByKey = (timerKey: string): void => {
    const timer = activeGraphTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    clearTimeout(timer.handle);
    activeGraphTimersByKey.delete(timerKey);
  };

  const stopGraphTimersForRun = (runId: string): void => {
    for (const [timerKey, timer] of activeGraphTimersByKey.entries()) {
      if (timer.runId !== runId) {
        continue;
      }

      clearTimeout(timer.handle);
      activeGraphTimersByKey.delete(timerKey);
    }
  };

  const stopAllGraphTimersWithoutEvent = (): void => {
    for (const timer of activeGraphTimersByKey.values()) {
      clearTimeout(timer.handle);
    }
    activeGraphTimersByKey.clear();
  };

  const stopActiveGraphPlayWithoutEvent = (): void => {
    if (!activeGraphPlayRun) {
      return;
    }

    stopGraphTimersForRun(activeGraphPlayRun.runId);
    if (activeGraphPlayRun.timer !== null) {
      clearTimeout(activeGraphPlayRun.timer);
    }
    activeGraphPlayRun = null;
  };

  const resetDocumentCaches = (): void => {
    generatedNodeSequence = 0;
    generatedLinkSequence = 0;
    stopAllGraphTimersWithoutEvent();
    stopActiveGraphPlayWithoutEvent();
    nodeExecutionStateMap.clear();
    graphExecutionState = createIdleGraphExecutionState();
    stepCursor = 0;
  };

  const getNode = (nodeId: string) =>
    currentDocument.nodes.find((node) => node.id === nodeId) ?? null;

  const emitNodeState = (
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason,
    exists: boolean
  ): void => {
    emitRuntimeFeedback({
      type: "node.state",
      event: {
        nodeId,
        exists,
        reason,
        timestamp: Date.now()
      }
    });
  };

  const emitLinkPropagation = (
    link: GraphLinkSnapshot,
    source: string,
    chainId?: string
  ): void => {
    emitRuntimeFeedback({
      type: "link.propagation",
      event: {
        linkId: link.id,
        chainId: chainId ?? `${authorityName}:${link.id}:${Date.now()}`,
        sourceNodeId: link.source.nodeId,
        sourceSlot: link.source.slot ?? 0,
        targetNodeId: link.target.nodeId,
        targetSlot: link.target.slot ?? 0,
        payload: {
          authority: authorityName,
          source
        },
        timestamp: Date.now()
      }
    });
  };

  const emitGraphExecution = (
    type: "started" | "advanced" | "drained" | "stopped",
    input: {
      runId?: string;
      source?: "graph-play" | "graph-step";
      nodeId?: string;
      timestamp: number;
    }
  ): void => {
    emitRuntimeFeedback({
      type: "graph.execution",
      event: {
        type,
        state: cloneGraphExecutionState(graphExecutionState),
        runId: input.runId,
        source: input.source,
        nodeId: input.nodeId,
        timestamp: input.timestamp
      }
    });
  };

  const advanceNodeExecutionState = (
    nodeId: string,
    timestamp: number
  ): NonNullable<Extract<RuntimeFeedbackEvent, { type: "node.execution" }>["event"]["state"]> => {
    const previousState = nodeExecutionStateMap.get(nodeId) ?? {
      status: "idle",
      runCount: 0
    };
    const nextState = {
      status: "success",
      runCount: previousState.runCount + 1,
      lastExecutedAt: timestamp,
      lastSucceededAt: timestamp,
      lastFailedAt: previousState.lastFailedAt,
      lastErrorMessage: previousState.lastErrorMessage
    } as const;
    nodeExecutionStateMap.set(nodeId, nextState);
    return clone(nextState);
  };

  const emitNodeExecution = (
    rootNode: GraphNodeSnapshot,
    node: GraphNodeSnapshot,
    input: {
      source: "node-play" | "graph-play" | "graph-step";
      runId?: string;
      chainId: string;
      depth: number;
      sequence: number;
      trigger: "direct" | "propagated";
      startedAt: number;
      timestamp: number;
    }
  ): void => {
    emitRuntimeFeedback({
      type: "node.execution",
      event: {
        chainId: input.chainId,
        rootNodeId: rootNode.id,
        rootNodeType: rootNode.type,
        rootNodeTitle: rootNode.title ?? rootNode.id,
        nodeId: node.id,
        nodeType: node.type,
        nodeTitle: node.title ?? node.id,
        depth: input.depth,
        sequence: input.sequence,
        source: input.source,
        trigger: input.trigger,
        timestamp: input.timestamp,
        executionContext: {
          source: input.source,
          runId: input.runId,
          entryNodeId: rootNode.id,
          stepIndex: input.sequence,
          startedAt: input.startedAt,
          payload: {
            authority: authorityName
          }
        },
        state: advanceNodeExecutionState(node.id, input.timestamp)
      }
    });
    emitNodeState(node.id, "execution", true);
  };

  const patchDocumentRoot = (
    document: GraphDocument,
    input: Extract<GraphOperation, { type: "document.update" }>["input"]
  ): GraphDocument => ({
    ...document,
    appKind: input.appKind ?? document.appKind,
    meta: input.meta !== undefined ? clone(input.meta) : clone(document.meta),
    capabilityProfile:
      input.capabilityProfile !== undefined
        ? input.capabilityProfile === null
          ? undefined
          : clone(input.capabilityProfile)
        : clone(document.capabilityProfile),
    adapterBinding:
      input.adapterBinding !== undefined
        ? input.adapterBinding === null
          ? undefined
          : clone(input.adapterBinding)
        : clone(document.adapterBinding)
  });

  const resolveValidatedLinkEndpoint = (
    endpoint: GraphLinkSnapshot["source"],
    label: "source" | "target"
  ): { accepted: boolean; endpoint?: GraphLinkSnapshot["source"]; reason?: string } => {
    const nodeId = endpoint.nodeId?.trim();
    if (!nodeId) {
      return { accepted: false, reason: `${label} 节点不能为空` };
    }

    const slot = endpoint.slot ?? 0;
    if (!Number.isInteger(slot) || slot < 0) {
      return { accepted: false, reason: `${label} slot 必须是非负整数` };
    }

    const node = getNode(nodeId);
    if (!node) {
      return { accepted: false, reason: `${label} 节点不存在` };
    }

    const slots = (label === "source" ? node.outputs : node.inputs) ?? [];
    if (!slots[slot]) {
      return { accepted: false, reason: `${label} 端点不存在` };
    }

    return { accepted: true, endpoint: { nodeId, slot } };
  };

  const updateRunningGraphExecutionState = (run: DemoGraphPlayRun): void => {
    graphExecutionState = {
      status: "running",
      runId: run.runId,
      queueSize: run.queue.length,
      stepCount: run.stepCount,
      startedAt: run.startedAt,
      stoppedAt: undefined,
      lastSource: run.source
    };
  };

  const emitAdditionalGraphExecutionAdvances = (
    run: DemoGraphPlayRun,
    nodeIds: readonly string[]
  ): void => {
    for (const nodeId of nodeIds) {
      run.stepCount += 1;
      updateRunningGraphExecutionState(run);
      emitGraphExecution("advanced", {
        runId: run.runId,
        source: run.source,
        nodeId,
        timestamp: Date.now()
      });
    }
  };

  const registerGraphTimer = (input: {
    nodeId: string;
    source: "graph-play" | "graph-step";
    runId: string;
    startedAt: number;
    intervalMs: number;
    immediate: boolean;
  }): void => {
    /**
     * 图运行里的 timer 节点不会长期占用主执行队列。
     * 这里把它们拆成独立定时器，既能模拟真实 runtime 的持续触发，
     * 也能让 graph-play/graph-step 继续保持“离散推进”的状态机。
     */
    const hasActiveRun =
      activeGraphPlayRun?.runId === input.runId || graphExecutionState.runId === input.runId;
    if (!hasActiveRun) {
      return;
    }

    const timerKey = createGraphTimerKey(input.runId, input.nodeId);
    stopGraphTimerByKey(timerKey);
    const intervalMs = resolveTimerIntervalMs(input.intervalMs);
    const handle = setTimeout(() => {
      handleActiveGraphTimerTick(timerKey);
    }, intervalMs);

    activeGraphTimersByKey.set(timerKey, {
      timerKey,
      runId: input.runId,
      nodeId: input.nodeId,
      source: input.source,
      startedAt: input.startedAt,
      intervalMs,
      handle
    });
    timerActivatedInCurrentGraphStepTick = true;
  };

  const handleActiveGraphTimerTick = (timerKey: string): void => {
    const timer = activeGraphTimersByKey.get(timerKey);
    if (!timer) {
      return;
    }

    const run = activeGraphPlayRun;
    if (!run || run.runId !== timer.runId || run.source !== timer.source) {
      stopGraphTimerByKey(timerKey);
      return;
    }

    timer.handle = setTimeout(() => {
      handleActiveGraphTimerTick(timerKey);
    }, timer.intervalMs);
    activeGraphTimersByKey.set(timerKey, timer);

    const executionResult = executeNodeChain({
      rootNodeId: timer.nodeId,
      source: timer.source,
      runId: timer.runId,
      startedAt: timer.startedAt,
      timerRuntime: {
        registerTimer: registerGraphTimer,
        timerTickNodeId: timer.nodeId
      }
    });

    if (!executionResult.changed) {
      stopGraphTimerByKey(timerKey);
      return;
    }

    if (activeGraphPlayRun?.runId === timer.runId) {
      activeGraphPlayRun.stepCount += 1;
      updateRunningGraphExecutionState(activeGraphPlayRun);
      emitGraphExecution("advanced", {
        runId: timer.runId,
        source: timer.source,
        nodeId: timer.nodeId,
        timestamp: Date.now()
      });
      emitAdditionalGraphExecutionAdvances(
        activeGraphPlayRun,
        executionResult.additionalAdvancedNodeIds
      );
    }
  };

  const executeNodeChain = (input: ExecuteNodeChainOptions): ExecuteNodeChainResult => {
    /**
     * 这里故意用 DFS 风格递归推进节点链，而不是做复杂调度器：
     * demo service 的目标是稳定产出 authority 风格反馈事件，
     * 不是复刻完整 runtime 内核。
     */
    const rootNode = getNode(input.rootNodeId);
    if (!rootNode) {
      return {
        changed: false,
        additionalAdvancedNodeIds: []
      };
    }

    const chainId = `${authorityName}:${input.source}:${rootNode.id}:${input.startedAt}`;
    const visited = new Set<string>();
    const additionalAdvancedNodeIds: string[] = [];
    let sequence = 0;
    const walk = (
      nodeId: string,
      depth: number,
      trigger: "direct" | "propagated"
    ): void => {
      if (visited.has(nodeId)) {
        return;
      }

      const node = getNode(nodeId);
      if (!node) {
        return;
      }

      visited.add(nodeId);
      const currentSequence = sequence;
      sequence += 1;
      emitNodeExecution(rootNode, node, {
        source: input.source,
        runId: input.runId,
        chainId,
        depth,
        sequence: currentSequence,
        trigger,
        startedAt: input.startedAt,
        timestamp: Date.now()
      });

      if (node.type === SYSTEM_TIMER_NODE_TYPE) {
        const intervalMs = resolveTimerIntervalMs(node.properties?.intervalMs);
        const immediate = resolveTimerImmediate(node.properties?.immediate);
        const isGraphSource =
          input.source === "graph-play" || input.source === "graph-step";
        const canRegisterTimer =
          isGraphSource &&
          Boolean(input.runId) &&
          Boolean(input.timerRuntime?.registerTimer);
        const isPeriodicTick = input.timerRuntime?.timerTickNodeId === node.id;

        if (canRegisterTimer) {
          input.timerRuntime?.registerTimer?.({
            nodeId: node.id,
            source: input.source as "graph-play" | "graph-step",
            runId: input.runId!,
            startedAt: input.startedAt,
            intervalMs,
            immediate
          });
        }

        const shouldPropagate =
          input.source === "node-play" ||
          isPeriodicTick ||
          immediate ||
          !canRegisterTimer;
        if (!shouldPropagate) {
          return;
        }

        if (node.id !== rootNode.id) {
          additionalAdvancedNodeIds.push(node.id);
        }
      }

      for (const link of currentDocument.links) {
        if (link.source.nodeId !== nodeId || !getNode(link.target.nodeId)) {
          continue;
        }

        emitLinkPropagation(link, input.source, chainId);
        walk(link.target.nodeId, depth + 1, "propagated");
      }
    };

    walk(rootNode.id, 0, "direct");
    return {
      changed: true,
      additionalAdvancedNodeIds
    };
  };

  const finalizeGraphPlayRun = (
    run: DemoGraphPlayRun,
    type: "drained" | "stopped"
  ): void => {
    if (activeGraphPlayRun?.runId !== run.runId) {
      return;
    }

    stopGraphTimersForRun(run.runId);
    if (run.timer !== null) {
      clearTimeout(run.timer);
    }
    activeGraphPlayRun = null;
    const timestamp = Date.now();
    graphExecutionState = {
      status: "idle",
      queueSize: 0,
      stepCount: run.stepCount,
      startedAt: run.startedAt,
      stoppedAt: timestamp,
      lastSource: run.source
    };
    emitGraphExecution(type, {
      runId: run.runId,
      source: run.source,
      timestamp
    });
  };

  const scheduleNextGraphPlayRunTick = (): void => {
    const run = activeGraphPlayRun;
    if (!run) {
      return;
    }

    run.timer = setTimeout(() => {
      const activeRun = activeGraphPlayRun;
      if (!activeRun || activeRun.runId !== run.runId) {
        return;
      }

      const rootNodeId = activeRun.queue.shift();
      if (!rootNodeId) {
        if (!hasActiveGraphTimersForRun(activeRun.runId)) {
          finalizeGraphPlayRun(activeRun, "drained");
        } else {
          updateRunningGraphExecutionState(activeRun);
        }
        return;
      }

      const executionResult = executeNodeChain({
        rootNodeId,
        source: activeRun.source,
        runId: activeRun.runId,
        startedAt: activeRun.startedAt,
        timerRuntime: {
          registerTimer: registerGraphTimer
        }
      });
      activeRun.stepCount += 1;

      const timestamp = Date.now();
      const hasMore =
        activeRun.queue.length > 0 || hasActiveGraphTimersForRun(activeRun.runId);
      graphExecutionState = {
        status: hasMore ? "running" : "idle",
        runId: hasMore ? activeRun.runId : undefined,
        queueSize: activeRun.queue.length,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: hasMore ? undefined : timestamp,
        lastSource: activeRun.source
      };
      emitGraphExecution("advanced", {
        runId: activeRun.runId,
        source: activeRun.source,
        nodeId: rootNodeId,
        timestamp
      });
      emitAdditionalGraphExecutionAdvances(
        activeRun,
        executionResult.additionalAdvancedNodeIds
      );

      if (activeRun.queue.length > 0) {
        scheduleNextGraphPlayRunTick();
        return;
      }

      if (!hasActiveGraphTimersForRun(activeRun.runId)) {
        finalizeGraphPlayRun(activeRun, "drained");
      }
    }, 0);
  };

  const collectRootNodeIds = (): string[] =>
    currentDocument.nodes
      .map((node) => node.id)
      .filter((nodeId) => Boolean(getNode(nodeId)));

  const createRuntimeControlResult = (
    overrides: Partial<EditorRemoteAuthorityRuntimeControlResult>
  ): EditorRemoteAuthorityRuntimeControlResult => ({
    accepted: true,
    changed: false,
    state: cloneGraphExecutionState(graphExecutionState),
    ...overrides
  });

  const nextNodeId = (): string => {
    do {
      generatedNodeSequence += 1;
    } while (hasNodeId(`${authorityName}-node-${generatedNodeSequence}`));

    return `${authorityName}-node-${generatedNodeSequence}`;
  };

  const nextLinkId = (): string => {
    do {
      generatedLinkSequence += 1;
    } while (hasLinkId(`${authorityName}-link-${generatedLinkSequence}`));

    return `${authorityName}-link-${generatedLinkSequence}`;
  };

  const toNodeSlotSpecs = (
    slots?: Extract<GraphOperation, { type: "node.create" }>["input"]["inputs"]
  ): GraphNodeSnapshot["inputs"] => {
    if (!slots) {
      return undefined;
    }

    return slots.map((slot) =>
      typeof slot === "string"
        ? {
            name: slot
          }
        : clone(slot)
    );
  };

  const createNodeFromInput = (
    input: Extract<GraphOperation, { type: "node.create" }>["input"]
  ): GraphNodeSnapshot => {
    return {
      id: input.id ?? nextNodeId(),
      type: input.type,
      title: input.title ?? input.type,
      layout: {
        x: input.x,
        y: input.y,
        width: input.width ?? 240,
        height: input.height ?? 140
      },
      flags: clone(input.flags ?? {}),
      properties: clone(input.properties ?? {}),
      propertySpecs: clone(input.propertySpecs ?? []),
      inputs: toNodeSlotSpecs(input.inputs) ?? [],
      outputs: toNodeSlotSpecs(input.outputs) ?? [],
      widgets: clone(input.widgets ?? []),
      data: clone(input.data ?? {})
    };
  };

  const createLinkFromInput = (
    input: Extract<GraphOperation, { type: "link.create" }>["input"]
  ): GraphLinkSnapshot => {
    return {
      id: input.id ?? nextLinkId(),
      source: {
        nodeId: input.source.nodeId,
        slot: input.source.slot
      },
      target: {
        nodeId: input.target.nodeId,
        slot: input.target.slot
      },
      label: input.label,
      data: input.data ? clone(input.data) : undefined
    };
  };

  const createCurrentSnapshotResult = (
    overrides: Partial<{
      accepted: boolean;
      changed: boolean;
      reason?: string;
    }>
  ): EditorRemoteAuthorityOperationResult => ({
    accepted: true,
    changed: false,
    revision: currentDocument.revision,
    document: clone(currentDocument),
    ...overrides
  });

  const applyOperation = (operation: GraphOperation) => {
    /**
     * demo authority 对 GraphOperation 的处理保持“最小可解释”：
     * - 明确给出 accepted / changed / reason
     * - 所有成功写入都会推进 revision
     * - 需要时同步发出 node.state / graph.execution 反馈
     */
    switch (operation.type) {
      case "document.update": {
        const nextDocument = patchDocumentRoot(currentDocument, operation.input);
        if (isStructurallyEqual(currentDocument, nextDocument)) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...nextDocument,
          revision: nextRevision(currentDocument.revision)
        });
        return createCurrentSnapshotResult({ changed: true });
      }
      case "node.create": {
        const nextNode = createNodeFromInput(operation.input);
        const previousNode = getNode(nextNode.id);
        if (previousNode && isStructurallyEqual(previousNode, nextNode)) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          nodes: [...currentDocument.nodes.filter((node) => node.id !== nextNode.id), nextNode]
        });
        emitNodeState(nextNode.id, "created", true);
        return createCurrentSnapshotResult({ changed: true });
      }
      case "node.update": {
        const node = getNode(operation.nodeId);
        if (!node) {
          return createCurrentSnapshotResult({ accepted: false, reason: "节点不存在" });
        }

        const nextNode: GraphNodeSnapshot = {
          ...node,
          title: operation.input.title ?? node.title,
          layout: {
            ...node.layout,
            x: operation.input.x ?? node.layout.x,
            y: operation.input.y ?? node.layout.y,
            width: operation.input.width ?? node.layout.width,
            height: operation.input.height ?? node.layout.height
          },
          properties:
            operation.input.properties !== undefined
              ? clone(operation.input.properties)
              : node.properties,
          propertySpecs:
            operation.input.propertySpecs !== undefined
              ? clone(operation.input.propertySpecs)
              : node.propertySpecs,
          inputs:
            operation.input.inputs !== undefined
              ? toNodeSlotSpecs(operation.input.inputs)
              : node.inputs,
          outputs:
            operation.input.outputs !== undefined
              ? toNodeSlotSpecs(operation.input.outputs)
              : node.outputs,
          widgets:
            operation.input.widgets !== undefined ? clone(operation.input.widgets) : node.widgets,
          data: operation.input.data !== undefined ? clone(operation.input.data) : node.data,
          flags:
            operation.input.flags !== undefined
              ? { ...node.flags, ...clone(operation.input.flags) }
              : node.flags
        };
        if (isStructurallyEqual(node, nextNode)) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          nodes: currentDocument.nodes.map((item) =>
            item.id === operation.nodeId ? nextNode : item
          )
        });
        emitNodeState(operation.nodeId, "updated", true);
        return createCurrentSnapshotResult({ changed: true });
      }
      case "node.move": {
        const node = getNode(operation.nodeId);
        if (!node) {
          return createCurrentSnapshotResult({ accepted: false, reason: "节点不存在" });
        }
        if (node.layout.x === operation.input.x && node.layout.y === operation.input.y) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          nodes: currentDocument.nodes.map((item) =>
            item.id === operation.nodeId
              ? {
                  ...item,
                  layout: {
                    ...item.layout,
                    x: operation.input.x,
                    y: operation.input.y
                  }
                }
              : item
          )
        });
        emitNodeState(operation.nodeId, "moved", true);
        return createCurrentSnapshotResult({ changed: true });
      }
      case "node.resize": {
        const node = getNode(operation.nodeId);
        if (!node) {
          return createCurrentSnapshotResult({ accepted: false, reason: "节点不存在" });
        }
        if (
          node.layout.width === operation.input.width &&
          node.layout.height === operation.input.height
        ) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          nodes: currentDocument.nodes.map((item) =>
            item.id === operation.nodeId
              ? {
                  ...item,
                  layout: {
                    ...item.layout,
                    width: operation.input.width,
                    height: operation.input.height
                  }
                }
              : item
          )
        });
        emitNodeState(operation.nodeId, "resized", true);
        return createCurrentSnapshotResult({ changed: true });
      }
      case "node.remove": {
        const node = getNode(operation.nodeId);
        if (!node) {
          return createCurrentSnapshotResult({ reason: "节点不存在" });
        }

        const affectedNodeIds = new Set<string>();
        for (const link of currentDocument.links) {
          if (link.source.nodeId === operation.nodeId && link.target.nodeId !== operation.nodeId) {
            affectedNodeIds.add(link.target.nodeId);
          }
          if (link.target.nodeId === operation.nodeId && link.source.nodeId !== operation.nodeId) {
            affectedNodeIds.add(link.source.nodeId);
          }
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          nodes: currentDocument.nodes.filter((nodeItem) => nodeItem.id !== operation.nodeId),
          links: currentDocument.links.filter(
            (link) =>
              link.source.nodeId !== operation.nodeId &&
              link.target.nodeId !== operation.nodeId
          )
        });
        nodeExecutionStateMap.delete(operation.nodeId);
        emitNodeState(operation.nodeId, "removed", false);
        for (const nodeId of affectedNodeIds) {
          if (getNode(nodeId)) {
            emitNodeState(nodeId, "connections", true);
          }
        }
        return createCurrentSnapshotResult({ changed: true });
      }
      case "link.create": {
        const sourceResolution = resolveValidatedLinkEndpoint(operation.input.source, "source");
        if (!sourceResolution.accepted) {
          return createCurrentSnapshotResult({ accepted: false, reason: sourceResolution.reason });
        }
        const targetResolution = resolveValidatedLinkEndpoint(operation.input.target, "target");
        if (!targetResolution.accepted) {
          return createCurrentSnapshotResult({ accepted: false, reason: targetResolution.reason });
        }

        const nextLink = createLinkFromInput({
          ...operation.input,
          source: sourceResolution.endpoint!,
          target: targetResolution.endpoint!
        });
        const previousLink = currentDocument.links.find((link) => link.id === nextLink.id);
        if (previousLink && isStructurallyEqual(previousLink, nextLink)) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          links: [...currentDocument.links.filter((link) => link.id !== nextLink.id), nextLink]
        });
        emitNodeState(nextLink.source.nodeId, "connections", true);
        emitNodeState(nextLink.target.nodeId, "connections", true);
        return createCurrentSnapshotResult({ changed: true });
      }
      case "link.remove": {
        const link = currentDocument.links.find((item) => item.id === operation.linkId);
        if (!link) {
          return createCurrentSnapshotResult({ reason: "连线不存在" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          links: currentDocument.links.filter((item) => item.id !== operation.linkId)
        });
        emitNodeState(link.source.nodeId, "connections", true);
        emitNodeState(link.target.nodeId, "connections", true);
        return createCurrentSnapshotResult({ changed: true });
      }
      case "link.reconnect": {
        const link = currentDocument.links.find((item) => item.id === operation.linkId);
        if (!link) {
          return createCurrentSnapshotResult({ accepted: false, reason: "连线不存在" });
        }

        const sourceResolution = operation.input.source
          ? resolveValidatedLinkEndpoint(operation.input.source, "source")
          : { accepted: true as const, endpoint: link.source };
        if (!sourceResolution.accepted) {
          return createCurrentSnapshotResult({ accepted: false, reason: sourceResolution.reason });
        }
        const targetResolution = operation.input.target
          ? resolveValidatedLinkEndpoint(operation.input.target, "target")
          : { accepted: true as const, endpoint: link.target };
        if (!targetResolution.accepted) {
          return createCurrentSnapshotResult({ accepted: false, reason: targetResolution.reason });
        }

        const nextLink: GraphLinkSnapshot = {
          ...link,
          source: sourceResolution.endpoint!,
          target: targetResolution.endpoint!
        };
        if (isStructurallyEqual(link, nextLink)) {
          return createCurrentSnapshotResult({ reason: "文档无变化" });
        }

        commitDocument({
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          links: currentDocument.links.map((item) =>
            item.id === operation.linkId ? nextLink : item
          )
        });
        for (const nodeId of new Set([
          link.source.nodeId,
          link.target.nodeId,
          nextLink.source.nodeId,
          nextLink.target.nodeId
        ])) {
          if (getNode(nodeId)) {
            emitNodeState(nodeId, "connections", true);
          }
        }
        return createCurrentSnapshotResult({ changed: true });
      }
    }
  };

  return {
    async getDocument(): Promise<GraphDocument> {
      return clone(currentDocument);
    },

    async submitOperation(
      operation: GraphOperation,
      _context: EditorRemoteAuthorityOperationContext
    ) {
      return applyOperation(operation);
    },

    async controlRuntime(
      request: EditorRemoteAuthorityRuntimeControlRequest
    ): Promise<EditorRemoteAuthorityRuntimeControlResult> {
      switch (request.type) {
        case "node.play": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({
              accepted: false,
              reason: "图级运行中，无法从单节点开始运行"
            });
          }

          const executionResult = executeNodeChain({
            rootNodeId: request.nodeId,
            source: "node-play",
            startedAt: Date.now()
          });
          return createRuntimeControlResult({
            accepted: executionResult.changed,
            changed: executionResult.changed,
            reason: executionResult.changed ? undefined : "节点不存在"
          });
        }
        case "graph.play": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({ reason: "图已在运行中" });
          }

          const queue = collectRootNodeIds();
          if (!queue.length) {
            return createRuntimeControlResult({ reason: "图中没有可执行节点" });
          }

          const startedAt = Date.now();
          const runId = createGraphRunId("graph-play");
          activeGraphPlayRun = {
            runId,
            source: "graph-play",
            startedAt,
            queue,
            stepCount: 0,
            timer: null
          };
          graphExecutionState = {
            status: "running",
            runId,
            queueSize: queue.length,
            stepCount: 0,
            startedAt,
            lastSource: "graph-play"
          };
          stepCursor = 0;
          emitGraphExecution("started", {
            runId,
            source: "graph-play",
            timestamp: startedAt
          });
          scheduleNextGraphPlayRunTick();
          return createRuntimeControlResult({ changed: true });
        }
        case "graph.step": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({
              accepted: false,
              reason: "图级运行中，无法单步推进"
            });
          }

          const rootNodeIds = collectRootNodeIds();
          if (!rootNodeIds.length) {
            return createRuntimeControlResult({ reason: "图中没有可执行节点" });
          }

          if (stepCursor >= rootNodeIds.length) {
            stepCursor = 0;
          }
          const rootNodeId = rootNodeIds[stepCursor];
          stepCursor = (stepCursor + 1) % rootNodeIds.length;
          const startedAt = Date.now();
          const runId = createGraphRunId("graph-step");
          graphExecutionState = {
            status: "stepping",
            runId,
            queueSize: 1,
            stepCount: 0,
            startedAt,
            lastSource: "graph-step"
          };
          emitGraphExecution("started", {
            runId,
            source: "graph-step",
            timestamp: startedAt
          });

          timerActivatedInCurrentGraphStepTick = false;
          const executionResult = executeNodeChain({
            rootNodeId,
            source: "graph-step",
            runId,
            startedAt,
            timerRuntime: {
              registerTimer: registerGraphTimer
            }
          });
          const timestamp = Date.now();
          emitGraphExecution("advanced", {
            runId,
            source: "graph-step",
            nodeId: rootNodeId,
            timestamp
          });

          const promotedToRunning =
            timerActivatedInCurrentGraphStepTick && hasActiveGraphTimersForRun(runId);
          if (promotedToRunning) {
            activeGraphPlayRun = {
              runId,
              source: "graph-step",
              startedAt,
              queue: [],
              stepCount: executionResult.changed ? 1 : 0,
              timer: null
            };
            updateRunningGraphExecutionState(activeGraphPlayRun);
            return createRuntimeControlResult({
              changed: executionResult.changed,
              reason: executionResult.changed ? undefined : "节点不存在"
            });
          }

          graphExecutionState = {
            status: "idle",
            queueSize: 0,
            stepCount: executionResult.changed ? 1 : 0,
            startedAt,
            stoppedAt: timestamp,
            lastSource: "graph-step"
          };
          emitGraphExecution("drained", {
            runId,
            source: "graph-step",
            timestamp: Date.now()
          });
          return createRuntimeControlResult({
            changed: executionResult.changed,
            reason: executionResult.changed ? undefined : "节点不存在"
          });
        }
        case "graph.stop": {
          if (!activeGraphPlayRun) {
            return createRuntimeControlResult({ reason: "当前没有活动中的图运行" });
          }

          finalizeGraphPlayRun(activeGraphPlayRun, "stopped");
          return createRuntimeControlResult({ changed: true });
        }
      }
    },

    async replaceDocument(
      document: GraphDocument,
      _context: EditorRemoteAuthorityReplaceDocumentContext
    ): Promise<GraphDocument> {
      currentDocument = clone(document);
      resetDocumentCaches();
      emitDocument();
      return clone(currentDocument);
    },

    subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
      runtimeFeedbackListeners.add(listener);
      return () => {
        runtimeFeedbackListeners.delete(listener);
      };
    },

    subscribeDocument(listener: (document: GraphDocument) => void): () => void {
      documentListeners.add(listener);
      return () => {
        documentListeners.delete(listener);
      };
    }
  };
}
