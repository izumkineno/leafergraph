import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";
import { LeaferGraphApiHost } from "@leafergraph/api-host";
import { createTestHarness } from "./test_harness";

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "public-facade-doc",
    revision: 1,
    appKind: "public-facade-test",
    nodes: [],
    links: []
  };
}

describe("public_facade_integration", () => {
  test("API host 实例拥有完整 façade 方法", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });
    const methodHost = harness.host as unknown as Record<string, unknown>;
    const representativeMethods = [
      "subscribeHistory",
      "subscribeInteractionCommit",
      "setThemeMode",
      "fitView",
      "getWidget",
      "listWidgets",
      "createNode",
      "removeNode"
    ] as const;

    expect(harness.host).toBeInstanceOf(LeaferGraphApiHost);
    for (const methodName of representativeMethods) {
      expect(typeof methodHost[methodName]).toBe("function");
    }
  });

  test("historySource 与 interactionCommitSource 会继续透传事件", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });
    const historyEvents: string[] = [];
    const interactionEvents: string[] = [];
    const unsubscribeHistory = harness.runtime.historySource.subscribe((event) => {
      historyEvents.push(event.type);
    });
    const unsubscribeInteraction = harness.runtime.interactionCommitSource.subscribe((event) => {
      interactionEvents.push(event.type);
    });

    try {
      harness.state.emitInteractionCommit({
        type: "node.widget.commit",
        nodeId: "node-a",
        widgetIndex: 0,
        beforeValue: 1,
        afterValue: 2,
        beforeWidgets: [],
        afterWidgets: []
      } as never);

      expect(interactionEvents).toEqual(["node.widget.commit"]);
      expect(historyEvents).toContain("history.record");
    } finally {
      unsubscribeHistory();
      unsubscribeInteraction();
    }
  });
});
