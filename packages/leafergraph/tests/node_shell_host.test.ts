import { afterEach, describe, expect, test } from "bun:test";

import { NodeRegistry, type NodeRuntimeState } from "@leafergraph/core/node";
import type { LeaferGraphNodeExecutionState } from "@leafergraph/core/contracts";
import { LeaferGraphWidgetRegistry } from "@leafergraph/core/widget-runtime";
import {
  NODE_SHELL_LAYOUT_METRICS,
  createDefaultNodeShellStyleConfig,
  resolveDefaultNodeShellRenderTheme,
  resolveDefaultSelectedStroke
} from "../src/graph/style";
import { LeaferGraphNodeShellHost } from "../src/node/shell/host";
import type { NodeViewState } from "../src/node/node_host";

const originalMatchMedia = window.matchMedia;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

function createMatchMedia(matches: boolean): typeof window.matchMedia {
  return ((query: string) =>
    ({
      media: query,
      matches,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return true;
      }
    }) as MediaQueryList) as typeof window.matchMedia;
}

function installRequestAnimationFrameStub(): void {
  let nextFrameId = 1;
  const pendingFrames = new Map<number, FrameRequestCallback>();

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const frameId = nextFrameId++;
    pendingFrames.set(frameId, callback);
    return frameId;
  }) as typeof window.requestAnimationFrame;

  window.cancelAnimationFrame = ((frameId: number) => {
    pendingFrames.delete(frameId);
  }) as typeof window.cancelAnimationFrame;
}

function createNodeState(id: string, type: string): NodeRuntimeState {
  return {
    id,
    type,
    title: id,
    layout: {
      x: 24,
      y: 32,
      width: 180,
      height: 96
    },
    properties: {},
    propertySpecs: [],
    inputs: [{ name: "in", label: "In", type: "number" }],
    outputs: [{ name: "out", label: "Out", type: "number" }],
    widgets: [],
    flags: {
      selected: false,
      collapsed: false
    },
    inputValues: [],
    outputValues: [],
    data: {}
  };
}

function createHarness(options?: {
  respectReducedMotion?: boolean;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const widgetRegistry = new LeaferGraphWidgetRegistry((() => {}) as never);
  const nodeRegistry = new NodeRegistry(widgetRegistry);
  nodeRegistry.registerNode({
    type: "demo/basic",
    title: "Basic",
    category: "Testing",
    size: [180, 96],
    inputs: [{ name: "in", label: "In", type: "number" }],
    outputs: [{ name: "out", label: "Out", type: "number" }]
  });
  nodeRegistry.registerNode({
    type: "demo/task",
    title: "Task",
    category: "Testing",
    size: [180, 96],
    inputs: [{ name: "in", label: "In", type: "number" }],
    outputs: [{ name: "out", label: "Out", type: "number" }],
    shell: {
      longTask: true
    }
  });

  const executionStates = new Map<string, LeaferGraphNodeExecutionState>();
  const nodeViews = new Map<string, NodeViewState<NodeRuntimeState>>();
  let requestRenderCount = 0;
  let renderFrameCount = 0;

  const host = new LeaferGraphNodeShellHost<NodeRuntimeState>({
    container,
    nodeViews,
    nodeRegistry,
    layoutMetrics: NODE_SHELL_LAYOUT_METRICS,
    style: createDefaultNodeShellStyleConfig(),
    getThemeMode: () => "light",
    resolveSelectedStroke: (mode) => resolveDefaultSelectedStroke(mode),
    resolveRenderTheme: (mode) => resolveDefaultNodeShellRenderTheme(mode),
    resolveNodeExecutionState: (nodeId) => executionStates.get(nodeId),
    canResizeNode: () => true,
    isNodeResizing: () => false,
    requestRender: () => {
      requestRenderCount += 1;
    },
    renderFrame: () => {
      renderFrameCount += 1;
    },
    respectReducedMotion: options?.respectReducedMotion ?? true
  });

  function mountNode(node: NodeRuntimeState): NodeViewState<NodeRuntimeState> {
    const shellView = host.buildNodeShell(node);
    const state: NodeViewState<NodeRuntimeState> = {
      state: node,
      view: shellView.view,
      card: shellView.card,
      selectedRing: shellView.selectedRing,
      widgetLayer: shellView.widgetLayer,
      resizeHandle: shellView.resizeHandle,
      shellView,
      widgetInstances: [],
      hovered: false
    };
    nodeViews.set(node.id, state);
    return state;
  }

  return {
    host,
    nodeViews,
    executionStates,
    mountNode,
    getRenderCounts() {
      return {
        requestRenderCount,
        renderFrameCount
      };
    }
  };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
  document.body.innerHTML = "";
});

