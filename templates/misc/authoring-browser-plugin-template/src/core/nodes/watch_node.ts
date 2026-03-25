import {
  BaseNode,
  defineAuthoringNode,
  type DevNodeContext
} from "@leafergraph/authoring";

import {
  AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT,
  AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
  AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME,
  AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE,
  AUTHORING_BROWSER_TEMPLATE_WATCH_LOCAL_TYPE
} from "../shared";

function formatWatchNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}

function formatWatchValue(value: unknown, depth = 0): string {
  if (value === undefined) {
    return "EMPTY";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    return formatWatchNumber(value);
  }

  if (
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return "[...]";
    }

    const items = value
      .slice(0, 4)
      .map((item) => formatWatchValue(item, depth + 1));
    const suffix = value.length > 4 ? ", ..." : "";
    return `[${items.join(", ")}${suffix}]`;
  }

  if (typeof value === "object") {
    try {
      const text = JSON.stringify(value);
      return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    } catch {
      return "[Object]";
    }
  }

  return String(value);
}

export class WatchNode extends BaseNode {
  static meta = {
    type: AUTHORING_BROWSER_TEMPLATE_WATCH_LOCAL_TYPE,
    title: "Watch",
    description: "通过自定义文字 Widget 观察最近一次输入值。",
    size: [
      AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
      AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT
    ] as [number, number],
    resize: {
      enabled: true,
      minWidth: AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
      minHeight: AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT,
      snap: 4
    },
    inputs: [{ name: "Value", type: 0 as const }],
    properties: [
      { name: "subtitle", type: "string", default: "等待输入" },
      { name: "status", type: "string", default: "WAITING" }
    ],
    widgets: [
      {
        type: AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE,
        name: AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME,
        value: "EMPTY",
        options: {
          label: "Watch Text",
          description: "通过自定义 Text Readout Widget 展示最近输入值",
          emptyText: "EMPTY"
        }
      }
    ]
  };

  onCreate(ctx: DevNodeContext) {
    ctx.setWidget(AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME, "EMPTY");
  }

  onExecute(ctx: DevNodeContext) {
    const inputValue = ctx.getInputAt(0);
    const displayText = formatWatchValue(inputValue);

    ctx.setWidget(AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME, displayText);
    ctx.setProp("subtitle", "节点内部显示区域由 authoring 自定义 Widget 提供");
    ctx.setProp(
      "status",
      displayText === "EMPTY" ? "WAITING" : `VALUE ${displayText}`
    );
    ctx.node.title =
      displayText === "EMPTY" ? "Watch" : `Watch ${displayText}`;
  }
}

export const watchNodeDefinition = defineAuthoringNode(WatchNode);
