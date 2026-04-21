/**
 * 节点壳布局模块。
 *
 * @remarks
 * 负责节点外壳、端口区和 Widget 区的尺寸与坐标计算。
 */

import type { NodeRuntimeState, NodeWidgetType } from "@leafergraph/core/node";
import type { LeaferGraphWidgetBounds } from "@leafergraph/core/contracts";
export type { NodeShellLayoutMetrics } from "@leafergraph/core/theme";
import type { NodeShellLayoutMetrics } from "@leafergraph/core/theme";
import type { NodeShellPortLayout } from "./ports";
import { resolveNodePortsLayout } from "./ports";

/**
 * 节点分类徽标的布局结果。
 */
export interface NodeShellCategoryLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  text: string;
}

/**
 * 单个 Widget 的布局结果。
 */
export interface NodeShellWidgetLayout {
  index: number;
  preferredHeight: number;
  bounds: LeaferGraphWidgetBounds;
}

/**
 * 整个节点壳的结构化布局结果。
 * 当前阶段主要服务主包渲染层，后续也可供命中、覆盖层和自动测试复用。
 */
export interface NodeShellLayout {
  width: number;
  height: number;
  collapsed: boolean;
  slotCount: number;
  slotStartY: number;
  slotsHeight: number;
  widgetTop: number;
  widgetSectionHeight: number;
  hasWidgets: boolean;
  widgetBounds: LeaferGraphWidgetBounds;
  widgetGap: number;
  widgetPaddingY: number;
  inputs: string[];
  outputs: string[];
  ports: NodeShellPortLayout[];
  widgets: NodeShellWidgetLayout[];
}

interface ResolvedNodeWidgetLayouts {
  widgetBounds: LeaferGraphWidgetBounds;
  layouts: NodeShellWidgetLayout[];
}

/**
 * 当前布局模块只依赖节点运行时状态中的结构字段。
 * 它不需要知道节点定义注册表、颜色或交互状态。
 */
type NodeLayoutSource = Pick<
  NodeRuntimeState,
  "layout" | "inputs" | "outputs" | "widgets" | "flags"
>;

/**
 * 计算槽位区域高度。
 *
 * @param slotCount - 槽位数量。
 * @param metrics - 节点布局度量。
 * @returns 槽位区域高度。
 */
export function resolveNodeSlotsHeight(
  slotCount: number,
  metrics: NodeShellLayoutMetrics
): number {
  if (slotCount <= 0) {
    return 0;
  }

  if (slotCount <= 1) {
    return metrics.slotRowHeight;
  }

  return (
    slotCount * metrics.slotRowHeight +
    (slotCount - 1) * metrics.slotRowGap
  );
}

/**
 * 计算单个 Widget 的首选高度。
 *
 * @param widget - 目标 Widget。
 * @param metrics - 节点布局度量。
 * @returns Widget 首选高度。
 */
export function resolveNodeWidgetPreferredHeight(
  widget: NodeLayoutSource["widgets"][number],
  metrics: NodeShellLayoutMetrics
): number {
  if (!isKnownNodeWidgetHeightType(widget.type)) {
    return metrics.widgetHeight;
  }

  return nodeWidgetHeightResolvers[widget.type](widget, metrics);
}

type NodeWidgetHeightResolver = (
  widget: NodeLayoutSource["widgets"][number],
  metrics: NodeShellLayoutMetrics
) => number;

type KnownNodeWidgetHeightType =
  | "toggle"
  | "slider"
  | "textarea"
  | "radio"
  | "input"
  | "select"
  | "button"
  | "checkbox";

/**
 * 判断当前 widget 类型是否使用内建的高度解析器。
 *
 * @param type - Widget 类型。
 * @returns 是否命中已知高度解析器。
 */
function isKnownNodeWidgetHeightType(
  type: NodeWidgetType
): type is KnownNodeWidgetHeightType {
  return type in nodeWidgetHeightResolvers;
}

/**
 * 解析 `toggle` widget 的首选高度。
 *
 * @param _widget - 目标 Widget。
 * @param _metrics - 节点布局度量。
 * @returns `toggle` 的首选高度。
 */
function resolveToggleWidgetPreferredHeight(
  _widget: NodeLayoutSource["widgets"][number],
  _metrics: NodeShellLayoutMetrics
): number {
  return 60;
}

