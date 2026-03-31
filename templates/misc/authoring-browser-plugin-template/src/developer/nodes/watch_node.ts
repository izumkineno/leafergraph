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

/**
 * 把 number 格式化成适合节点内展示的短文本。
 *
 * 这里刻意保留三位小数以内，
 * 避免 `Watch` 节点在演示时出现过长浮点串。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
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
 *
 * @param value - 当前值。
 * @param depth - `depth`。
 * @returns 处理后的结果。
 */
function formatWatchValue(value: unknown, depth = 0): string {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
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
      // 再按当前规则组合结果，并把派生数据一并收口到输出里。
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
 * - 节点内部自定义文字 Widget
 * - 执行后把值同步到标题、状态和 Widget
 */
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

  /**
   *  创建节点时先写入默认 Widget 文案。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onCreate(ctx: DevNodeContext) {
    ctx.setWidget(AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME, "EMPTY");
  }

  /**
   *  每次执行时，把最新输入同步到节点内部展示区域。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
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

/** `WatchNode` 对应的正式节点定义。 */
export const watchNodeDefinition = defineAuthoringNode(WatchNode);
