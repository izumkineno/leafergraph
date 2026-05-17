import type {
  LeaferGraphNodePlugin,
  LeaferGraphWidgetRendererContext
} from "@leafergraph/core/contracts";
import type { NodeDefinition } from "@leafergraph/core/node";
import { Group, Rect, Text } from "leafer-ui";

import {
  CONFIG_NODE_TYPE,
  DASHBOARD_NODE_TYPE,
  SHOWCASE_WIDGET_TYPE,
  SMALL_GRAPH_NODE_DEFINITIONS,
  TRANSFORM_NODE_TYPE
} from "./node_definitions";

/**
 * Custom node renderers for the showcase nodes.
 * The visual panel is a first-class widget, so it lives inside each node's widgetLayer.
 */

type RenderConfig = {
  type: string;
  render(options: NativeNodeRenderOptions): Group;
};

type NativeNodeRenderOptions = {
  data: Record<string, unknown>;
  width: number;
  height: number;
};

export const CUSTOM_NODE_STYLES = {
  [DASHBOARD_NODE_TYPE]: {
    bgColor: "rgba(15, 118, 168, 0.15)",
    borderColor: "#0f76a8",
    accentColor: "#06b6d4",
    shape: "rounded-square"
  },
  [CONFIG_NODE_TYPE]: {
    bgColor: "rgba(168, 85, 247, 0.12)",
    borderColor: "#a855f7",
    accentColor: "#f97316",
    shape: "diamond"
  },
  [TRANSFORM_NODE_TYPE]: {
    bgColor: "rgba(20, 184, 166, 0.14)",
    borderColor: "#14b8a6",
    accentColor: "#facc15",
    shape: "pipeline"
  }
};

export const DASHBOARD_RENDER_CONFIG = {
  type: DASHBOARD_NODE_TYPE,
  render: ({ data, width, height }: NativeNodeRenderOptions): Group => {
    const progress = normalizePercent(data.progress, 72);
    const group = createOverlayGroup(width, height);
    const metricWidth = Math.max(40, Math.floor((width - 27) / 2));
    const metricTop = Math.max(82, height - 38);

    group.add([
      createPanel(width, height, "#0e3a4a", "#06b6d4"),
      createLabel("Dashboard", 10, 10, 12, "#67e8f9", 800),
      new Rect({ x: width - 22, y: 13, width: 8, height: 8, cornerRadius: 4, fill: "#34d399", hittable: false }),
      createLabel("Load", 10, 43, 10, "#bae6fd"),
      createLabel(`${progress}%`, width - 58, 36, 22, "#22d3ee", 800),
      new Rect({ x: 10, y: 67, width: width - 20, height: 9, cornerRadius: 5, fill: "#083047", stroke: "#7dd3fc30", strokeWidth: 1, hittable: false }),
      new Rect({ x: 10, y: 67, width: Math.round((width - 20) * progress / 100), height: 9, cornerRadius: 5, fill: "#22d3ee", hittable: false }),
      createMetricBox(10, metricTop, metricWidth, "Response", formatText(data.metric, "96.5 ms"), "#67e8f9"),
      createMetricBox(Math.ceil(width / 2) + 4, metricTop, metricWidth, "Status", formatText(data.message, "Healthy"), "#bbf7d0")
    ]);

    return group;
  }
};

export const CONFIG_RENDER_CONFIG = {
  type: CONFIG_NODE_TYPE,
  render: ({ data, width, height }: NativeNodeRenderOptions): Group => {
    const group = createOverlayGroup(width, height);
    const params = normalizeParams(data.params);
    const buttonTop = Math.max(101, height - 29);

    group.add([
      createPanel(width, height, "#32124f", "#a855f7"),
      createLabel("Settings", 10, 10, 12, "#d8b4fe", 800),
      createLabel("advanced", width - 66, 12, 10, "#fed7aa")
    ]);

    params.slice(0, 2).forEach((param, index) => {
      const y = 39 + index * 30;
      group.add([
        new Rect({ x: 10, y, width: width - 20, height: 23, cornerRadius: 8, fill: "#02061766", stroke: "#a855f73d", strokeWidth: 1, hittable: false }),
        createLabel(param.key, 18, y + 7, 10, "#d8b4fe", 700),
        createLabel(String(param.value), width - 74, y + 7, 10, "#fdba74", 600, "Consolas")
      ]);
    });

    group.add([
      new Rect({ x: 10, y: buttonTop, width: width - 20, height: 21, cornerRadius: 8, fill: "#a855f7", stroke: "#f97316", strokeWidth: 1, hittable: false }),
      createLabel("Edit Config", Math.round(width / 2) - 31, buttonTop + 5, 11, "#ffffff", 800)
    ]);

    return group;
  }
};