/**
 * 解析 `slider` widget 的首选高度。
 *
 * @param _widget - 目标 Widget。
 * @param _metrics - 节点布局度量。
 * @returns `slider` 的首选高度。
 */
function resolveSliderWidgetPreferredHeight(
  _widget: NodeLayoutSource["widgets"][number],
  _metrics: NodeShellLayoutMetrics
): number {
  return 64;
}

/**
 * 解析 `textarea` widget 的首选高度。
 *
 * @param widget - 目标 Widget。
 * @param _metrics - 节点布局度量。
 * @returns `textarea` 的首选高度。
 */
function resolveTextareaWidgetPreferredHeight(
  widget: NodeLayoutSource["widgets"][number],
  _metrics: NodeShellLayoutMetrics
): number {
  const widgetOptions = widget.options ?? {};
  return Math.max(92, 36 + Math.max(Number(widgetOptions["rows"]) || 3, 2) * 22);
}

/**
 * 解析 `radio` widget 的首选高度。
 *
 * @param widget - 目标 Widget。
 * @param _metrics - 节点布局度量。
 * @returns `radio` 的首选高度。
 */
function resolveRadioWidgetPreferredHeight(
  widget: NodeLayoutSource["widgets"][number],
  _metrics: NodeShellLayoutMetrics
): number {
  const widgetOptions = widget.options ?? {};
  const items = Array.isArray(widgetOptions["items"])
    ? widgetOptions["items"].length
    : 0;
  const count = Math.max(items, 1);
  return Math.max(88, 40 + count * 28 + Math.max(count - 1, 0) * 6);
}

/**
 * 解析输入控件类 widget 的统一首选高度。
 *
 * @param _widget - 目标 Widget。
 * @param _metrics - 节点布局度量。
 * @returns 输入控件类 widget 的首选高度。
 */
function resolveCompactWidgetPreferredHeight(
  _widget: NodeLayoutSource["widgets"][number],
  _metrics: NodeShellLayoutMetrics
): number {
  return 58;
}

const nodeWidgetHeightResolvers = {
  toggle: resolveToggleWidgetPreferredHeight,
  slider: resolveSliderWidgetPreferredHeight,
  textarea: resolveTextareaWidgetPreferredHeight,
  radio: resolveRadioWidgetPreferredHeight,
  input: resolveCompactWidgetPreferredHeight,
  select: resolveCompactWidgetPreferredHeight,
  button: resolveCompactWidgetPreferredHeight,
  checkbox: resolveCompactWidgetPreferredHeight
} satisfies Record<KnownNodeWidgetHeightType, NodeWidgetHeightResolver>;

/**
 * 计算 Widget 区总高度。
 *
 * @param widgets - Widget 列表。
 * @param metrics - 节点布局度量。
 * @returns Widget 区总高度。
 */
export function resolveNodeWidgetSectionHeight(
  widgets: NodeLayoutSource["widgets"],
  metrics: NodeShellLayoutMetrics
): number {
  if (!widgets.length) {
    return 0;
  }

  return (
    metrics.widgetPaddingY * 2 +
    widgets.reduce(
      (total, widget) => total + resolveNodeWidgetPreferredHeight(widget, metrics),
      0
    ) +
    metrics.widgetGap * (widgets.length - 1)
  );
}

/**
 * 计算 Widget 区起始 Y。
 *
 * @param slotCount - 槽位数量。
 * @param metrics - 节点布局度量。
 * @returns Widget 区起始 Y。
 */
export function resolveNodeWidgetTop(
  slotCount: number,
  metrics: NodeShellLayoutMetrics
): number {
  return (
    metrics.headerHeight +
    metrics.sectionPaddingY +
    resolveNodeSlotsHeight(slotCount, metrics) +
    metrics.sectionPaddingY
  );
}

/**
 * 计算分类徽标布局。
 * 当前仍保留原有“字符宽度近似估算”的轻量方案，避免引入文本测量成本。
 *
 * @param category - 分类。
 * @param width - 节点宽度。
 * @param metrics - 节点布局度量。
 * @returns 分类徽标布局。
 */
export function resolveNodeCategoryBadgeLayout(
  category: string,
  width: number,
  metrics: NodeShellLayoutMetrics
): NodeShellCategoryLayout {
  const text = category.toUpperCase();
  const badgeWidth = Math.max(
    metrics.categoryPillMinWidth,
    Math.round(category.length * metrics.categoryCharWidth + 24)
  );
  const x = width - badgeWidth - 16;

  return {
    x,
    y: 12,
    width: badgeWidth,
    height: metrics.categoryPillHeight,
    labelX: x + 12,
    labelY: 16,
    text
  };
}

