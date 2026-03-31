import { describe, expect, test } from "bun:test";

import { NodeRegistry, type GraphLink, type NodeRuntimeState } from "@leafergraph/node";
import { LeaferGraphWidgetRegistry } from "@leafergraph/widget-runtime";
import { LeaferGraphNodeRuntimeHost } from "../src/node/runtime/controller";

function createNodeState(
  id: string,
  type: string,
  x: number
): NodeRuntimeState {
  return {
    id,
    type,
    title: id,
    layout: {
      x,
      y: 0,
      width: 140,
      height: 80
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
    inputValues: [{ count: 1 }],
    outputValues: [],
    data: {}
  };
}

function createHostHarness() {
  const widgetRegistry = new LeaferGraphWidgetRegistry((() => {}) as never);
  const nodeRegistry = new NodeRegistry(widgetRegistry);
  const connectionEvents: Array<{
    nodeId: string;
    type: "input" | "output";
    slot: number;
    connected: boolean;
  }> = [];
  const actionEvents: Array<{ nodeId: string; action: string; param: unknown }> = [];
  const executedNodeIds: string[] = [];

  nodeRegistry.registerNode({
    type: "source",
    outputs: [{ name: "out", label: "Out", type: "number" }],
    onConnectionsChange(node, type, slot, connected) {
      connectionEvents.push({ nodeId: node.id, type, slot, connected });
    },
    onAction(node, action, param, _options, api) {
      actionEvents.push({ nodeId: node.id, action, param });
      api.setOutputData(0, param);
    }
  });
  nodeRegistry.registerNode({
    type: "target",
    inputs: [{ name: "in", label: "In", type: "number" }],
    onConnectionsChange(node, type, slot, connected) {
      connectionEvents.push({ nodeId: node.id, type, slot, connected });
    },
    onExecute(node) {
      executedNodeIds.push(node.id);
    }
  });

  const sourceNode = createNodeState("source-1", "source", 0);
  const targetNode = createNodeState("target-1", "target", 320);
  const graphNodes = new Map<string, NodeRuntimeState>([
    [sourceNode.id, sourceNode],
    [targetNode.id, targetNode]
  ]);
  const graphLink = {
    id: "link-1",
    source: { nodeId: sourceNode.id, slot: 0 },
    target: { nodeId: targetNode.id, slot: 0 }
  } as GraphLink;
  const graphLinks = new Map<string, GraphLink>([[graphLink.id, graphLink]]);
  const nodeViews = new Map<string, { state: NodeRuntimeState }>([
    [sourceNode.id, { state: sourceNode }],
    [targetNode.id, { state: targetNode }]
  ]);
  const refreshedNodeIds: string[] = [];
  const connectedNodeIds: string[] = [];
  let renderCount = 0;

  const host = new LeaferGraphNodeRuntimeHost({
    nodeRegistry,
    widgetRegistry,
    graphNodes,
    graphLinks,
    nodeViews,
    sceneRuntime: {
      refreshNodeView(state) {
        refreshedNodeIds.push(state.state.id);
      },
      updateConnectedLinks(nodeId) {
        connectedNodeIds.push(nodeId);
      },
      resizeNode(nodeId, size) {
        const node = graphNodes.get(nodeId);
        if (!node) {
          return undefined;
        }

        node.layout.width = size.width ?? node.layout.width;
        node.layout.height = size.height ?? node.layout.height;
        return node;
      },
      requestRender() {
        renderCount += 1;
      }
    },
    resolveNodeResizeConstraint() {
      return {
        enabled: true,
        lockRatio: false,
        minWidth: 120,
        minHeight: 80,
        defaultWidth: 220,
        defaultHeight: 140
      };
    }
  });

  return {
    host,
    graphLink,
    graphLinks,
    graphNodes,
    connectionEvents,
    actionEvents,
    executedNodeIds,
    refreshedNodeIds,
    connectedNodeIds,
    getRenderCount: () => renderCount
  };
}

describe("node_runtime_host", () => {
  test("getNodeInspectorState 返回的布局和值是克隆快照", () => {
    const { host, graphNodes } = createHostHarness();
    const inspector = host.getNodeInspectorState("source-1");

    expect(inspector).toBeDefined();
    inspector!.layout.x = 999;
    (inspector!.inputs[0]!.value as { count: number }).count = 42;

    expect(graphNodes.get("source-1")?.layout.x).toBe(0);
    expect(
      (graphNodes.get("source-1")?.inputValues[0] as { count: number }).count
    ).toBe(1);
  });

  test("setNodeCollapsed 会刷新节点视图和相连连线", () => {
    const { host, graphNodes, refreshedNodeIds, connectedNodeIds, getRenderCount } =
      createHostHarness();

    expect(host.setNodeCollapsed("source-1", true)).toBe(true);
    expect(graphNodes.get("source-1")?.flags.collapsed).toBe(true);
    expect(refreshedNodeIds).toEqual(["source-1"]);
    expect(connectedNodeIds).toEqual(["source-1"]);
    expect(getRenderCount()).toBe(1);
  });

  test("resetNodeSize 会按约束默认值回写节点尺寸", () => {
    const { host, graphNodes } = createHostHarness();

    const resized = host.resetNodeSize("source-1");

    expect(resized?.layout.width).toBe(220);
    expect(resized?.layout.height).toBe(140);
    expect(graphNodes.get("source-1")?.layout.width).toBe(220);
    expect(graphNodes.get("source-1")?.layout.height).toBe(140);
  });

  test("notifyLinkCreated 和 notifyLinkRemoved 会分发 onConnectionsChange", () => {
    const { host, graphLink, graphLinks, connectionEvents } = createHostHarness();

    host.notifyLinkCreated(graphLink);
    expect(connectionEvents.slice(0, 2)).toEqual([
      {
        nodeId: "source-1",
        type: "output",
        slot: 0,
        connected: true
      },
      {
        nodeId: "target-1",
        type: "input",
        slot: 0,
        connected: true
      }
    ]);

    graphLinks.delete(graphLink.id);
    host.notifyLinkRemoved(graphLink);

    expect(connectionEvents.slice(2)).toEqual([
      {
        nodeId: "source-1",
        type: "output",
        slot: 0,
        connected: false
      },
      {
        nodeId: "target-1",
        type: "input",
        slot: 0,
        connected: false
      }
    ]);
  });

  test("emitNodeWidgetAction 会推进后续任务并请求刷新", () => {
    const {
      host,
      actionEvents,
      executedNodeIds,
      getRenderCount
    } = createHostHarness();

    const handled = host.emitNodeWidgetAction("source-1", "trigger", {
      value: 7
    });

    expect(handled).toBe(true);
    expect(actionEvents).toEqual([
      {
        nodeId: "source-1",
        action: "trigger",
        param: { value: 7 }
      }
    ]);
    expect(executedNodeIds).toContain("target-1");
    expect(host.getNodeExecutionState("target-1")?.status).toBe("success");
    expect(getRenderCount()).toBeGreaterThan(0);
  });
});
