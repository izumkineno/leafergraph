import { describe, expect, it } from "bun:test";

import { LeaferGraphLocalExecutionFeedbackAdapter } from "../src";

describe("@leafergraph/execution LeaferGraphLocalExecutionFeedbackAdapter", () => {
  it("会把 node / graph / link 三类事件合流，并在 destroy 后停止透传", () => {
    let onNodeExecution: ((event: unknown) => void) | undefined;
    let onGraphExecution: ((event: unknown) => void) | undefined;
    let onLinkPropagation: ((event: unknown) => void) | undefined;
    const feedbackEvents: unknown[] = [];

    const adapter = new LeaferGraphLocalExecutionFeedbackAdapter({
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
      }
    });

    adapter.subscribe((event) => feedbackEvents.push(event));

    onNodeExecution?.({
      chainId: "chain-1",
      rootNodeId: "node-1",
      rootNodeType: "demo/source",
      rootNodeTitle: "Source",
      nodeId: "node-1",
      nodeType: "demo/source",
      nodeTitle: "Source",
      depth: 0,
      sequence: 0,
      source: "graph-play",
      trigger: "direct",
      timestamp: 1,
      executionContext: {
        source: "graph-play",
        entryNodeId: "node-1",
        stepIndex: 0,
        startedAt: 1
      },
      state: {
        status: "running",
        runCount: 1,
        progress: 0.75
      }
    });
    onGraphExecution?.({
      type: "drained",
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 1
      },
      timestamp: 2
    });
    onLinkPropagation?.({
      linkId: "link-1",
      chainId: "chain-1",
      sourceNodeId: "node-1",
      sourceSlot: 0,
      targetNodeId: "node-2",
      targetSlot: 0,
      payload: "PING",
      timestamp: 3
    });

    expect(feedbackEvents.map((event) => (event as { type: string }).type)).toEqual([
      "node.execution",
      "graph.execution",
      "link.propagation"
    ]);
    expect(
      (feedbackEvents[0] as {
        event?: {
          state?: {
            progress?: number;
          };
        };
      }).event?.state?.progress
    ).toBe(0.75);

    adapter.destroy();
    onNodeExecution?.({
      ignored: true
    });

    expect(feedbackEvents).toHaveLength(3);
  });
});
