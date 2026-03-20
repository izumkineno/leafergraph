import { describe, expect, test } from "bun:test";
import { NodeRegistry, type NodeRuntimeState } from "@leafergraph/node";

import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  RuntimeFeedbackEvent
} from "../../leafergraph/src/api/graph_api_types";
import { LeaferGraphExecutionRuntimeHost } from "../../leafergraph/src/graph/graph_execution_runtime_host";
import { projectExternalRuntimeFeedback } from "../../leafergraph/src/graph/graph_runtime_feedback_projection";
import { LeaferGraphNodeRuntimeHost } from "../../leafergraph/src/node/node_runtime_host";
import { LeaferGraphWidgetRegistry } from "../../leafergraph/src/widgets/widget_registry";

function createRuntimeNode(
  overrides: Partial<NodeRuntimeState> & Pick<NodeRuntimeState, "id" | "type">
): NodeRuntimeState {
  return {
    id: overrides.id,
    type: overrides.type,
    title: overrides.title ?? overrides.id,
    layout: overrides.layout ?? {
      x: 0,
      y: 0,
      width: 240,
      height: 140
    },
    properties: overrides.properties ?? {},
    propertySpecs: overrides.propertySpecs ?? [],
    inputs: overrides.inputs ?? [],
    outputs: overrides.outputs ?? [],
    widgets: overrides.widgets ?? [],
    flags: overrides.flags ?? {},
    inputValues: overrides.inputValues ?? [],
    outputValues: overrides.outputValues ?? [],
    data: overrides.data ?? {}
  };
}