describe("node_shell_host", () => {
  test("selected 只点亮 selected ring", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, mountNode } = createHarness();
    const node = createNodeState("selected-node", "demo/basic");
    node.flags.selected = true;
    const state = mountNode(node);

    host.applyNodeShellStatusStyles(state);

    expect((state.selectedRing as unknown as { selected?: boolean }).selected).toBe(
      true
    );
    expect(state.shellView.progressRing?.visible).toBe(false);
    expect(state.shellView.signalActivityDot?.visible).toBe(false);
  });

  test("running + longTask + no progress 会显示 indeterminate progress ring", () => {
    window.matchMedia = createMatchMedia(false);
    installRequestAnimationFrameStub();

    const { host, mountNode, executionStates } = createHarness();
    const node = createNodeState("long-task", "demo/task");
    const state = mountNode(node);
    executionStates.set(node.id, {
      status: "running",
      runCount: 1,
      lastExecutedAt: 10
    });

    host.applyNodeShellStatusStyles(state);

    const internals = host as unknown as {
      activeIndeterminateNodeIds: Set<string>;
      frameId: number | null;
    };
    expect(state.shellView.progressTrack?.visible).toBe(true);
    expect(state.shellView.progressRing?.visible).toBe(true);
    expect(state.shellView.progressRing?.path).not.toBe("");
    expect(state.shellView.signalActivityDot?.visible).toBe(true);
    expect(internals.activeIndeterminateNodeIds.has(node.id)).toBe(true);
    expect(internals.frameId).not.toBeNull();
  });

  test("indeterminate progress ring 每次进入 running 都从固定起点开始", () => {
    window.matchMedia = createMatchMedia(false);
    installRequestAnimationFrameStub();

    const { host, mountNode, executionStates } = createHarness();
    const node = createNodeState("fixed-start", "demo/task");
    const state = mountNode(node);
    const internals = host as unknown as {
      now(): number;
    };

    internals.now = () => 1000;
    executionStates.set(node.id, {
      status: "running",
      runCount: 1,
      lastExecutedAt: 10
    });
    host.applyNodeShellStatusStyles(state);
    const firstPath = state.shellView.progressRing?.path ?? "";

    executionStates.set(node.id, {
      status: "success",
      runCount: 1,
      lastSucceededAt: 20
    });
    host.applyNodeShellStatusStyles(state);

    internals.now = () => 4500;
    executionStates.set(node.id, {
      status: "running",
      runCount: 2,
      lastExecutedAt: 30
    });
    host.applyNodeShellStatusStyles(state);
    const secondPath = state.shellView.progressRing?.path ?? "";

    expect(firstPath).not.toBe("");
    expect(secondPath).toBe(firstPath);
  });

  test("running + longTask + progress=0.5 会显示 determinate 50% 进度", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, mountNode, executionStates } = createHarness();
    const node = createNodeState("determinate-task", "demo/task");
    const state = mountNode(node);
    executionStates.set(node.id, {
      status: "running",
      runCount: 2,
      lastExecutedAt: 12,
      progress: 0.5
    });

    host.applyNodeShellStatusStyles(state);

    const internals = host as unknown as {
      activeIndeterminateNodeIds: Set<string>;
    };
    expect(state.shellView.progressRing?.visible).toBe(true);
    expect(state.shellView.progressRing?.path).not.toBe("");
    expect(state.shellView.progressRing?.path).not.toBe(
      state.shellView.progressTrack?.path
    );
    expect(internals.activeIndeterminateNodeIds.size).toBe(0);
  });

  test("running + 非 longTask + no progress 不显示 progress ring", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, mountNode, executionStates } = createHarness();
    const node = createNodeState("basic-running", "demo/basic");
    const state = mountNode(node);
    executionStates.set(node.id, {
      status: "running",
      runCount: 1,
      lastExecutedAt: 16
    });

    host.applyNodeShellStatusStyles(state);

    expect(state.shellView.progressTrack?.visible).toBe(false);
    expect(state.shellView.progressRing?.visible).toBe(false);
    expect(state.shellView.signalActivityDot?.visible).toBe(false);
  });

  test("success / error / idle 会清除 progress ring", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, mountNode, executionStates } = createHarness();
    const node = createNodeState("clear-progress", "demo/task");
    const state = mountNode(node);
    executionStates.set(node.id, {
      status: "running",
      runCount: 1,
      progress: 0.8
    });
    host.applyNodeShellStatusStyles(state);

    executionStates.set(node.id, {
      status: "success",
      runCount: 1,
      lastSucceededAt: 20
    });
    host.applyNodeShellStatusStyles(state);

    expect(state.shellView.progressTrack?.visible).toBe(false);
    expect(state.shellView.progressRing?.visible).toBe(false);
    expect(state.shellView.progressRing?.path).toBe("");
  });

  test("selected + progress 可以同时存在", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, mountNode, executionStates } = createHarness();
    const node = createNodeState("selected-progress", "demo/task");
    node.flags.selected = true;
    const state = mountNode(node);
    executionStates.set(node.id, {
      status: "running",
      runCount: 3,
      progress: 0.25
    });

    host.applyNodeShellStatusStyles(state);

    expect((state.selectedRing as unknown as { selected?: boolean }).selected).toBe(
      true
    );
    expect(state.shellView.progressRing?.visible).toBe(true);
    expect(state.shellView.progressRing?.path).not.toBe("");
  });

  test("reduced motion 下 indeterminate ring 会退化为静态片段", () => {
    window.matchMedia = createMatchMedia(true);
    installRequestAnimationFrameStub();

    const { host, mountNode, executionStates } = createHarness({
      respectReducedMotion: true
    });
    const node = createNodeState("reduced-motion", "demo/task");
    const state = mountNode(node);
    executionStates.set(node.id, {
      status: "running",
      runCount: 1
    });

    host.applyNodeShellStatusStyles(state);

    const internals = host as unknown as {
      activeIndeterminateNodeIds: Set<string>;
      frameId: number | null;
    };
    expect(state.shellView.progressRing?.visible).toBe(true);
    expect(state.shellView.progressRing?.path).not.toBe("");
    expect(internals.activeIndeterminateNodeIds.size).toBe(0);
    expect(internals.frameId).toBeNull();
  });

  test("collapsed 会在 signal cluster 上展示 badge", () => {
    window.matchMedia = createMatchMedia(false);

    const { host, mountNode } = createHarness();
    const node = createNodeState("collapsed-node", "demo/basic");
    node.flags.collapsed = true;
    const state = mountNode(node);

    host.applyNodeShellStatusStyles(state);

    expect(state.shellView.signalBadge?.visible).toBe(true);
    expect(state.shellView.signalBadgeLabel?.text).toBe("C");
  });

  test("missing node 会展示 unavailable badge 并禁用 progress ring", () => {
    window.matchMedia = createMatchMedia(false);

    const { mountNode } = createHarness();
    const node = createNodeState("missing-node", "demo/missing");
    const state = mountNode(node);

    expect(state.shellView.signalBadge?.visible).toBe(true);
    expect(state.shellView.signalBadgeLabel?.text).toBe("!");
    expect(state.shellView.progressRing).toBeNull();
    expect(state.shellView.signalButton.visible).toBe(false);
  });
});
