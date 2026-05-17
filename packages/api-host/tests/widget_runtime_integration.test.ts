import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";

import { createTestHarness } from "./test_harness";

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "widget-runtime-doc",
    revision: "1",
    appKind: "widget-runtime-test",
    nodes: [],
    links: []
  };
}

describe("widget_runtime_integration", () => {
  test("API host 启动后默认不再注册基础 Widget", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });

    expect(harness.host.getWidget("input")).toBeUndefined();
    expect(harness.host.getWidget("slider")).toBeUndefined();
    expect(harness.host.listWidgets()).toHaveLength(0);
  });
});
