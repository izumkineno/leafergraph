import { describe, expect, test } from "bun:test";
import { Group } from "leafer-ui";

import { CONFIG_NODE_TYPE, CUSTOM_STRUCTURE_NODE_TYPE, CUSTOM_STRUCTURE_WIDGET_TYPE, DASHBOARD_NODE_TYPE, SHOWCASE_WIDGET_TYPE, SMALL_GRAPH_NODE_DEFINITIONS, TRANSFORM_NODE_TYPE } from "../src/graph/node_definitions";
import { createSmallInteractiveGraphDocument, SMALL_INTERACTIVE_GRAPH_NODE_IDS } from "../src/graph/example_document";
import { smallInteractiveGraphShowcasePlugin, smallInteractiveGraphShowcaseWidget } from "../src/graph/custom_node_renderers";
import { customStructureWidget, projectStructurePorts, SIG_LOCAL_RUNTIME_STRUCTURE } from "../src/graph/custom_structure_node";

describe("small-interactive-graph helpers", () => {
  test("exports local node definitions", () => {
    expect(SMALL_GRAPH_NODE_DEFINITIONS).toHaveLength(4);
    expect(SMALL_GRAPH_NODE_DEFINITIONS.map((definition) => definition.type)).toEqual([
      DASHBOARD_NODE_TYPE,
      CONFIG_NODE_TYPE,
      TRANSFORM_NODE_TYPE,
      CUSTOM_STRUCTURE_NODE_TYPE
    ]);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[0]?.inputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[0]?.outputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[1]?.inputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[1]?.outputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[2]?.inputs).toHaveLength(2);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[2]?.outputs).toHaveLength(2);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[2]?.size?.[1]).toBe(340);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[2]?.resize?.minHeight).toBe(360);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[3]?.inputs).toBeUndefined();
    expect(SMALL_GRAPH_NODE_DEFINITIONS[3]?.outputs).toBeUndefined();
    expect(SMALL_GRAPH_NODE_DEFINITIONS[3]?.widgets).toBeUndefined();
    expect(
      SMALL_GRAPH_NODE_DEFINITIONS.slice(0, 3).every((definition) =>
        definition.widgets?.some((widget) => widget.type === SHOWCASE_WIDGET_TYPE)
      )
    ).toBe(true);
  });

  test("creates a preseeded graph document", () => {
    const document = createSmallInteractiveGraphDocument();
    const definitionByType = new Map(
      SMALL_GRAPH_NODE_DEFINITIONS.map((definition) => [definition.type, definition] as const)
    );
    const nodeById = new Map(document.nodes.map((node) => [node.id, node] as const));

    expect(document.documentId).toBe("small-interactive-graph");
    expect(document.nodes).toHaveLength(4);
    expect(document.links).toHaveLength(3);
    expect(document.nodes.map((node) => node.id)).toEqual([
      SMALL_INTERACTIVE_GRAPH_NODE_IDS.dashboard,
      SMALL_INTERACTIVE_GRAPH_NODE_IDS.config,
      SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure,
      SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform
    ]);
    expect(document.links[0]?.source.nodeId).toBe(SMALL_INTERACTIVE_GRAPH_NODE_IDS.dashboard);
    expect(document.links[0]?.target.nodeId).toBe(SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform);
    expect(document.links[1]?.source.nodeId).toBe(SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform);
    expect(document.links[1]?.target.nodeId).toBe(SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure);
    expect(document.links[2]?.source.nodeId).toBe(SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure);
    expect(document.links[2]?.target.nodeId).toBe(SMALL_INTERACTIVE_GRAPH_NODE_IDS.config);
    expect(
      document.links.every((link) => {
        const sourceNode = nodeById.get(link.source.nodeId);
        const targetNode = nodeById.get(link.target.nodeId);
        const sourceDefinition = sourceNode ? definitionByType.get(sourceNode.type) : undefined;
        const targetDefinition = targetNode ? definitionByType.get(targetNode.type) : undefined;
        const sourceOutputs = sourceNode?.outputs ?? sourceDefinition?.outputs ?? [];
        const targetInputs = targetNode?.inputs ?? targetDefinition?.inputs ?? [];

        return (
          sourceNode !== undefined &&
          targetNode !== undefined &&
          sourceDefinition !== undefined &&
          targetDefinition !== undefined &&
          link.source.slot >= 0 &&
          link.source.slot < sourceOutputs.length &&
          link.target.slot >= 0 &&
          link.target.slot < targetInputs.length
        );
      })
    ).toBe(true);

    const runtimeStructureNode = nodeById.get(SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure);
    expect(runtimeStructureNode?.type).toBe(CUSTOM_STRUCTURE_NODE_TYPE);
    expect(runtimeStructureNode?.inputs).toEqual(projectStructurePorts(SIG_LOCAL_RUNTIME_STRUCTURE, "input"));
    expect(runtimeStructureNode?.outputs).toEqual(projectStructurePorts(SIG_LOCAL_RUNTIME_STRUCTURE, "output"));
    expect(runtimeStructureNode?.widgets?.[0]?.type).toBe(CUSTOM_STRUCTURE_WIDGET_TYPE);
    expect(runtimeStructureNode?.data?.["structure"]).toEqual(SIG_LOCAL_RUNTIME_STRUCTURE);
    expect(structuredClone(runtimeStructureNode)?.data?.["structure"]).toEqual(SIG_LOCAL_RUNTIME_STRUCTURE);
  });

  test("registers showcase widget before showcase nodes", () => {
    const registeredWidgets: string[] = [];
    const registeredNodes: string[] = [];

    smallInteractiveGraphShowcasePlugin.install({
      registerWidget(entry) {
        registeredWidgets.push(entry.type);
      },
      registerNode(definition) {
        registeredNodes.push(definition.type);
      }
    } as never);

    expect(registeredWidgets).toEqual([SHOWCASE_WIDGET_TYPE, CUSTOM_STRUCTURE_WIDGET_TYPE]);
    expect(registeredNodes).toEqual([
      DASHBOARD_NODE_TYPE,
      CONFIG_NODE_TYPE,
      TRANSFORM_NODE_TYPE,
      CUSTOM_STRUCTURE_NODE_TYPE
    ]);
  });

  test("renders showcase panel inside a widget group", () => {
    const document = createSmallInteractiveGraphDocument();
    const transformNode = document.nodes.find(
      (node) => node.id === SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform
    );
    const group = new Group({ width: 260, height: 112 });

    smallInteractiveGraphShowcaseWidget.renderer({
      ui: { Group, Rect: Group, Text: Group },
      group,
      node: transformNode,
      widget: { type: SHOWCASE_WIDGET_TYPE, name: "showcase" },
      widgetIndex: 0,
      value: undefined,
      theme: { mode: "dark", tokens: {} },
      editing: {},
      bounds: { x: 0, y: 0, width: 260, height: 112 },
      setValue() {},
      commitValue() {},
      requestRender() {},
      emitAction() {
        return false;
      }
    } as never);

    expect(group.children).toHaveLength(1);
    expect(group.children[0]?.name).toBe(`custom-native-${SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform}`);
  });

  test("renders runtime structure panel from node data", () => {
    const document = createSmallInteractiveGraphDocument();
    const structureNode = document.nodes.find(
      (node) => node.id === SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure
    );
    const group = new Group({ width: 300, height: 180 });

    customStructureWidget.renderer({
      ui: { Group, Rect: Group, Text: Group },
      group,
      node: structureNode,
      widget: { type: CUSTOM_STRUCTURE_WIDGET_TYPE, name: "runtimeStructure" },
      widgetIndex: 0,
      value: undefined,
      theme: { mode: "dark", tokens: {} },
      editing: {},
      bounds: { x: 0, y: 0, width: 300, height: 180 },
      setValue() {},
      commitValue() {},
      requestRender() {},
      emitAction() {
        return false;
      }
    } as never);

    expect(group.children).toHaveLength(1);
    expect(group.children[0]?.name).toBe(`custom-structure-native-${SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure}`);
  });
});
