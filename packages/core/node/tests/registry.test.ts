import { describe, expect, it } from "bun:test";

import {
  NodeRegistry,
  type WidgetDefinition,
  type WidgetDefinitionReader
} from "../src";
import {
  NodeDefinitionExistsError,
  UnknownNodeTypeError,
  UnknownWidgetTypeError
} from "../src/errors";

function createWidgetReader(definitions: WidgetDefinition[]): WidgetDefinitionReader {
  const definitionMap = new Map(definitions.map((definition) => [definition.type, definition]));
  return {
    get(type) {
      return definitionMap.get(type);
    }
  };
}

describe("@leafergraph/core/node NodeRegistry", () => {
  it("支持注册、覆写、卸载与 require 读取", () => {
    const registry = new NodeRegistry(createWidgetReader([{ type: "input" }]));

    registry.register({
      type: "demo/task",
      title: "Task",
      widgets: [{ type: "input", name: "title" }]
    });

    expect(registry.has("demo/task")).toBe(true);
    expect(registry.require("demo/task").title).toBe("Task");

    expect(() =>
      registry.register({
        type: "demo/task",
        title: "Duplicate"
      })
    ).toThrow(NodeDefinitionExistsError);

    registry.register(
      {
        type: "demo/task",
        title: "Task V2"
      },
      { overwrite: true }
    );

    expect(registry.require("demo/task").title).toBe("Task V2");

    registry.unregister("demo/task");

    expect(registry.has("demo/task")).toBe(false);
    expect(() => registry.require("demo/task")).toThrow(UnknownNodeTypeError);
  });

  it("注册表内部会保存定义副本，避免外部对象继续污染已注册结果", () => {
    const registry = new NodeRegistry(createWidgetReader([{ type: "input" }]));
    const definition = {
      type: "demo/task",
      title: "Original",
      inputs: [{ name: "In", type: "event" }],
      widgets: [{ type: "input", name: "title", value: { nested: true } }]
    };

    registry.register(definition);

    definition.title = "Mutated";
    definition.inputs[0].name = "Changed";
    (definition.widgets[0].value as { nested: boolean }).nested = false;

    const stored = registry.require("demo/task");
    expect(stored.title).toBe("Original");
    expect(stored.inputs?.[0]?.name).toBe("In");
    expect(stored.widgets?.[0]?.value).toEqual({ nested: true });
  });

  it("注册节点时会校验 widget 与 property widget 的类型", () => {
    const registry = new NodeRegistry(createWidgetReader([{ type: "input" }]));

    expect(() =>
      registry.register({
        type: "demo/missing-widget",
        widgets: [{ type: "toggle", name: "enabled" }]
      })
    ).toThrow(UnknownWidgetTypeError);

    expect(() =>
      registry.register({
        type: "demo/missing-property-widget",
        properties: [
          {
            name: "title",
            widget: {
              type: "select",
              name: "title"
            }
          }
        ]
      })
    ).toThrow(UnknownWidgetTypeError);
  });

  it("get / require / list 返回值不应泄露 registry 内部可变引用", () => {
    const registry = new NodeRegistry(createWidgetReader([{ type: "input" }]));

    registry.register({
      type: "demo/task",
      title: "Original",
      inputs: [{ name: "In", type: "event" }],
      widgets: [{ type: "input", name: "title", value: { nested: true } }]
    });

    const fromGet = registry.get("demo/task");
    const fromRequire = registry.require("demo/task");
    const fromList = registry.list()[0];

    expect(fromGet).toBeDefined();
    expect(fromList).toBeDefined();

    if (!fromGet || !fromList) {
      throw new Error("expected registry lookups to resolve");
    }

    fromGet.title = "Mutated via get";
    fromRequire.inputs![0]!.name = "Mutated via require";
    (fromList.widgets![0]!.value as { nested: boolean }).nested = false;

    const stored = registry.require("demo/task");
    expect(stored.title).toBe("Original");
    expect(stored.inputs?.[0]?.name).toBe("In");
    expect(stored.widgets?.[0]?.value).toEqual({ nested: true });
  });
});
