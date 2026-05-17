import type { GraphDocument } from "@leafergraph/core/node";
import { SMALL_GRAPH_NODE_DEFINITIONS } from "./node_definitions";

export const SMALL_INTERACTIVE_GRAPH_NODE_IDS = {
  source: "small-source",
  transform: "small-transform",
  sink: "small-sink"
} as const;

export function createSmallInteractiveGraphDocument(): GraphDocument {
  return {
    documentId: "small-interactive-graph",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [
      {
        id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.source,
        type: SMALL_GRAPH_NODE_DEFINITIONS[0].type,
        title: "Source",
        layout: { x: 80, y: 144 },
        inputs: [],
        outputs: [{ name: "out", label: "Out", type: "number", shape: "circle" }],
        properties: {},
        flags: { selected: false },
        data: {}
      },
      {
        id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform,
        type: SMALL_GRAPH_NODE_DEFINITIONS[1].type,
        title: "Transform",
        layout: { x: 324, y: 136 },
        inputs: [{ name: "in", label: "In", type: "number", shape: "circle" }],
        outputs: [{ name: "out", label: "Out", type: "number", shape: "circle" }],
        properties: {},
        flags: { selected: false },
        data: {}
      },
      {
        id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.sink,
        type: SMALL_GRAPH_NODE_DEFINITIONS[2].type,
        title: "Sink",
        layout: { x: 576, y: 144 },
        inputs: [{ name: "in", label: "In", type: "number", shape: "circle" }],
        outputs: [],
        properties: {},
        flags: { selected: false },
        data: {}
      }
    ],
    links: [
      {
        id: "small-link-1",
        source: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.source, slot: 0 },
        target: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform, slot: 0 }
      },
      {
        id: "small-link-2",
        source: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform, slot: 0 },
        target: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.sink, slot: 0 }
      }
    ]
  };
}
