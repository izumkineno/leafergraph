import type { GraphDocument } from "@leafergraph/core/node";
import { DASHBOARD_NODE_TYPE, CONFIG_NODE_TYPE, TRANSFORM_NODE_TYPE } from "./node_definitions";
import { createCustomStructureNodeDocumentEntry } from "./custom_structure_node";

export const SMALL_INTERACTIVE_GRAPH_NODE_IDS = {
  dashboard: "custom-dashboard",
  transform: "custom-transform",
  runtimeStructure: "custom-runtime-structure",
  config: "custom-config"
} as const;

export function createSmallInteractiveGraphDocument(): GraphDocument {
  return {
    documentId: "small-interactive-graph",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [
      {
        id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.dashboard,
        type: DASHBOARD_NODE_TYPE,
        title: "Dashboard",
        layout: { x: 100, y: 120 },
        inputs: [{ name: "data", label: "Data In", type: "any", shape: "circle" }],
        outputs: [{ name: "processed", label: "Processed", type: "any", shape: "circle" }],
        properties: { value: 72, status: "active" },
        flags: { selected: false },
        data: { progress: 72, metric: "96.5 ms", message: "System Healthy" }
      },
      {
        id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.config,
        type: CONFIG_NODE_TYPE,
        title: "Configuration",
        layout: { x: 820, y: 110 },
        inputs: [{ name: "input", label: "Input", type: "any", shape: "circle" }],
        outputs: [{ name: "output", label: "Output", type: "any", shape: "circle" }],
        properties: { mode: "advanced", timeout: 5000, retries: 3 },
        flags: { selected: false },
        data: { params: [{ key: "mode", value: "advanced" }, { key: "timeout", value: "5000" }] }
      },
      {
        ...createCustomStructureNodeDocumentEntry({
          id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure,
          x: 690,
          y: 285
        })
      },
      {
        id: SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform,
        type: TRANSFORM_NODE_TYPE,
        title: "Transform",
        layout: { x: 450, y: 300 },
        inputs: [
          { name: "source", label: "Source", type: "object", shape: "circle" },
          { name: "schema", label: "Schema", type: "object", shape: "circle" }
        ],
        outputs: [
          { name: "result", label: "Result", type: "object", shape: "circle" },
          { name: "warnings", label: "Warnings", type: "array", shape: "circle" }
        ],
        properties: { strategy: "normalize", outputFormat: "typed-json", strict: true },
        flags: { selected: false },
        data: {
          rules: [
            { from: "payload.user.name", to: "profile.displayName" },
            { from: "payload.score", to: "metrics.score" },
            { from: "payload.tags[]", to: "labels[]" }
          ],
          preview: {
            profile: { displayName: "Ada" },
            metrics: { score: 98 },
            labels: ["active", "trial"]
          },
          warnings: 1
        }
      }
    ],
    links: [
      {
        id: "custom-link-1",
        source: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.dashboard, slot: 0 },
        target: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform, slot: 0 }
      },
      {
        id: "custom-link-2",
        source: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.transform, slot: 0 },
        target: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure, slot: 0 }
      },
      {
        id: "custom-link-3",
        source: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.runtimeStructure, slot: 0 },
        target: { nodeId: SMALL_INTERACTIVE_GRAPH_NODE_IDS.config, slot: 0 }
      }
    ]
  };
}
