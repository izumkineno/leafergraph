import { describe, expect, test } from "bun:test";

import type { Group } from "leafer-ui";
import { LeaferGraphInteractionHost } from "../src/interaction/interaction_host";
import type { LeaferGraphInteractiveNodeViewState } from "../src/interaction/interaction_host";
import type { LeaferGraphConnectionPortState } from "@leafergraph/contracts";

class FakeEventSource {
  name?: string;
  parent: FakeEventSource | null = null;
  private readonly handlers = new Map<string, Array<(event: any) => void>>();

  constructor(name?: string) {
    this.name = name;
  }

  on(eventName: string, handler: (event: any) => void): void {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
  }

  emit(eventName: string, event: any): void {
    const handlers = this.handlers.get(eventName) ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }
}

type TestNodeState = {
  id: string;
  type: string;
  title: string;
  properties: Record<string, unknown>;
  propertySpecs: unknown[];
  inputs: unknown[];
  outputs: unknown[];
  widgets: unknown[];
  inputValues: unknown[];
  outputValues: unknown[];
  flags: {
    collapsed?: boolean;
  };
  data: Record<string, unknown>;
  layout: {
    x: number;
    y: number;
  };
};

type TestNodeViewState = LeaferGraphInteractiveNodeViewState<TestNodeState>;

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", {
    configurable: true,
    value: 1200
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 800
  });
  document.body.appendChild(container);
  return container;
}

function createTestNodeViewState(options: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inputCenterX?: number;
  outputCenterX?: number;
}): TestNodeViewState {
  const resizeHandle = new FakeEventSource(`node-resize-handle-${options.id}`);
  const signalButton = new FakeEventSource(`node-signal-button-${options.id}`);
  const inputHit = new FakeEventSource(`node-port-hit-${options.id}-input`);
  const outputHit = new FakeEventSource(`node-port-hit-${options.id}-output`);
  const titleHitArea = new FakeEventSource(`node-title-hit-${options.id}`);

  return {
    state: {
      id: options.id,
      type: "test/node",
      title: options.id,
      properties: {},
      propertySpecs: [],
      inputs: [],
      outputs: [],
      widgets: [],
      inputValues: [],
      outputValues: [],
      flags: {},
      data: {},
      layout: {
        x: options.x,
        y: options.y
      }
    },
    view: new FakeEventSource(`node-view-${options.id}`) as unknown as Group,
    resizeHandle,
    shellView: {
      signalButton,
      titleHitArea,
      portViews: [
        {
          layout: {
            direction: "input",
            index: 0,
            portX: (options.inputCenterX ?? 0) - 8,
            portY: options.height / 2 - 8,
            portWidth: 16,
            portHeight: 16
          },
          highlight: {},
          hitArea: inputHit as any
        },
        {
          layout: {
            direction: "output",
            index: 0,
            portX: (options.outputCenterX ?? options.width) - 8,
            portY: options.height / 2 - 8,
            portWidth: 16,
            portHeight: 16
          },
          highlight: {},
          hitArea: outputHit as any
        }
      ]
    } as any,
    hovered: false
  };
}

function createGraphPointerEvent(options: {
  target?: any;
  x: number;
  y: number;
  shiftKey?: boolean;
  right?: boolean;
  middle?: boolean;
}): any {
  return {
    target: options.target ?? null,
    right: Boolean(options.right),
    middle: Boolean(options.middle),
    origin: {
      shiftKey: Boolean(options.shiftKey)
    },
    shiftKey: Boolean(options.shiftKey),
    pagePoint: {
      x: options.x,
      y: options.y
    },
    stopNow() {},
    stop() {}
  };
}

function createPointerEventLike(x: number, y: number): PointerEvent {
  return {
    clientX: x,
    clientY: y,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    shiftKey: false
  } as PointerEvent;
}

