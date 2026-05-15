import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";
import type { RuntimeFeedbackEvent } from "@leafergraph/core/contracts";
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
        "unregisterNode",
        "unregisterWidget",
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

  test("register/unregisterNode 与 register/unregisterWidget 应可对称生效", async () => {
    const container = createContainer();
    const graph = createLeaferGraph(container, {
      document: createEmptyDocument()
    });

    await graph.ready;

    try {
      graph.registerNode({
        type: "demo/unregister-node",
        title: "Demo"
      });
      graph.registerWidget({
        type: "demo/unregister-widget",
        renderer() {
          return {};
        }
      });

      expect(graph.listNodes().some((node) => node.type === "demo/unregister-node")).toBe(
        true
      );
      expect(
        graph.listWidgets().some((widget) => widget.type === "demo/unregister-widget")
      ).toBe(true);

      graph.unregisterNode("demo/unregister-node");
      graph.unregisterWidget("demo/unregister-widget");

      expect(graph.listNodes().some((node) => node.type === "demo/unregister-node")).toBe(
        false
      );
      expect(
        graph.listWidgets().some((widget) => widget.type === "demo/unregister-widget")
      ).toBe(false);
    } finally {
      graph.destroy();
      container.remove();
    }
  });

  test("subscribeRuntimeFeedback 与 projectRuntimeFeedback 会继续透传统一反馈事件", async () => {
    const container = createContainer();
    const graph = createLeaferGraph(container, {
      document: createEmptyDocument()
    });

    await graph.ready;

    try {
      graph.registerNode(
        {
          type: "test/runtime-feedback-source",
          title: "Source",
          outputs: [{ name: "out" }],
          onExecute(_node, _context, api) {
            api.setOutputData(0, { payload: 7 });
          }
        },
        { overwrite: true }
      );
      graph.registerNode(
        {
          type: "test/runtime-feedback-target",
          title: "Target",
          inputs: [{ name: "in" }]
        },
        { overwrite: true }
      );

      graph.createNode({
        id: "source-node",
        type: "test/runtime-feedback-source",
        x: 0,
        y: 0
      });
      graph.createNode({
        id: "target-node",
        type: "test/runtime-feedback-target",
        x: 320,
        y: 0
      });
      graph.createLink({
        source: { nodeId: "source-node", slot: 0 },
        target: { nodeId: "target-node", slot: 0 }
      });

      const receivedEvents: RuntimeFeedbackEvent[] = [];
      const unsubscribe = graph.subscribeRuntimeFeedback((event) => {
        receivedEvents.push(event);
      });

      try {
        expect(graph.playFromNode("source-node")).toBe(true);
        expect(receivedEvents.map((event) => event.type)).toEqual([
          "node.state",
          "link.propagation",
          "node.state",
          "node.execution"
        ]);

        graph.projectRuntimeFeedback({
          type: "node.execution",
          event: {
            chainId: "external-chain",
            rootNodeId: "target-node",
            rootNodeType: "test/runtime-feedback-target",
            rootNodeTitle: "Target",
            nodeId: "target-node",
            nodeType: "test/runtime-feedback-target",
            nodeTitle: "Target",
            depth: 0,
            sequence: 0,
            source: "node-play",
            trigger: "direct",
            timestamp: Date.now(),
            executionContext: {
              source: "node-play",
              entryNodeId: "target-node",
              stepIndex: 0,
              startedAt: Date.now()
            },
            state: {
              status: "error",
              runCount: 99,
              lastErrorMessage: "external"
            }
          }
        });

        expect(graph.getNodeExecutionState("target-node")).toMatchObject({
          status: "error",
          runCount: 99,
          lastErrorMessage: "external"
        });
      } finally {
        unsubscribe();
      }
    } finally {
      graph.destroy();
      container.remove();
    }
  });
});