export const TRANSFORM_RENDER_CONFIG = {
  type: TRANSFORM_NODE_TYPE,
  render: ({ data, width, height }: NativeNodeRenderOptions): Group => {
    const group = createOverlayGroup(width, height);
    const rules = normalizeRules(data.rules);
    const visibleRules = rules.slice(0, height >= 132 ? 3 : 2);

    group.add([
      createPanel(width, height, "#0f3f3d", "#14b8a6"),
      createLabel("Transform", 10, 10, 12, "#5eead4", 800),
      new Rect({ x: width - 30, y: 7, width: 20, height: 20, cornerRadius: 10, fill: "#facc152e", stroke: "#facc1580", strokeWidth: 1, hittable: false }),
      createLabel(String(data.warnings ?? 0), width - 23, 12, 11, "#fde68a", 800)
    ]);

    visibleRules.forEach((rule, index) => {
      const y = 36 + index * 25;
      group.add([
        new Rect({ x: 10, y, width: width - 20, height: 19, cornerRadius: 7, fill: "#02061766", stroke: "#14b8a638", strokeWidth: 1, hittable: false }),
        createLabel(truncateMiddle(rule.from, 18), 17, y + 5, 9, "#99f6e4", 500, "Consolas"),
        createLabel("→", Math.round(width / 2) - 4, y + 4, 11, "#facc15", 800),
        createLabel(truncateMiddle(rule.to, 18), Math.round(width / 2) + 15, y + 5, 9, "#fde68a", 500, "Consolas")
      ]);
    });

    const preview = JSON.stringify(data.preview ?? {}, null, 2).split("\n").slice(0, 4);
    const previewTop = 36 + visibleRules.length * 25 + 8;
    const previewHeight = Math.max(18, height - previewTop - 8);
    group.add(new Rect({ x: 10, y: previewTop, width: width - 20, height: previewHeight, cornerRadius: 7, fill: "#0206177a", stroke: "#14b8a633", strokeWidth: 1, hittable: false }));
    preview.forEach((line, index) => {
      group.add(createLabel(line, 18, previewTop + 8 + index * 11, 9, "#ccfbf1", 500, "Consolas"));
    });

    return group;
  }
};

export const smallInteractiveGraphShowcaseWidget = {
  type: SHOWCASE_WIDGET_TYPE,
  title: "Custom Showcase Panel",
  description: "Native Leafer panel embedded inside a node widget layer.",
  renderer(context: LeaferGraphWidgetRendererContext) {
    const renderConfig = NODE_RENDER_CONFIGS.get(context.node.type);

    if (!renderConfig) {
      return;
    }

    const mount = (): Group => {
      context.group.removeAll();
      const panel = renderConfig.render({
        data: (context.node.data ?? {}) as Record<string, unknown>,
        width: context.bounds.width,
        height: context.bounds.height
      });

      panel.name = `custom-native-${context.node.id}`;
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

export const smallInteractiveGraphShowcasePlugin: LeaferGraphNodePlugin = {
  name: "small-interactive-graph-showcase",
  version: "0.0.0",
  install(context) {
    context.registerWidget(smallInteractiveGraphShowcaseWidget, { overwrite: true });
    for (const definition of SMALL_GRAPH_NODE_DEFINITIONS) {
      context.registerNode(definition as NodeDefinition, { overwrite: true });
    }
  }
};

const NODE_RENDER_CONFIGS = new Map<string, RenderConfig>([
  [DASHBOARD_NODE_TYPE, DASHBOARD_RENDER_CONFIG],
  [CONFIG_NODE_TYPE, CONFIG_RENDER_CONFIG],
  [TRANSFORM_NODE_TYPE, TRANSFORM_RENDER_CONFIG]
]);

function createOverlayGroup(width: number, height: number): Group {
  return new Group({
    width,
    height,
    hittable: false,
    hitChildren: false
  });
}

function createPanel(width: number, height: number, fill: string, stroke: string): Rect {
  return new Rect({
    width,
    height,
    cornerRadius: 12,
    fill,
    stroke,
    strokeWidth: 1,
    hittable: false
  });
}

function createLabel(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  fontWeight = 500,
  fontFamily = "Inter, Segoe UI, Arial"
): Text {
  return new Text({
    x,
    y,
    text,
    fill,
    fontSize,
    fontWeight,
    fontFamily,
    hittable: false
  });
}

function createMetricBox(x: number, y: number, width: number, label: string, value: string, valueColor: string): Group {
  const group = new Group({ x, y, width, height: 28, hittable: false, hitChildren: false });

  group.add([
    new Rect({ width, height: 28, cornerRadius: 8, fill: "#0206175c", hittable: false }),
    createLabel(label, 6, 4, 9, "#bae6fd"),
    createLabel(value, 6, 16, 10, valueColor, 800)
  ]);

  return group;
}

function normalizeParams(value: unknown): Array<{ key: string; value: string | number }> {
  return Array.isArray(value)
    ? value.filter((entry): entry is { key: string; value: string | number } =>
        typeof entry === "object" &&
        entry !== null &&
        "key" in entry &&
        typeof entry.key === "string" &&
        "value" in entry &&
        (typeof entry.value === "string" || typeof entry.value === "number")
      )
    : [];
}

function normalizeRules(value: unknown): Array<{ from: string; to: string }> {
  return Array.isArray(value)
    ? value.filter((entry): entry is { from: string; to: string } =>
        typeof entry === "object" &&
        entry !== null &&
        "from" in entry &&
        typeof entry.from === "string" &&
        "to" in entry &&
        typeof entry.to === "string"
      )
    : [];
}

function normalizePercent(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

function formatText(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const side = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, side)}...${value.slice(-side)}`;
}