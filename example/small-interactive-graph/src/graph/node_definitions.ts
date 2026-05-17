import type { NodeDefinition } from "@leafergraph/core/node";

export const DASHBOARD_NODE_TYPE = "custom-showcase/dashboard";
export const CONFIG_NODE_TYPE = "custom-showcase/config";
export const TRANSFORM_NODE_TYPE = "custom-showcase/transform";
export const SHOWCASE_WIDGET_TYPE = "custom-showcase/panel";

export const SMALL_GRAPH_NODE_DEFINITIONS: readonly NodeDefinition[] = [
  {
    type: DASHBOARD_NODE_TYPE,
    title: "Dashboard",
    category: "Custom Showcase",
    description: "Showcase node with real-time data visualization, circular progress, and status indicators.",
    inputs: [{ name: "data", label: "Data In", type: "any", shape: "circle" }],
    outputs: [{ name: "processed", label: "Processed", type: "any", shape: "circle" }],
    widgets: [{ type: SHOWCASE_WIDGET_TYPE, name: "showcase" }],
    size: [240, 200]
  },
  {
    type: CONFIG_NODE_TYPE,
    title: "Configuration",
    category: "Custom Showcase",
    description: "Showcase node with editable parameters, dropdowns, and interactive form controls.",
    inputs: [{ name: "input", label: "Input", type: "any", shape: "circle" }],
    outputs: [{ name: "output", label: "Output", type: "any", shape: "circle" }],
    widgets: [{ type: SHOWCASE_WIDGET_TYPE, name: "showcase" }],
    size: [260, 220]
  },
  {
    type: TRANSFORM_NODE_TYPE,
    title: "Transform",
    category: "Custom Showcase",
    description: "Showcase node with multiple ports, mapping rules, and a compact data preview.",
    inputs: [
      { name: "source", label: "Source", type: "object", shape: "circle" },
      { name: "schema", label: "Schema", type: "object", shape: "circle" }
    ],
    outputs: [
      { name: "result", label: "Result", type: "object", shape: "circle" },
      { name: "warnings", label: "Warnings", type: "array", shape: "circle" }
    ],
    widgets: [{ type: SHOWCASE_WIDGET_TYPE, name: "showcase" }],
    size: [300, 240]
  }
] as const;
