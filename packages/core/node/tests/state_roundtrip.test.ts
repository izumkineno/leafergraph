import { describe, expect, it } from "bun:test";

import {
  NodeRegistry,
  configureNode,
  createNodeState,
  serializeNode,
  type NodeSerializeResult,
  type WidgetDefinition,
  type WidgetDefinitionReader
} from "../src";

function createWidgetReader(definitions: WidgetDefinition[]): WidgetDefinitionReader {
  const definitionMap = new Map(definitions.map((definition) => [definition.type, definition]));
  return {
    get(type) {
      return definitionMap.get(type);
    }
  };
}

describe("@leafergraph/core/node state roundtrip", () => {
  it("createNodeState 会回填定义默认值、尺寸与 widget normalize", () => {
    const registry = new NodeRegistry(
      createWidgetReader([
        {
          type: "input",
          normalize(value) {
            return String(value ?? "").trim().toUpperCase();
          }
        }
      ]),
      [
        {
          type: "demo/task",
          title: "Demo Task",
          size: [240, 120],
          properties: [
            {
              name: "count",
              type: "number",
              default: 1
            }
          ],
          inputs: [{ name: "In" }, { name: "Optional" }],
          outputs: [{ name: "Out" }],
          widgets: [
            {
              type: "input",
              name: "label",
              value: "  hello world  "
            }
          ]
        }
      ]
    );

    const node = createNodeState(registry, {
      id: "task-1",
      type: "demo/task",
      layout: {
        x: 10,
        y: 20
      },
      data: {
        persisted: true
      }
    });

    expect(node).toMatchObject({
      id: "task-1",
      type: "demo/task",
      title: "Demo Task",
      layout: {
        x: 10,
        y: 20,
        width: 240,
        height: 120
      },
      properties: {
        count: 1
      },
      data: {
        persisted: true
      }
    });
    expect(node.widgets[0]?.value).toBe("HELLO WORLD");
    expect(node.inputValues).toEqual([undefined, undefined]);
    expect(node.outputValues).toEqual([undefined]);
  });

  it("未注册节点类型会回退到 missing definition 占位信息", () => {
    const registry = new NodeRegistry(createWidgetReader([]));
    const node = createNodeState(registry, {
      id: "missing-1",
      type: "unknown/missing_node"
    });

    expect(node.type).toBe("unknown/missing_node");
    expect(node.title).toBe("Missing Node");
    expect(node.layout).toEqual({
      x: 0,
      y: 0,
      width: undefined,
      height: undefined
    });
  });

  it("configureNode 与 serializeNode 会保持 roundtrip 语义，并隔离 onConfigure 副作用", () => {
    let configureSnapshot: NodeSerializeResult | undefined;

    const registry = new NodeRegistry(
      createWidgetReader([
        {
          type: "input",
          normalize(value) {
            return String(value ?? "").trim().toUpperCase();
          },
          serialize(value) {
            return `serialized:${String(value ?? "").toLowerCase()}`;
          }
        }
      ]),
      [
        {
          type: "demo/task",
          title: "Demo Task",
          size: [200, 100],
          properties: [
            {
              name: "count",
              type: "number",
              default: 1
            }
          ],
          inputs: [{ name: "In" }, { name: "Optional" }],
          outputs: [{ name: "Out" }],
          widgets: [
            {
              type: "input",
              name: "label",
              value: "  init  "
            }
          ],
          onConfigure(_node, data) {
            configureSnapshot = data;
            data.properties = { count: 999 };
            if (data.widgets?.[0]) {
              data.widgets[0].value = "mutated";
            }
          },
          onSerialize(_node, data) {
            data.data = {
              ...data.data,
              serialized: true
            };
          }
        }
      ]
    );

    const node = createNodeState(registry, {
      id: "task-2",
      type: "demo/task",
      flags: {
        selected: true
      }
    });

    node.inputValues = ["runtime-in", "second", "trimmed"];
    node.outputValues = ["runtime-out", "extra"];

    configureNode(registry, node, {
      type: "demo/task",
      title: "Reconfigured",
      inputs: [{ name: "Trigger", type: "event" }],
      outputs: [],
      widgets: [
        {
          type: "input",
          name: "label",
          value: "  updated  "
        }
      ],
      flags: {
        collapsed: true
      },
      data: {
        persisted: "next"
      }
    });

    expect(node.title).toBe("Reconfigured");
    expect(node.widgets[0]?.value).toBe("UPDATED");
    expect(node.flags).toEqual({
      selected: true,
      collapsed: true
    });
    expect(node.inputValues).toEqual(["runtime-in"]);
    expect(node.outputValues).toEqual([]);
    expect(node.data).toEqual({
      persisted: "next"
    });
    expect(node.properties).toEqual({
      count: 1
    });
    expect(configureSnapshot?.properties).toEqual({
      count: 999
    });
    expect(configureSnapshot?.widgets?.[0]?.value).toBe("mutated");

    const serialized = serializeNode(registry, node);

    expect(serialized).toMatchObject({
      id: "task-2",
      type: "demo/task",
      title: "Reconfigured",
      properties: {
        count: 1
      },
      flags: {
        selected: true,
        collapsed: true
      },
      data: {
        persisted: "next",
        serialized: true
      }
    });
    expect(serialized.widgets?.[0]?.value).toBe("serialized:updated");
    expect("inputValues" in serialized).toBe(false);
    expect("outputValues" in serialized).toBe(false);
  });

  it("configureNode 在切换 type 时应回到新 definition，并仅保留显式 override", () => {
    const registry = new NodeRegistry(
      createWidgetReader([
        {
          type: "input",
          normalize(value) {
            return String(value ?? "").trim();
          }
        }
      ]),
      [
        {
          type: "demo/source",
          title: "Source Node",
          size: [200, 100],
          properties: [
            {
              name: "count",
              type: "number",
              default: 1
            }
          ],
          inputs: [{ name: "Source In" }],
          outputs: [{ name: "Source Out" }],
          widgets: [
            {
              type: "input",
              name: "sourceLabel",
              value: "source"
            }
          ]
        },
        {
          type: "demo/target",
          title: "Target Node",
          size: [320, 180],
          properties: [
            {
              name: "ratio",
              type: "number",
              default: 2
            }
          ],
          inputs: [{ name: "Target In" }],
          outputs: [{ name: "Target Out" }],
          widgets: [
            {
              type: "input",
              name: "targetLabel",
              value: "target"
            }
          ]
        }
      ]
    );

    const node = createNodeState(registry, {
      id: "switch-1",
      type: "demo/source",
      title: "Customized Source",
      properties: {
        count: 9,
        legacy: true
      },
      inputs: [{ name: "Custom Source In" }],
      outputs: [{ name: "Custom Source Out" }],
      widgets: [
        {
          type: "input",
          name: "sourceLabel",
          value: "custom source"
        }
      ],
      data: {
        persisted: "before"
      }
    });

    configureNode(registry, node, {
      type: "demo/target",
      title: "Target Override",
      widgets: [
        {
          type: "input",
          name: "targetLabel",
          value: "custom target"
        }
      ]
    });

    expect(node.type).toBe("demo/target");
    expect(node.title).toBe("Target Override");
    expect(node.layout).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 180
    });
    expect(node.propertySpecs).toEqual([
      {
        name: "ratio",
        type: "number",
        default: 2
      }
    ]);
    expect(node.properties).toEqual({
      ratio: 2
    });
    expect(node.inputs).toEqual([{ name: "Target In" }]);
    expect(node.outputs).toEqual([{ name: "Target Out" }]);
    expect(node.widgets).toEqual([
      {
        type: "input",
        name: "targetLabel",
        value: "custom target"
      }
    ]);
    expect(node.data).toEqual({
      persisted: "before"
    });
  });
});