/**
 * 计算节点内每个 Widget 的最终布局。
 *
 * @remarks
 * 当节点被手动拉高后，Widget 图层的可用高度会变大；
 * 这里会把多出来的空间优先分配给最后一个 Widget，
 * 避免像 Watch 这类展示型面板仍然停留在固定高度，底部留下大块空白。
 *
 * @param widgets - Widget 列表。
 * @param width - 节点宽度。
 * @param widgetTop - Widget 区起始 Y。
 * @param totalHeight - 当前节点总高度。
 * @param metrics - 节点布局度量。
 * @returns Widget 区布局结果。
 */
function resolveNodeWidgetLayouts(
  widgets: NodeLayoutSource["widgets"],
  width: number,
  widgetTop: number,
  totalHeight: number,
  metrics: NodeShellLayoutMetrics
): ResolvedNodeWidgetLayouts {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const widgetBounds: LeaferGraphWidgetBounds = {
    x: metrics.sectionPaddingX,
    y: widgetTop,
    width: width - metrics.sectionPaddingX * 2,
    height: Math.max(0, totalHeight - widgetTop)
  };

  if (!widgets.length) {
    return {
      widgetBounds,
      layouts: []
    };
  }

  const preferredHeights = widgets.map((widget) =>
    resolveNodeWidgetPreferredHeight(widget, metrics)
  );
  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  const preferredTotalHeight = preferredHeights.reduce(
    (total, height) => total + height,
    0
  );
  const availableContentHeight = Math.max(
    0,
    widgetBounds.height -
      metrics.widgetPaddingY * 2 -
      metrics.widgetGap * Math.max(0, widgets.length - 1)
  );
  const extraHeight = Math.max(0, availableContentHeight - preferredTotalHeight);

  const layouts = widgets.map((_, index) => {
    const isLastWidget = index === widgets.length - 1;
    const height = preferredHeights[index] + (isLastWidget ? extraHeight : 0);

    return {
      index,
      preferredHeight: preferredHeights[index],
      bounds: {
        x: 0,
        y: 0,
        width: widgetBounds.width,
        height
      }
    };
  });

  return {
    widgetBounds,
    layouts
  };
}

/**
 * 统一计算节点壳布局结果。
 * 当前不包含颜色、字体和交互态，只输出纯几何信息。
 *
 * @param node - 节点。
 * @param metrics - 节点布局度量。
 * @returns 节点壳几何布局。
 */
export function resolveNodeShellLayout(
  node: NodeLayoutSource,
  metrics: NodeShellLayoutMetrics
): NodeShellLayout {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const width = node.layout.width ?? metrics.defaultNodeWidth;
  const collapsed = Boolean(node.flags.collapsed);
  const { inputs, outputs, slotCount, slotStartY, ports } =
    resolveNodePortsLayout(node, width, metrics);
  const slotsHeight = collapsed ? 0 : resolveNodeSlotsHeight(slotCount, metrics);
  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  const widgetSectionHeight = collapsed
    ? 0
    : resolveNodeWidgetSectionHeight(node.widgets, metrics);
  const widgetTop = collapsed
    ? metrics.headerHeight
    : resolveNodeWidgetTop(slotCount, metrics);
  const height = collapsed
    ? metrics.headerHeight
    : Math.max(
        node.layout.height ?? 0,
        metrics.headerHeight +
          metrics.sectionPaddingY +
          slotsHeight +
          metrics.sectionPaddingY +
          widgetSectionHeight,
        metrics.defaultNodeMinHeight
      );
  const { widgetBounds, layouts: widgetLayouts } = resolveNodeWidgetLayouts(
    collapsed ? [] : node.widgets,
    width,
    widgetTop,
    height,
    metrics
  );

  return {
    width,
    height,
    collapsed,
    slotCount,
    slotStartY,
    slotsHeight,
    widgetTop,
    widgetSectionHeight,
    hasWidgets: !collapsed && node.widgets.length > 0,
    widgetBounds,
    widgetGap: metrics.widgetGap,
    widgetPaddingY: metrics.widgetPaddingY,
    inputs,
    outputs,
    ports,
    widgets: widgetLayouts
  };
}
