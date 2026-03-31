import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import { createLeaferGraph, LeaferGraph } from "../src";

/**
 * 创建测试用图容器。
 *
 * @returns 已挂到文档上的容器节点。
 */
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

/**
 * 创建最小正式图文档。
 *
 * @returns 空白测试文档。
 */
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
  test("构造函数和工厂函数创建的实例都拥有完整 façade 方法", async () => {
    const containerA = createContainer();
    const containerB = createContainer();
    const graphFromConstructor = new LeaferGraph(containerA, {
      document: createEmptyDocument()
    });
    const graphFromFactory = createLeaferGraph(containerB, {
      document: createEmptyDocument()
    });

    await Promise.all([graphFromConstructor.ready, graphFromFactory.ready]);

    try {
      const representativeMethods = [
        "use",
        "getNodeView",
        "setNodeSelected",
        "getNodeSnapshot",
        "play",
        "subscribeRuntimeFeedback",
        "applyGraphDocumentDiff",
        "resolveConnectionPort",
        "createNode"
      ] as const;

      expect(graphFromConstructor).toBeInstanceOf(LeaferGraph);
      expect(graphFromFactory).toBeInstanceOf(LeaferGraph);

      for (const graph of [graphFromConstructor, graphFromFactory]) {
        const methodHost = graph as unknown as Record<string, unknown>;
        for (const methodName of representativeMethods) {
          expect(typeof methodHost[methodName]).toBe("function");
        }
      }
    } finally {
      graphFromConstructor.destroy();
      graphFromFactory.destroy();
      containerA.remove();
      containerB.remove();
    }
  });
});
