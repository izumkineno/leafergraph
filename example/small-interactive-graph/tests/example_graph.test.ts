import { describe, expect, test } from "bun:test";

import { SMALL_GRAPH_NODE_DEFINITIONS } from "../src/graph/node_definitions";
import { createSmallInteractiveGraphDocument } from "../src/graph/example_document";

describe("small-interactive-graph helpers", () => {
  test("exports local node definitions", () => {
    expect(SMALL_GRAPH_NODE_DEFINITIONS).toHaveLength(3);
    expect(SMALL_GRAPH_NODE_DEFINITIONS.map((definition) => definition.type)).toEqual([
      "small-interactive/source",
      "small-interactive/transform",
      "small-interactive/sink"
    ]);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[0]?.outputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[1]?.inputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[1]?.outputs).toHaveLength(1);
    expect(SMALL_GRAPH_NODE_DEFINITIONS[2]?.inputs).toHaveLength(1);
  });

  test("creates a preseeded graph document", () => {
    const document = createSmallInteractiveGraphDocument();
    const definitionByType = new Map(
      SMALL_GRAPH_NODE_DEFINITIONS.map((definition) => [definition.type, definition] as const)
    );
    const nodeById = new Map(document.nodes.map((node) => [node.id, node] as const));

    expect(document.documentId).toBe("small-interactive-graph");
    expect(document.nodes).toHaveLength(3);
    expect(document.links).toHaveLength(2);
    expect(document.nodes.map((node) => node.id)).toEqual([
      "small-source",
      "small-transform",
      "small-sink"
    ]);
    expect(document.links[0]?.source.nodeId).toBe("small-source");
    expect(document.links[0]?.target.nodeId).toBe("small-transform");
    expect(document.links[1]?.source.nodeId).toBe("small-transform");
    expect(document.links[1]?.target.nodeId).toBe("small-sink");
    expect(
      document.links.every((link) => {
        const sourceNode = nodeById.get(link.source.nodeId);
        const targetNode = nodeById.get(link.target.nodeId);
        const sourceDefinition = sourceNode
          ? definitionByType.get(sourceNode.type)
          : undefined;
        const targetDefinition = targetNode
          ? definitionByType.get(targetNode.type)
          : undefined;

        return (
          sourceNode !== undefined &&
          targetNode !== undefined &&
          sourceDefinition !== undefined &&
          targetDefinition !== undefined &&
          link.source.slot >= 0 &&
          link.source.slot < (sourceDefinition.outputs?.length ?? 0) &&
          link.target.slot >= 0 &&
          link.target.slot < (targetDefinition.inputs?.length ?? 0)
        );
      })
    ).toBe(true);
  });
});
