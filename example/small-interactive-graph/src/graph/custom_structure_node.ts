import type {
  NodeDefinition,
  NodeSerializeResult,
  NodeSlotSpec,
  NodeWidgetSpec
} from "@leafergraph/core/node";
import type { LeaferGraphWidgetRendererContext } from "@leafergraph/core/contracts";
import { Group, Rect, Text } from "leafer-ui";

export const CUSTOM_STRUCTURE_NODE_TYPE = "custom-showcase/runtime-structure";
export const CUSTOM_STRUCTURE_WIDGET_TYPE = "custom-showcase/runtime-structure-view";

export interface CustomStructureLane {
  id: string;
  title: string;
  state: "queued" | "active" | "complete";
  weight: number;
}

export interface CustomStructurePort {
  name: string;
  label: string;
  type: string;
  direction: "input" | "output";
  laneId: string;
  color: string;
}

export interface CustomStructureSpec {
  version: 1;
  title: string;
  mode: "sig-local-runtime-extension";
  lanes: CustomStructureLane[];
  ports: CustomStructurePort[];
}

export const SIG_LOCAL_RUNTIME_STRUCTURE: CustomStructureSpec = {
  version: 1,
  title: "Runtime Structure",
  mode: "sig-local-runtime-extension",
  lanes: [
    { id: "ingest", title: "Ingest", state: "complete", weight: 36 },
    { id: "route", title: "Route", state: "active", weight: 48 },
    { id: "emit", title: "Emit", state: "queued", weight: 16 }
  ],
  ports: [
    {
      name: "payload",
      label: "Payload",
      type: "object",
      direction: "input",
      laneId: "ingest",
      color: "#38bdf8"
    },
    {
      name: "control",
      label: "Control",
      type: "object",
      direction: "input",
      laneId: "route",
      color: "#f59e0b"
    },
    {
      name: "routed",
      label: "Routed",
      type: "object",
      direction: "output",
      laneId: "emit",
      color: "#22c55e"
    }
  ]
};

export const customStructureNodeDefinition: NodeDefinition = {
  type: CUSTOM_STRUCTURE_NODE_TYPE,
  title: "Runtime Structure",
  category: "Custom Showcase",
  description:
    "SIG-local custom structure node whose authored structure is projected from node data into runtime ports and widgets.",
  size: [300, 320],
  resize: { minWidth: 280, minHeight: 300 },
  shell: {
    variant: "minimal",
    hideHeaderSignal: true,
    hideCategoryBadge: true,
    cardFill: "#071815",
    cardStroke: "#34d399",
    headerFill: "#0c2f29",
    widgetFill: "#071815"
  }
};

export function createCustomStructureNodeDocumentEntry(options: {
  id: string;
  x: number;
  y: number;
}): NodeSerializeResult {
  const structure = cloneCustomStructureSpec(SIG_LOCAL_RUNTIME_STRUCTURE);

  return {
    id: options.id,
    type: CUSTOM_STRUCTURE_NODE_TYPE,
    title: structure.title,
    layout: { x: options.x, y: options.y, width: 300, height: 320 },
    inputs: projectStructurePorts(structure, "input"),
    outputs: projectStructurePorts(structure, "output"),
    widgets: projectStructureWidgets(structure),
    properties: {
      structureMode: structure.mode,
      structureVersion: structure.version,
      activeLane: "route"
    },
    flags: { selected: false },
    data: {
      structure,
      runtimeExtensionLocal: true
    }
  };
}

export function projectStructurePorts(
  structure: CustomStructureSpec,
  direction: CustomStructurePort["direction"]
): NodeSlotSpec[] {
  return structure.ports
    .filter((port) => port.direction === direction)
    .map((port) => ({
      name: port.name,
      label: port.label,
      type: port.type,
      color: port.color,
      shape: direction === "input" ? "grid" : "arrow",
      data: {
        laneId: port.laneId,
        source: "sig-local-structure"
      }
    }));
}

export function projectStructureWidgets(structure: CustomStructureSpec): NodeWidgetSpec[] {
  return [
    {
      type: CUSTOM_STRUCTURE_WIDGET_TYPE,
      name: "runtimeStructure",
      options: {
        structureVersion: structure.version,
        authoredSource: "node.data.structure"
      }
    }
  ];
}

