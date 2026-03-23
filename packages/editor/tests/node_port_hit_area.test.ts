import "./helpers/install_test_host_polyfills";

import { describe, expect, test } from "bun:test";

import { resolveDefaultNodeShellRenderTheme } from "../../leafergraph/src/graph/graph_runtime_style";
import {
  NODE_PORT_HIT_AREA_PADDING_X,
  NODE_PORT_HIT_AREA_PADDING_Y,
  resolveNodePortHitAreaBounds
} from "../../leafergraph/src/node/node_port";
import {
  NODE_SHELL_LAYOUT_METRICS,
  resolveDefaultSelectedStroke
} from "../../leafergraph/src/graph/graph_runtime_style";
import {
  resolveNodeCategoryBadgeLayout,
  resolveNodeShellLayout
} from "../../leafergraph/src/node/node_layout";
import { createNodeShell } from "../../leafergraph/src/node/node_shell";
import { LeaferGraphInteractionRuntimeHost } from "../../leafergraph/src/interaction/graph_interaction_runtime_host";

function createNodeState(options?: {
  collapsed?: boolean;
  x?: number;
  y?: number;
}) {
  return {
    id: "node-a",
    type: "demo/node",
    layout: {
      x: options?.x ?? 100,
      y: options?.y ?? 80,
      width: 288,
      height: 140
    },
    inputs: [{ name: "In", type: "event" }],
    outputs: [{ name: "Out", type: "event" }],
    widgets: [],
    flags: options?.collapsed ? { collapsed: true } : {}
  };
}

function createShellView(options?: {
  collapsed?: boolean;
  x?: number;
  y?: number;
}) {
  const node = createNodeState(options);
  const shellLayout = resolveNodeShellLayout(node as never, NODE_SHELL_LAYOUT_METRICS);
  const categoryLayout = resolveNodeCategoryBadgeLayout(
    "demo",
    shellLayout.width,
    NODE_SHELL_LAYOUT_METRICS
  );

  return {
    node,
    shellView: createNodeShell({
      nodeId: node.id,
      x: node.layout.x,
      y: node.layout.y,
      title: "Demo Node",
      signalColor: "#38BDF8",
      selectedStroke: resolveDefaultSelectedStroke("dark"),
      shellLayout,
      categoryLayout,
      theme: resolveDefaultNodeShellRenderTheme("dark")
    })
  };
}

function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

function createInteractionRuntimeHost(options?: {
  collapsed?: boolean;
}) {
  const { node, shellView } = createShellView(options);
  const state = {
    state: node as never,
    view: {
      zIndex: 0
    },
    shellView,
    hovered: false
  };

  return new LeaferGraphInteractionRuntimeHost({
    nodeViews: new Map([[node.id, state]]),
    linkLayer: {
      add() {}
    },
    bringNodeViewToFront() {},
    syncNodeResizeHandleVisibility() {},
    requestRender() {},
    resolveDraggedNodeIds() {
      return [];
    },
    sceneRuntime: {
      moveNodesByDelta() {},
      resizeNode() {},
      createLink() {},
      findLinksByNode() {
        return [];
      }
    },
    setNodeCollapsed() {
      return true;
    },
    canResizeNode() {
      return false;
    },
    getPagePointByClient() {
      return { x: 0, y: 0 };
    },
    getPagePointFromGraphEvent() {
      return { x: 0, y: 0 };
    },
    resolveNodeSize() {
      return {
        width: node.layout.width,
        height: node.layout.height
      };
    },
    resolveConnectionPreviewStroke() {
      return "#38BDF8";
    }
  });
}

