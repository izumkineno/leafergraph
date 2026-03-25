import { describe, expect, test } from "bun:test";

import { createNodeApi, type NodeRuntimeState } from "@leafergraph/node";
import type {
  LeaferGraphNodePluginContext,
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetRendererContext,
  LeaferGraphWidgetThemeContext
} from "leafergraph";

import {
  BaseNode,
  BaseWidget,
  createAuthoringPlugin,
  defineAuthoringNode,
  defineAuthoringWidget
} from "../src/index";

function createTestNode(id: string): NodeRuntimeState {
  return {
    id,
    type: "demo/counter",
    title: id,
    layout: {
      x: 0,
      y: 0
    },
    properties: {},
    propertySpecs: [],
    inputs: [
      {
        name: "input"
      }
    ],
    outputs: [
      {
        name: "output"
      }
    ],
    widgets: [
      {
        type: "demo/widget",
        name: "value",
        value: `${id}-value`
      }
    ],
    flags: {},
    inputValues: [],
    outputValues: [],
    data: {}
  };
}

function createWidgetRendererContext(
  nodeId: string,
  calls: {
    setValue: unknown[];
    commitValue: unknown[];
    requestRender: number;
    emittedActions: Array<[string, unknown, Record<string, unknown> | undefined]>;
  },
  value: unknown
): LeaferGraphWidgetRendererContext {
  const theme: LeaferGraphWidgetThemeContext = {
    mode: "light",
    tokens: {} as LeaferGraphWidgetThemeContext["tokens"]
  };
  const editing: LeaferGraphWidgetEditingContext = {
    enabled: true,
    beginTextEdit() {
      return false;
    },
    openOptionsMenu() {
      return false;
    },
    closeActiveEditor() {},
    registerFocusableWidget() {
      return () => {};
    },
    focusWidget() {},
    clearWidgetFocus() {},
    isWidgetFocused() {
      return false;
    }
  };
  const bounds: LeaferGraphWidgetBounds = {
    x: 0,
    y: 0,
    width: 120,
    height: 32
  };

  return {
    ui: {} as typeof import("leafer-ui"),
    group: {} as LeaferGraphWidgetRendererContext["group"],
    node: createTestNode(nodeId),
    widget: {
      type: "demo/widget",
      name: "value",
      value
    },
    widgetIndex: 0,
    value,
    bounds,
    theme,
    editing,
    setValue(nextValue) {
      calls.setValue.push(nextValue);
    },
    commitValue(nextValue) {
      calls.commitValue.push(nextValue);
    },
    requestRender() {
      calls.requestRender += 1;
    },
    emitAction(action, param, options) {
      calls.emittedActions.push([action, param, options]);
      return true;
    }
  };
}

