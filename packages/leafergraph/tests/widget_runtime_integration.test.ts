import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";
import { createLeaferGraph } from "../src";

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "widget-runtime-doc",
    revision: "1",
    appKind: "widget-runtime-test",
    nodes: [],
    links: []
  };
}

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
  container.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON() {
        return this;
      }
    }) as DOMRect;
  document.body.appendChild(container);
  return container;
}

describe("widget_runtime_integration", () => {
  test("LeaferGraph 启动后默认不再注册基础 Widget", async () => {
    const container = createContainer();
    const graph = createLeaferGraph(container, {
      document: createEmptyDocument()
    });

    await graph.ready;

    expect(graph.getWidget("input")).toBeUndefined();
    expect(graph.getWidget("slider")).toBeUndefined();
    expect(graph.listWidgets()).toHaveLength(0);

    graph.destroy();
    container.remove();
  });
});