function createInteractionHarness() {
  const container = createContainer();
  const commits: any[] = [];
  const previewCalls: Array<{
    source: LeaferGraphConnectionPortState;
    pointer: { x: number; y: number };
    target?: LeaferGraphConnectionPortState;
  }> = [];
  let clearSelectedCount = 0;
  const selectedNodeIds = new Set<string>();
  const nodeSizes = new Map<string, { width: number; height: number }>();
  const nodeViews = new Map<string, TestNodeViewState>();
  const syncResizeCalls: string[] = [];
  const titleEditRequests: string[] = [];

  const sourceNode = createTestNodeViewState({
    id: "source-node",
    x: 20,
    y: 30,
    width: 160,
    height: 80,
    outputCenterX: 160
  });
  const targetNode = createTestNodeViewState({
    id: "target-node",
    x: 320,
    y: 40,
    width: 160,
    height: 80,
    inputCenterX: 0
  });
  nodeViews.set(sourceNode.state.id, sourceNode);
  nodeViews.set(targetNode.state.id, targetNode);
  nodeSizes.set(sourceNode.state.id, { width: 160, height: 80 });
  nodeSizes.set(targetNode.state.id, { width: 160, height: 80 });

  const resolvePort = (
    nodeId: string,
    direction: "input" | "output",
    slot: number
  ): LeaferGraphConnectionPortState | undefined => {
    if (slot !== 0) {
      return undefined;
    }

    const state = nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    const size = nodeSizes.get(nodeId) ?? { width: 160, height: 80 };
    const centerX =
      direction === "input"
        ? state.state.layout.x
        : state.state.layout.x + size.width;
    const centerY = state.state.layout.y + size.height / 2;

    return {
      nodeId,
      direction,
      slot,
      center: {
        x: centerX,
        y: centerY
      },
      hitBounds: {
        x: centerX - 8,
        y: centerY - 8,
        width: 16,
        height: 16
      }
    };
  };

  const runtime = {
    getNodeView: (nodeId: string) => nodeViews.get(nodeId),
    setNodeHovered: (nodeId: string, hovered: boolean) => {
      const node = nodeViews.get(nodeId);
      if (node) {
        node.hovered = hovered;
      }
    },
    focusNode: () => true,
    syncNodeResizeHandleVisibility: (nodeId: string) => {
      syncResizeCalls.push(nodeId);
    },
    resolvePort,
    resolvePortAtPoint: (
      point: { x: number; y: number },
      direction: "input" | "output"
    ) => {
      if (direction === "input" && point.x >= 300) {
        return resolvePort("target-node", "input", 0);
      }

      if (direction === "output" && point.x <= 200) {
        return resolvePort("source-node", "output", 0);
      }

      return undefined;
    },
    setConnectionSourcePort: () => {},
    setConnectionCandidatePort: () => {},
    setConnectionPreview: (
      source: LeaferGraphConnectionPortState,
      pointer: { x: number; y: number },
      target?: LeaferGraphConnectionPortState
    ) => {
      previewCalls.push({ source, pointer, target });
    },
    clearConnectionPreview: () => {},
    canCreateLink: () => ({ valid: true }),
    createLink: () => true,
    resolveDraggedNodeIds: (nodeId: string) => [nodeId],
    moveNodesByDelta: (
      positions: readonly Array<{ nodeId: string; startX: number; startY: number }>,
      deltaX: number,
      deltaY: number
    ) => {
      for (const position of positions) {
        const node = nodeViews.get(position.nodeId);
        if (!node) {
          continue;
        }

        node.state.layout.x = position.startX + deltaX;
        node.state.layout.y = position.startY + deltaY;
      }
    },
    resizeNode: (nodeId: string, size: { width: number; height: number }) => {
      nodeSizes.set(nodeId, size);
    },
    setNodeCollapsed: (nodeId: string, collapsed: boolean) => {
      const node = nodeViews.get(nodeId);
      if (!node) {
        return false;
      }
      node.state.flags.collapsed = collapsed;
      return true;
    },
    beginNodeTitleEdit: (nodeId: string) => {
      titleEditRequests.push(nodeId);
      return true;
    },
    canResizeNode: () => true,
    listSelectedNodeIds: () => [...selectedNodeIds],
    isNodeSelected: (nodeId: string) => selectedNodeIds.has(nodeId),
    setSelectedNodeIds: (nodeIds: readonly string[], mode: "replace" | "add" | "remove" = "replace") => {
      if (mode === "replace") {
        selectedNodeIds.clear();
      }
      if (mode === "remove") {
        for (const nodeId of nodeIds) {
          selectedNodeIds.delete(nodeId);
        }
      } else {
        for (const nodeId of nodeIds) {
          selectedNodeIds.add(nodeId);
        }
      }
      return [...selectedNodeIds];
    },
    clearSelectedNodes: () => {
      clearSelectedCount += 1;
      const ids = [...selectedNodeIds];
      selectedNodeIds.clear();
      return ids;
    },
    resolveNodeAtPoint: (point: { x: number; y: number }) => {
      for (const [nodeId, node] of nodeViews) {
        const size = nodeSizes.get(nodeId) ?? { width: 160, height: 80 };
        if (
          point.x >= node.state.layout.x &&
          point.x <= node.state.layout.x + size.width &&
          point.y >= node.state.layout.y &&
          point.y <= node.state.layout.y + size.height
        ) {
          return nodeId;
        }
      }

      return undefined;
    },
    resolveNodeIdsInBounds: () => ["source-node"],
    getPagePointByClient: (event: Pick<PointerEvent, "clientX" | "clientY">) => ({
      x: event.clientX,
      y: event.clientY
    }),
    getPagePointFromGraphEvent: (event: any) => event.pagePoint,
    resolveNodeSize: (nodeId: string) => nodeSizes.get(nodeId)
  };

  const host = new LeaferGraphInteractionHost({
    container,
    runtime: runtime as any,
    selectionLayer: {
      add() {}
    } as any,
    resolveSelectionStroke: () => "#3b82f6",
    requestRender: () => {},
    emitInteractionCommit: (event) => {
      commits.push(event);
    }
  });

  return {
    host,
    container,
    commits,
    previewCalls,
    clearSelectedCount: () => clearSelectedCount,
    selectedNodeIds,
    nodeSizes,
    nodeViews,
    syncResizeCalls,
    titleEditRequests
  };
}