describe("external runtime feedback projection", () => {
  test("应把不同 feedback 分发到对应 runtime 宿主", () => {
    const calls: string[] = [];
    const host = {
      projectExternalGraphExecution(): void {
        calls.push("graph.execution");
      },
      projectExternalNodeExecution(): void {
        calls.push("node.execution");
      },
      projectExternalNodeState(): void {
        calls.push("node.state");
      },
      projectExternalLinkPropagation(): void {
        calls.push("link.propagation");
      }
    };
    const feedbacks: RuntimeFeedbackEvent[] = [
      {
        type: "graph.execution",
        event: {
          type: "started",
          state: {
            status: "running",
            runId: "run-1",
            queueSize: 1,
            stepCount: 0,
            startedAt: 1,
            lastSource: "graph-play"
          },
          runId: "run-1",
          source: "graph-play",
          timestamp: 1
        }
      },
      {
        type: "node.execution",
        event: {
          chainId: "chain-1",
          rootNodeId: "node-1",
          rootNodeType: "demo.node",
          rootNodeTitle: "Node 1",
          nodeId: "node-1",
          nodeType: "demo.node",
          nodeTitle: "Node 1",
          depth: 0,
          sequence: 0,
          source: "graph-step",
          trigger: "direct",
          timestamp: 1,
          executionContext: {
            source: "graph-step",
            stepIndex: 0,
            entryNodeId: "node-1",
            startedAt: 1
          },
          state: {
            status: "success",
            runCount: 1,
            lastExecutedAt: 1,
            lastSucceededAt: 1
          }
        }
      },
      {
        type: "node.state",
        event: {
          nodeId: "node-1",
          exists: true,
          reason: "execution",
          timestamp: 1
        }
      },
      {
        type: "link.propagation",
        event: {
          linkId: "link-1",
          chainId: "chain-1",
          sourceNodeId: "node-1",
          sourceSlot: 0,
          targetNodeId: "node-2",
          targetSlot: 0,
          payload: { value: 1 },
          timestamp: 1
        }
      }
    ];

    for (const feedback of feedbacks) {
      projectExternalRuntimeFeedback(host, feedback);
    }

    expect(calls).toEqual([
      "graph.execution",
      "node.execution",
      "node.state",
      "link.propagation"
    ]);
  });

  test("应把外部节点执行与链路传播投影回节点运行时宿主", () => {
    let renderCount = 0;
    const sourceNode = createRuntimeNode({
      id: "source-node",
      type: "demo.source",
      outputs: [{ name: "Output", type: "number" }]
    });
    const targetNode = createRuntimeNode({
      id: "target-node",
      type: "demo.target",
      inputs: [{ name: "Input", type: "number" }]
    });
    const graphNodes = new Map<string, NodeRuntimeState>([
      [sourceNode.id, sourceNode],
      [targetNode.id, targetNode]
    ]);
    const graphLinks = new Map([
      [
        "link-1",
        {
          id: "link-1",
          source: { nodeId: sourceNode.id, slot: 0 },
          target: { nodeId: targetNode.id, slot: 0 }
        }
      ]
    ]);
    const nodeViews = new Map([
      [sourceNode.id, { state: sourceNode }],
      [targetNode.id, { state: targetNode }]
    ]);
    const widgetRegistry = new LeaferGraphWidgetRegistry(
      (() => null) as never
    );
    const host = new LeaferGraphNodeRuntimeHost({
      nodeRegistry: new NodeRegistry(widgetRegistry),
      widgetRegistry,
      graphNodes,
      graphLinks,
      nodeViews,
      sceneRuntime: {
        refreshNodeView(): void {},
        updateConnectedLinks(): void {},
        resizeNode(): NodeRuntimeState | undefined {
          return undefined;
        },
        requestRender(): void {
          renderCount += 1;
        }
      },
      resolveNodeResizeConstraint() {
        return {
          enabled: false,
          minWidth: 240,
          minHeight: 140,
          defaultWidth: 240,
          defaultHeight: 140
        };
      }
    });
    const executionEvents: LeaferGraphNodeExecutionEvent[] = [];
    const propagationEvents: LeaferGraphLinkPropagationEvent[] = [];
    host.subscribeNodeExecution((event) => {
      executionEvents.push(event);
    });
    host.subscribeLinkPropagation((event) => {
      propagationEvents.push(event);
    });

    host.projectExternalNodeExecution({
      chainId: "chain-1",
      rootNodeId: sourceNode.id,
      rootNodeType: sourceNode.type,
      rootNodeTitle: "Counter Source",
      nodeId: sourceNode.id,
      nodeType: sourceNode.type,
      nodeTitle: "Counter 1",
      depth: 0,
      sequence: 0,
      source: "graph-step",
      trigger: "direct",
      timestamp: 1,
      executionContext: {
        source: "graph-step",
        runId: "run-1",
        entryNodeId: sourceNode.id,
        stepIndex: 0,
        startedAt: 1
      },
      state: {
        status: "success",
        runCount: 1,
        lastExecutedAt: 1,
        lastSucceededAt: 1
      }
    });
    host.projectExternalLinkPropagation({
      linkId: "link-1",
      chainId: "chain-1",
      sourceNodeId: sourceNode.id,
      sourceSlot: 0,
      targetNodeId: targetNode.id,
      targetSlot: 0,
      payload: { value: 1 },
      timestamp: 2
    });

    expect(sourceNode.title).toBe("Counter 1");
    expect(host.getNodeExecutionState(sourceNode.id)).toMatchObject({
      status: "success",
      runCount: 1
    });
    expect(sourceNode.outputValues[0]).toEqual({ value: 1 });
    expect(targetNode.inputValues[0]).toEqual({ value: 1 });
    expect(executionEvents).toHaveLength(1);
    expect(propagationEvents).toHaveLength(1);
    expect(renderCount).toBeGreaterThan(0);
  });

  test("应把外部图级执行状态写回图运行时宿主", () => {
    const host = new LeaferGraphExecutionRuntimeHost({
      nodeRuntimeHost: {
        listNodeIdsByType(): string[] {
          return [];
        },
        createEntryExecutionTask() {
          return undefined;
        },
        executeExecutionTask() {
          return {
            handled: false,
            nextTasks: []
          };
        }
      }
    });
    const events: LeaferGraphGraphExecutionEvent[] = [];
    host.subscribeGraphExecution((event) => {
      events.push(event);
    });

    host.projectExternalGraphExecution({
      type: "advanced",
      state: {
        status: "running",
        runId: "run-1",
        queueSize: 2,
        stepCount: 3,
        startedAt: 1,
        lastSource: "graph-play"
      },
      runId: "run-1",
      source: "graph-play",
      nodeId: "node-1",
      timestamp: 3
    });

    expect(host.getGraphExecutionState()).toEqual({
      status: "running",
      runId: "run-1",
      queueSize: 2,
      stepCount: 3,
      startedAt: 1,
      lastSource: "graph-play"
    });
    expect(events).toEqual([
      {
        type: "advanced",
        state: {
          status: "running",
          runId: "run-1",
          queueSize: 2,
          stepCount: 3,
          startedAt: 1,
          lastSource: "graph-play"
        },
        runId: "run-1",
        source: "graph-play",
        nodeId: "node-1",
        timestamp: 3
      }
    ]);
  });
});
