import { describe, expect, test } from "bun:test";

import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";
import {
  createLeaferGraphLocalRuntimeFeedbackHost,
  type LeaferGraphRuntimeFeedbackEventSource
} from "../src/graph/feedback/local_runtime_adapter";

function createNodeExecutionEvent(): LeaferGraphNodeExecutionEvent {
  return {
    chainId: "chain-1",
    rootNodeId: "source-node",
    rootNodeType: "demo/source",
    rootNodeTitle: "Source",
    nodeId: "source-node",
    nodeType: "demo/source",
    nodeTitle: "Source",
    depth: 0,
    sequence: 0,
    source: "graph-play",
    trigger: "direct",
    timestamp: 1,
    executionContext: {
      source: "graph-play",
      entryNodeId: "source-node",
      stepIndex: 0,
      startedAt: 1
    },
    state: {
      status: "success",
      runCount: 1,
      lastSucceededAt: 1
    }
  };
}

function createGraphExecutionEvent(): LeaferGraphGraphExecutionEvent {
  return {
    type: "drained",
    timestamp: 2,
    state: {
      status: "idle",
      queueSize: 0,
      stepCount: 1
    }
  };
}

function createLinkPropagationEvent(): LeaferGraphLinkPropagationEvent {
  return {
    linkId: "link-1",
    chainId: "chain-1",
    sourceNodeId: "source-node",
    sourceSlot: 0,
    targetNodeId: "target-node",
    targetSlot: 0,
    payload: { value: 7 },
    timestamp: 3
  };
}

function createNodeStateEvent(): LeaferGraphNodeStateChangeEvent {
  return {
    nodeId: "target-node",
    exists: true,
    reason: "execution",
    timestamp: 4
  };
}

function createHarness() {
  let onNodeExecution:
    | ((event: LeaferGraphNodeExecutionEvent) => void)
    | undefined;
  let onGraphExecution:
    | ((event: LeaferGraphGraphExecutionEvent) => void)
    | undefined;
  let onLinkPropagation:
    | ((event: LeaferGraphLinkPropagationEvent) => void)
    | undefined;
  let onNodeState:
    | ((event: LeaferGraphNodeStateChangeEvent) => void)
    | undefined;

  const projectionCalls = {
    graph: [] as LeaferGraphGraphExecutionEvent[],
    nodeExecution: [] as LeaferGraphNodeExecutionEvent[],
    nodeState: [] as LeaferGraphNodeStateChangeEvent[],
    linkPropagation: [] as LeaferGraphLinkPropagationEvent[]
  };

  const eventSource: LeaferGraphRuntimeFeedbackEventSource = {
    subscribeNodeExecution(listener) {
      onNodeExecution = listener;
      return () => {
        onNodeExecution = undefined;
      };
    },
    subscribeGraphExecution(listener) {
      onGraphExecution = listener;
      return () => {
        onGraphExecution = undefined;
      };
    },
    subscribeLinkPropagation(listener) {
      onLinkPropagation = listener;
      return () => {
        onLinkPropagation = undefined;
      };
    },
    subscribeNodeState(listener) {
      onNodeState = listener;
      return () => {
        onNodeState = undefined;
      };
    }
  };

  const host = createLeaferGraphLocalRuntimeFeedbackHost({
    ...eventSource,
    projectExternalGraphExecution(event) {
      projectionCalls.graph.push(event);
    },
    projectExternalNodeExecution(event) {
      projectionCalls.nodeExecution.push(event);
    },
    projectExternalNodeState(event) {
      projectionCalls.nodeState.push(event);
    },
    projectExternalLinkPropagation(event) {
      projectionCalls.linkPropagation.push(event);
    }
  });

  return {
    host,
    emitNodeExecution(event = createNodeExecutionEvent()) {
      onNodeExecution?.(event);
      return event;
    },
    emitGraphExecution(event = createGraphExecutionEvent()) {
      onGraphExecution?.(event);
      return event;
    },
    emitLinkPropagation(event = createLinkPropagationEvent()) {
      onLinkPropagation?.(event);
      return event;
    },
    emitNodeState(event = createNodeStateEvent()) {
      onNodeState?.(event);
      return event;
    },
    projectionCalls
  };
}

describe("runtime_feedback_host", () => {
  test("会把 execution feedback 与 node.state 合流成统一 runtime feedback", () => {
    const harness = createHarness();
    const feedbackEvents: RuntimeFeedbackEvent[] = [];

    harness.host.subscribe((event) => {
      feedbackEvents.push(event);
    });

    const nodeExecutionEvent = harness.emitNodeExecution();
    const graphExecutionEvent = harness.emitGraphExecution();
    const linkPropagationEvent = harness.emitLinkPropagation();
    const nodeStateEvent = harness.emitNodeState();

    expect(feedbackEvents.map((event) => event.type)).toEqual([
      "node.execution",
      "graph.execution",
      "link.propagation",
      "node.state"
    ]);
    expect(feedbackEvents[0]).toEqual({
      type: "node.execution",
      event: nodeExecutionEvent
    });
    expect(feedbackEvents[1]).toEqual({
      type: "graph.execution",
      event: graphExecutionEvent
    });
    expect(feedbackEvents[2]).toEqual({
      type: "link.propagation",
      event: linkPropagationEvent
    });
    expect(feedbackEvents[3]).toEqual({
      type: "node.state",
      event: nodeStateEvent
    });
  });

  test("projectRuntimeFeedback 会把四类 external feedback 分发到正确宿主", () => {
    const harness = createHarness();

    const nodeExecutionEvent = createNodeExecutionEvent();
    const graphExecutionEvent = createGraphExecutionEvent();
    const linkPropagationEvent = createLinkPropagationEvent();
    const nodeStateEvent = createNodeStateEvent();

    harness.host.projectRuntimeFeedback({
      type: "graph.execution",
      event: graphExecutionEvent
    });
    harness.host.projectRuntimeFeedback({
      type: "node.execution",
      event: nodeExecutionEvent
    });
    harness.host.projectRuntimeFeedback({
      type: "node.state",
      event: nodeStateEvent
    });
    harness.host.projectRuntimeFeedback({
      type: "link.propagation",
      event: linkPropagationEvent
    });

    expect(harness.projectionCalls.graph).toEqual([graphExecutionEvent]);
    expect(harness.projectionCalls.nodeExecution).toEqual([nodeExecutionEvent]);
    expect(harness.projectionCalls.nodeState).toEqual([nodeStateEvent]);
    expect(harness.projectionCalls.linkPropagation).toEqual([
      linkPropagationEvent
    ]);
  });
});