describe("@leafergraph/authoring", () => {
  test("defineAuthoringNode 应为不同 node 实例隔离作者实例与 state", () => {
    let instanceSeed = 0;
    const seenExecutions: Array<{ nodeId: string; instanceId: number; hits: number }> = [];

    class CounterNode extends BaseNode<
      Record<string, unknown>,
      Record<string, unknown>,
      { output: string },
      { instanceId: number; hits: number }
    > {
      static meta = {
        type: "counter",
        title: "Counter",
        outputs: [{ name: "output" }]
      };

      readonly instanceId = ++instanceSeed;

      createState() {
        return {
          instanceId: this.instanceId,
          hits: 0
        };
      }

      onCreate(ctx: {
        state: { instanceId: number; hits: number };
        setData(name: string, value: unknown): void;
      }) {
        ctx.state.hits += 1;
        ctx.setData("instanceId", this.instanceId);
      }

      onExecute(ctx: {
        node: NodeRuntimeState;
        state: { instanceId: number; hits: number };
        getData<T = unknown>(name: string): T | undefined;
        setOutput(name: "output", value: string): void;
      }) {
        ctx.state.hits += 1;
        seenExecutions.push({
          nodeId: ctx.node.id,
          instanceId: ctx.getData<number>("instanceId") ?? -1,
          hits: ctx.state.hits
        });
        ctx.setOutput("output", `${ctx.node.id}:${ctx.state.instanceId}:${ctx.state.hits}`);
      }
    }

    const definition = defineAuthoringNode(CounterNode);
    const nodeA = createTestNode("node-a");
    const nodeB = createTestNode("node-b");
    const apiA = createNodeApi(nodeA);
    const apiB = createNodeApi(nodeB);

    definition.onCreate?.(nodeA, apiA);
    definition.onExecute?.(nodeA, undefined, apiA);
    definition.onExecute?.(nodeA, undefined, apiA);

    definition.onCreate?.(nodeB, apiB);
    definition.onExecute?.(nodeB, undefined, apiB);

    expect(instanceSeed).toBe(2);
    expect(nodeA.data?.instanceId).toBe(1);
    expect(nodeB.data?.instanceId).toBe(2);
    expect(nodeA.outputValues[0]).toBe("node-a:1:3");
    expect(nodeB.outputValues[0]).toBe("node-b:2:2");
    expect(seenExecutions).toEqual([
      { nodeId: "node-a", instanceId: 1, hits: 2 },
      { nodeId: "node-a", instanceId: 1, hits: 3 },
      { nodeId: "node-b", instanceId: 2, hits: 2 }
    ]);
  });

  test("defineAuthoringWidget 应为每次挂载隔离 widget 实例与内部 state", () => {
    let instanceSeed = 0;
    const destroyLog: Array<{ nodeId: string; instanceId: number; updates: number }> = [];

    class CounterWidget extends BaseWidget<
      string,
      { instanceId: number; updates: number }
    > {
      static meta = {
        type: "demo/widget",
        title: "Counter Widget"
      };

      readonly instanceId = ++instanceSeed;

      mount() {
        return {
          instanceId: this.instanceId,
          updates: 0
        };
      }

      update(
        state: { instanceId: number; updates: number } | void,
        ctx: { node: NodeRuntimeState; commitValue(nextValue?: string): void },
        nextValue: string
      ) {
        const safeState = state!;
        safeState.updates += 1;
        ctx.commitValue(`${ctx.node.id}:${safeState.instanceId}:${safeState.updates}:${nextValue}`);
      }

      destroy(
        state: { instanceId: number; updates: number } | void,
        ctx: { node: NodeRuntimeState }
      ) {
        destroyLog.push({
          nodeId: ctx.node.id,
          instanceId: state?.instanceId ?? -1,
          updates: state?.updates ?? -1
        });
      }
    }

    const entry = defineAuthoringWidget(CounterWidget);
    const renderer = entry.renderer as LeaferGraphWidgetLifecycle<
      Record<string, unknown>
    >;
    const callsA = {
      setValue: [] as unknown[],
      commitValue: [] as unknown[],
      requestRender: 0,
      emittedActions: [] as Array<[string, unknown, Record<string, unknown> | undefined]>
    };
    const callsB = {
      setValue: [] as unknown[],
      commitValue: [] as unknown[],
      requestRender: 0,
      emittedActions: [] as Array<[string, unknown, Record<string, unknown> | undefined]>
    };
    const contextA = createWidgetRendererContext("node-a", callsA, "first");
    const contextB = createWidgetRendererContext("node-b", callsB, "second");
    const runtimeA = renderer.mount?.(contextA);
    const runtimeB = renderer.mount?.(contextB);

    renderer.update?.(runtimeA, contextA, "a-1");
    renderer.update?.(runtimeA, contextA, "a-2");
    renderer.update?.(runtimeB, contextB, "b-1");
    renderer.destroy?.(runtimeA, contextA);
    renderer.destroy?.(runtimeB, contextB);

    expect(instanceSeed).toBe(2);
    expect(callsA.commitValue).toEqual(["node-a:1:1:a-1", "node-a:1:2:a-2"]);
    expect(callsB.commitValue).toEqual(["node-b:2:1:b-1"]);
    expect(destroyLog).toEqual([
      { nodeId: "node-a", instanceId: 1, updates: 2 },
      { nodeId: "node-b", instanceId: 2, updates: 1 }
    ]);
  });

  test("createAuthoringPlugin 应先注册 widget，再安装 node module", () => {
    class DemoNode extends BaseNode {
      static meta = {
        type: "demo-node",
        title: "Demo Node"
      };
    }

    class DemoWidget extends BaseWidget {
      static meta = {
        type: "demo-widget",
        title: "Demo Widget"
      };
    }

    const plugin = createAuthoringPlugin({
      name: "demo-plugin",
      nodes: [DemoNode],
      widgets: [DemoWidget]
    });
    const events: string[] = [];
    const context: LeaferGraphNodePluginContext = {
      sdk: {} as LeaferGraphNodePluginContext["sdk"],
      ui: {} as LeaferGraphNodePluginContext["ui"],
      installModule(module) {
        events.push(`module:${module.nodes?.[0]?.type ?? "unknown"}`);
      },
      registerNode() {
        events.push("node");
      },
      registerWidget(entry) {
        events.push(`widget:${entry.type}`);
      },
      hasNode() {
        return false;
      },
      hasWidget() {
        return false;
      },
      getWidget() {
        return undefined;
      },
      listWidgets() {
        return [];
      },
      getNode() {
        return undefined;
      },
      listNodes() {
        return [];
      }
    };

    plugin.install(context);

    expect(events).toEqual(["widget:demo-widget", "module:demo-node"]);
  });
});
