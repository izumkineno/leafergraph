import type { LeaferGraphNodeData } from "leafergraph";

export const demoNodes: LeaferGraphNodeData[] = [
  {
    id: "texture-source",
    title: "Texture",
    subtitle: "Seeded source",
    x: 44,
    y: 112,
    accent: "#3B82F6",
    category: "Source / Image",
    status: "LIVE",
    inputs: ["Seed"],
    outputs: ["Texture"],
    controlLabel: "Exposure",
    controlValue: "1.10",
    controlProgress: 0.58
  },
  {
    id: "multiply",
    title: "Multiply",
    subtitle: "Math control",
    x: 344,
    y: 248,
    accent: "#6366F1",
    category: "Math / Float",
    status: "LIVE",
    inputs: ["A", "B"],
    outputs: ["Result"],
    controlLabel: "Factor",
    controlValue: "2.50",
    controlProgress: 0.5
  },
  {
    id: "preview",
    title: "Preview",
    subtitle: "Viewport target",
    x: 644,
    y: 130,
    accent: "#8B5CF6",
    category: "Output / View",
    status: "SYNC",
    inputs: ["Image"],
    outputs: ["Panel"],
    controlLabel: "Zoom",
    controlValue: "1.00",
    controlProgress: 0.32
  }
];