export const customStructureWidget = {
  type: CUSTOM_STRUCTURE_WIDGET_TYPE,
  title: "SIG Local Runtime Structure",
  description: "Renders a SIG-local custom structure projected from node.data.structure.",
  renderer(context: LeaferGraphWidgetRendererContext) {
    const mount = (): Group => {
      context.group.removeAll();
      const structure = resolveCustomStructure(context.node.data);
      const panel = renderCustomStructurePanel(structure, context.bounds.width, context.bounds.height);
      panel.name = `custom-structure-native-${context.node.id}`;
      context.group.add(panel);
      return panel;
    };

    mount();

    return {
      update(): void {
        mount();
        context.requestRender();
      },
      destroy(): void {
        context.group.removeAll();
      }
    };
  }
};

export function cloneCustomStructureSpec(structure: CustomStructureSpec): CustomStructureSpec {
  return {
    ...structure,
    lanes: structure.lanes.map((lane) => ({ ...lane })),
    ports: structure.ports.map((port) => ({ ...port }))
  };
}

function resolveCustomStructure(data: Record<string, unknown> | undefined): CustomStructureSpec {
  const candidate = data?.["structure"];
  if (isCustomStructureSpec(candidate)) {
    return candidate;
  }

  return cloneCustomStructureSpec(SIG_LOCAL_RUNTIME_STRUCTURE);
}

function isCustomStructureSpec(value: unknown): value is CustomStructureSpec {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "lanes" in value &&
    Array.isArray(value.lanes) &&
    "ports" in value &&
    Array.isArray(value.ports)
  );
}

function renderCustomStructurePanel(
  structure: CustomStructureSpec,
  width: number,
  height: number
): Group {
  const group = new Group({ width, height, hittable: false, hitChildren: false });
  const safeWidth = Math.max(width, 120);
  const laneTop = 45;
  const laneHeight = Math.max(46, Math.floor((height - 86) / Math.max(structure.lanes.length, 1)));

  group.add([
    new Rect({ width, height, cornerRadius: 14, fill: "#10231f", stroke: "#34d399", strokeWidth: 1, hittable: false }),
    createLabel("SIG-local structure", 12, 11, 12, "#a7f3d0", 800, undefined, safeWidth - 24),
    createLabel("authored in node.data", 12, 28, 9, "#86efac", 600, "Consolas", safeWidth - 24)
  ]);

  structure.lanes.forEach((lane, index) => {
    const y = laneTop + index * laneHeight;
    const fill = lane.state === "active" ? "#064e3b" : lane.state === "complete" ? "#0f3f33" : "#172554";
    const stroke = lane.state === "active" ? "#f59e0b" : lane.state === "complete" ? "#34d399" : "#60a5fa";
    const barWidth = Math.max(20, Math.round((safeWidth - 112) * lane.weight / 100));

    group.add([
      new Rect({ x: 12, y, width: safeWidth - 24, height: laneHeight - 8, cornerRadius: 10, fill, stroke, strokeWidth: 1, hittable: false }),
      createLabel(lane.title, 23, y + 9, 12, "#ecfdf5", 800, undefined, Math.max(48, safeWidth - 150)),
      createLabel(lane.state, safeWidth - 78, y + 9, 10, "#d1fae5", 600, "Consolas", 62),
      new Rect({ x: 23, y: y + laneHeight - 22, width: safeWidth - 112, height: 7, cornerRadius: 4, fill: "#02061780", hittable: false }),
      new Rect({ x: 23, y: y + laneHeight - 22, width: barWidth, height: 7, cornerRadius: 4, fill: stroke, hittable: false })
    ]);
  });

  const portsText = structure.ports
    .map((port) => `${port.direction === "input" ? "in" : "out"}:${port.name}`)
    .join("  ");
  group.add(createLabel(portsText, 12, Math.max(52, height - 27), 10, "#bbf7d0", 600, "Consolas", safeWidth - 24));

  return group;
}

function createLabel(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  fontWeight = 500,
  fontFamily = "Inter, Segoe UI, Arial",
  width?: number
): Text {
  const label = new Text({
    x,
    y,
    text,
    fill,
    fontSize,
    fontWeight,
    fontFamily,
    width,
    hittable: false
  });

  if (width !== undefined) {
    label.textWrap = "none";
    label.textOverflow = "...";
  }

  return label;
}