import { describe, expect, test } from "bun:test";

import type { RuntimeFeedbackEvent } from "leafergraph";
import { createManualRuntimeFeedbackInlet } from "../src/runtime/runtime_feedback_inlet";

function createNodeStateFeedback(nodeId: string): RuntimeFeedbackEvent {
  return {
    type: "node.state",
    event: {
      nodeId,
      reason: "updated",
      exists: true,
      timestamp: Date.now()
    }
  };
}

describe("createManualRuntimeFeedbackInlet", () => {
  test("应把注入事件分发给所有订阅者", () => {
    const inlet = createManualRuntimeFeedbackInlet();
    const receivedByFirst: RuntimeFeedbackEvent[] = [];
    const receivedBySecond: RuntimeFeedbackEvent[] = [];

    const disposeFirst = inlet.subscribe((event) => {
      receivedByFirst.push(event);
    });
    inlet.subscribe((event) => {
      receivedBySecond.push(event);
    });

    const event = createNodeStateFeedback("node-a");
    inlet.emit(event);

    expect(receivedByFirst).toEqual([event]);
    expect(receivedBySecond).toEqual([event]);

    disposeFirst();
    inlet.emit(createNodeStateFeedback("node-b"));

    expect(receivedByFirst).toHaveLength(1);
    expect(receivedBySecond).toHaveLength(2);
  });
});
