import type { NodeDefinition } from "@leafergraph/core/node";

export const SMALL_INTERACTIVE_SOURCE_NODE_TYPE = "small-interactive/source";
export const SMALL_INTERACTIVE_TRANSFORM_NODE_TYPE = "small-interactive/transform";
export const SMALL_INTERACTIVE_SINK_NODE_TYPE = "small-interactive/sink";

export const SMALL_GRAPH_NODE_DEFINITIONS: readonly NodeDefinition[] = [
  {
    type: SMALL_INTERACTIVE_SOURCE_NODE_TYPE,
    title: "Source",
    category: "Small Interactive",
    description: "A minimal source node for connection and drag tests.",
    outputs: [{ name: "out", label: "Out", type: "number", shape: "circle" }],
    size: [180, 96]
  },
  {
    type: SMALL_INTERACTIVE_TRANSFORM_NODE_TYPE,
    title: "Transform",
    category: "Small Interactive",
    description: "A middle node used to keep the graph interactive.",
    inputs: [{ name: "in", label: "In", type: "number", shape: "circle" }],
    outputs: [{ name: "out", label: "Out", type: "number", shape: "circle" }],
    size: [200, 104]
  },
  {
    type: SMALL_INTERACTIVE_SINK_NODE_TYPE,
    title: "Sink",
    category: "Small Interactive",
    description: "A terminal node to complete the small chain.",
    inputs: [{ name: "in", label: "In", type: "number", shape: "circle" }],
    size: [180, 96]
  }
] as const;