describe("interaction_host_integration", () => {
  test("node.move.commit 会在拖拽结束后发出一次提交", () => {
    const harness = createInteractionHarness();
    const { host, container, commits, nodeViews } = harness;

    try {
      host.bindNodeDragging(
        "source-node",
        nodeViews.get("source-node")!.view as unknown as Group
      );

      const view = nodeViews.get("source-node")!.view as unknown as FakeEventSource;
      view.emit(
        "pointer.down",
        createGraphPointerEvent({
          target: null,
          x: 20,
          y: 30
        })
      );

      (host as any).handleWindowPointerMove(createPointerEventLike(80, 95));
      (host as any).handleWindowPointerUp();

      expect(commits).toContainEqual({
        type: "node.move.commit",
        entries: [
          {
            nodeId: "source-node",
            before: { x: 20, y: 30 },
            after: { x: 80, y: 95 }
          }
        ]
      });
      expect(container.style.cursor).toBe("");
    } finally {
      host.destroy();
      container.remove();
    }
  });

  test("node.resize.commit 会在 resize 结束后发出一次提交", () => {
    const harness = createInteractionHarness();
    const { host, container, commits, nodeViews, nodeSizes, syncResizeCalls } = harness;

    try {
      const state = nodeViews.get("source-node")!;
      host.bindNodeResize("source-node", state);

      (state.resizeHandle as unknown as FakeEventSource).emit(
        "pointer.down",
        createGraphPointerEvent({
          target: state.resizeHandle,
          x: 180,
          y: 110
        })
      );

      (host as any).handleWindowPointerMove(createPointerEventLike(240, 140));
      (host as any).handleWindowPointerUp();

      expect(nodeSizes.get("source-node")).toEqual({
        width: 220,
        height: 110
      });
      expect(commits).toContainEqual({
        type: "node.resize.commit",
        nodeId: "source-node",
        before: {
          width: 160,
          height: 80
        },
        after: {
          width: 220,
          height: 110
        }
      });
      expect(syncResizeCalls).toContain("source-node");
    } finally {
      host.destroy();
      container.remove();
    }
  });

  test("空白区点击结束后会清空当前选区", () => {
    const harness = createInteractionHarness();
    const { host, container, selectedNodeIds, clearSelectedCount } = harness;

    try {
      selectedNodeIds.add("source-node");

      (host as any).handleContainerPointerDown(createPointerEventLike(900, 600));
      (host as any).handleWindowPointerUp();

      expect(clearSelectedCount()).toBe(1);
      expect([...selectedNodeIds]).toEqual([]);
    } finally {
      host.destroy();
      container.remove();
    }
  });

  test("link.create.commit 会在拖线结束后发出一次提交", () => {
    const harness = createInteractionHarness();
    const { host, container, commits, nodeViews, previewCalls } = harness;

    try {
      const sourceState = nodeViews.get("source-node")!;
      host.bindNodePorts("source-node", sourceState);

      const outputPort = sourceState.shellView.portViews[1];
      (outputPort.hitArea as unknown as FakeEventSource).emit(
        "pointer.down",
        createGraphPointerEvent({
          target: outputPort.hitArea,
          x: 180,
          y: 70
        })
      );

      (host as any).handleWindowPointerMove(createPointerEventLike(320, 80));
      (host as any).handleWindowPointerUp(createPointerEventLike(320, 80));

      expect(previewCalls.length).toBeGreaterThan(0);
      expect(commits).toContainEqual({
        type: "link.create.commit",
        input: {
          source: {
            nodeId: "source-node",
            slot: 0
          },
          target: {
            nodeId: "target-node",
            slot: 0
          }
        }
      });
    } finally {
      host.destroy();
      container.remove();
    }
  });

  test("标题栏 double_tap 会请求标题重命名，并清掉标题拖拽态", () => {
    const harness = createInteractionHarness();
    const { host, container, nodeViews, titleEditRequests } = harness;

    try {
      const state = nodeViews.get("source-node")!;
      host.bindNodeDragging(
        "source-node",
        nodeViews.get("source-node")!.view as unknown as Group
      );
      (host as any).bindNodeTitleEditing("source-node", state);

      const view = state.view as unknown as FakeEventSource;
      const titleHitArea = state.shellView.titleHitArea as unknown as FakeEventSource;

      view.emit(
        "pointer.down",
        createGraphPointerEvent({
          target: titleHitArea,
          x: 48,
          y: 44
        })
      );

      expect((host as any).dragState).not.toBeNull();

      (host as any).handleWindowPointerMove(createPointerEventLike(120, 100));
      const draggedX = state.state.layout.x;
      const draggedY = state.state.layout.y;

      titleHitArea.emit(
        "double_tap",
        createGraphPointerEvent({
          target: titleHitArea,
          x: 48,
          y: 44
        })
      );

      expect(titleEditRequests).toEqual(["source-node"]);
      expect((host as any).dragState).toBeNull();

      (host as any).handleWindowPointerMove(createPointerEventLike(160, 140));

      expect(state.state.layout.x).toBe(draggedX);
      expect(state.state.layout.y).toBe(draggedY);
    } finally {
      host.destroy();
      container.remove();
    }
  });
});
