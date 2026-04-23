import { describe, expect, test } from "bun:test";

import { createRuntimeFeedbackSubscriptionTracker } from "../src/graph/runtime_feedback_subscription_tracker";

describe("mini-graph runtime feedback subscription tracker", () => {
  test("tracks bootstrap, subscribed, and cleanup phases with a single active handle", () => {
    const tracker = createRuntimeFeedbackSubscriptionTracker();

    expect(tracker.getSnapshot()).toEqual({
      phase: "idle",
      activeCount: 0,
      subscribeCount: 0,
      unsubscribeCount: 0
    });

    tracker.beginBootstrap();
    expect(tracker.getSnapshot()).toEqual({
      phase: "bootstrapping",
      activeCount: 0,
      subscribeCount: 0,
      unsubscribeCount: 0
    });

    let unsubscribeCalls = 0;
    tracker.attach(() => {
      unsubscribeCalls += 1;
    });

    expect(tracker.getSnapshot()).toEqual({
      phase: "subscribed",
      activeCount: 1,
      subscribeCount: 1,
      unsubscribeCount: 0
    });

    tracker.dispose();

    expect(unsubscribeCalls).toBe(1);
    expect(tracker.getSnapshot()).toEqual({
      phase: "cleaned-up",
      activeCount: 0,
      subscribeCount: 1,
      unsubscribeCount: 1
    });
  });

  test("reattach replaces the previous handle without ever exposing more than one active subscription", () => {
    const tracker = createRuntimeFeedbackSubscriptionTracker();

    let firstCleanupCalls = 0;
    let secondCleanupCalls = 0;

    tracker.attach(() => {
      firstCleanupCalls += 1;
    });
    tracker.attach(() => {
      secondCleanupCalls += 1;
    });

    expect(firstCleanupCalls).toBe(1);
    expect(secondCleanupCalls).toBe(0);
    expect(tracker.getSnapshot()).toEqual({
      phase: "subscribed",
      activeCount: 1,
      subscribeCount: 2,
      unsubscribeCount: 1
    });

    tracker.dispose();

    expect(secondCleanupCalls).toBe(1);
    expect(tracker.getSnapshot()).toEqual({
      phase: "cleaned-up",
      activeCount: 0,
      subscribeCount: 2,
      unsubscribeCount: 2
    });
  });
});
