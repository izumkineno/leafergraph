import {
  BaseNode,
  defineAuthoringNode,
  type DevNodeContext
} from "@leafergraph/authoring";

import {
  AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT,
  AUTHORING_NODE_TEMPLATE_NODE_WIDTH,
  AUTHORING_NODE_TEMPLATE_WATCH_LOCAL_TYPE,
  AUTHORING_NODE_TEMPLATE_WATCH_WIDGET_NAME
} from "../shared";

/**
 * 把 number 格式化成适合节点内展示的短文本。
 *
 * 这里刻意保留三位小数以内，
 * 避免 `Watch` 节点在演示时出现过长浮点串。
 */
function formatWatchNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  return value.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * 把任意输入值转成适合节点内 readout 的文本。
 *
 * 这是 `WatchNode` 的核心体验函数：
 * - `undefined` 显示为 `EMPTY`
 * - 基础类型直接转文本
 * - 数组和对象尽量做短格式展示
 */
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

/**
 * 最小观察节点。
 *
 * 它的作用是演示：
 * - 通用输入类型 `0`
 * - 节点内部只读文字 Widget
 * - 执行后把值同步到标题、状态和 Widget
 */
export class WatchNode extends BaseNode {
  static meta = {
    type: AUTHORING_NODE_TEMPLATE_WATCH_LOCAL_TYPE,
    title: "Watch",
    description: "通过节点内部只读文本 Widget 观察最近一次输入值。",
    size: [
      AUTHORING_NODE_TEMPLATE_NODE_WIDTH,
      AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT
    ] as [number, number],
    resize: {
      enabled: true,
      minWidth: AUTHORING_NODE_TEMPLATE_NODE_WIDTH,
      minHeight: AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT,
      snap: 4
    },
    inputs: [{ name: "Value", type: 0 as const }],
    properties: [
      { name: "subtitle", type: "string", default: "等待输入" },
      { name: "status", type: "string", default: "WAITING" }
    ],
    widgets: [
      {
        type: "string",
        name: AUTHORING_NODE_TEMPLATE_WATCH_WIDGET_NAME,
        value: "EMPTY",
        options: {
          label: "Watch Text",
          description: "通过正式只读文本 Widget 显示最近一次输入值",
          readOnly: true
        }
      }
    ]
  };

  /** 创建节点时先写入默认 Widget 文案。 */
  onCreate(ctx: DevNodeContext) {
    ctx.setWidget(AUTHORING_NODE_TEMPLATE_WATCH_WIDGET_NAME, "EMPTY");
  }

  /** 每次执行时，把最新输入同步到节点内部展示区域。 */
  onExecute(ctx: DevNodeContext) {
    const inputValue = ctx.getInputAt(0);
    const displayText = formatWatchValue(inputValue);

    ctx.setWidget(AUTHORING_NODE_TEMPLATE_WATCH_WIDGET_NAME, displayText);
    ctx.setProp("subtitle", "通过节点内部文字 Widget 显示最近输入");
    ctx.setProp(
      "status",
      displayText === "EMPTY" ? "WAITING" : `VALUE ${displayText}`
    );
    ctx.node.title =
      displayText === "EMPTY" ? "Watch" : `Watch ${displayText}`;
  }
}

/** `WatchNode` 对应的正式节点定义。 */
export const watchNodeDefinition = defineAuthoringNode(WatchNode);
