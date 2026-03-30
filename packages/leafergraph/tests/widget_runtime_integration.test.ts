import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
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
  test("LeaferGraph 启动后应保留内建基础 Widget 注册", async () => {
    const container = createContainer();
    const graph = createLeaferGraph(container, {
      document: createEmptyDocument()
    });

    await graph.ready;

    expect(graph.getWidget("input")?.type).toBe("input");
    expect(graph.getWidget("slider")?.type).toBe("slider");
    expect(graph.listWidgets().some((entry) => entry.type === "button")).toBe(true);

    graph.destroy();
    container.remove();
  });
});