describe("node port hit area", () => {
  test("端口命中框应围绕 slot 本体对称外扩，而不是贴满整侧", () => {
    const inputPort = {
      direction: "input" as const,
      index: 0,
      label: "In",
      labelVisible: true,
      portX: -NODE_SHELL_LAYOUT_METRICS.portSize / 2,
      portY: 56,
      portWidth: NODE_SHELL_LAYOUT_METRICS.portSize,
      portHeight: NODE_SHELL_LAYOUT_METRICS.portSize,
      labelX: NODE_SHELL_LAYOUT_METRICS.sectionPaddingX,
      labelY: 60
    };
    const outputPort = {
      ...inputPort,
      direction: "output" as const,
      portX: 288 - NODE_SHELL_LAYOUT_METRICS.portSize / 2
    };

    const inputHitBounds = resolveNodePortHitAreaBounds(inputPort);
    const outputHitBounds = resolveNodePortHitAreaBounds(outputPort);

    expect(inputHitBounds).toEqual({
      x: inputPort.portX - NODE_PORT_HIT_AREA_PADDING_X,
      y: inputPort.portY - NODE_PORT_HIT_AREA_PADDING_Y,
      width: inputPort.portWidth + NODE_PORT_HIT_AREA_PADDING_X * 2,
      height: inputPort.portHeight + NODE_PORT_HIT_AREA_PADDING_Y * 2
    });
    expect(outputHitBounds).toEqual({
      x: outputPort.portX - NODE_PORT_HIT_AREA_PADDING_X,
      y: outputPort.portY - NODE_PORT_HIT_AREA_PADDING_Y,
      width: outputPort.portWidth + NODE_PORT_HIT_AREA_PADDING_X * 2,
      height: outputPort.portHeight + NODE_PORT_HIT_AREA_PADDING_Y * 2
    });
  });

  test("折叠态输入端口命中框不应与折叠按钮重叠", () => {
    const { shellView } = createShellView({ collapsed: true, x: 0, y: 0 });
    const inputPort = shellView.portViews.find(
      (port) => port.layout.direction === "input"
    );
    expect(inputPort).toBeDefined();

    expect(
      overlaps(
        {
          x: Number(inputPort!.hitArea.x),
          y: Number(inputPort!.hitArea.y),
          width: Number(inputPort!.hitArea.width),
          height: Number(inputPort!.hitArea.height)
        },
        {
          x: Number(shellView.signalButton.x),
          y: Number(shellView.signalButton.y),
          width: Number(shellView.signalButton.width),
          height: Number(shellView.signalButton.height)
        }
      )
    ).toBe(false);
  });

  test("拖线命中应保留在 slot 周边，旧长条边缘与折叠按钮中心不再误命中", () => {
    const expandedHost = createInteractionRuntimeHost();
    const expandedState = createNodeState();
    const expandedLayout = resolveNodeShellLayout(
      expandedState as never,
      NODE_SHELL_LAYOUT_METRICS
    );
    const expandedInputPort = expandedLayout.ports.find(
      (port) => port.direction === "input"
    );
    expect(expandedInputPort).toBeDefined();

    const expandedCenterY =
      expandedState.layout.y +
      expandedInputPort!.portY +
      expandedInputPort!.portHeight / 2;

    expect(
      expandedHost.resolvePortAtPoint(
        {
          x:
            expandedState.layout.x +
            expandedInputPort!.portX +
            expandedInputPort!.portWidth / 2,
          y: expandedCenterY
        },
        "input"
      )?.nodeId
    ).toBe(expandedState.id);

    expect(
      expandedHost.resolvePortAtPoint(
        {
          x: expandedState.layout.x + expandedInputPort!.portWidth + 12,
          y: expandedCenterY
        },
        "input"
      )
    ).toBeUndefined();

    const collapsedHost = createInteractionRuntimeHost({ collapsed: true });
    const { shellView: collapsedShellView } = createShellView({
      collapsed: true,
      x: 0,
      y: 0
    });

    expect(
      collapsedHost.resolvePortAtPoint(
        {
          x:
            Number(collapsedShellView.signalButton.x) +
            Number(collapsedShellView.signalButton.width) / 2,
          y:
            Number(collapsedShellView.signalButton.y) +
            Number(collapsedShellView.signalButton.height) / 2
        },
        "input"
      )
    ).toBeUndefined();
  });
});
