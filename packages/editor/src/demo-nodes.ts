import type { LeaferGraphNodeData } from "leafergraph";

export const demoNodes: LeaferGraphNodeData[] = [
  {
    id: "input",
    title: "Input",
    subtitle: "Signal source",
    x: 84,
    y: 120,
    accent: "#FF8A5B"
  },
  {
    id: "compute",
    title: "Compute",
    subtitle: "Runtime experimentation",
    x: 392,
    y: 224,
    accent: "#6EE7B7"
  },
  {
    id: "preview",
    title: "Preview",
    subtitle: "Editor presentation",
    x: 720,
    y: 126,
    accent: "#7DD3FC"
  }
];
