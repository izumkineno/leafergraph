import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetBounds } from "./plugin";
import type { NodeShellPortLayout } from "./node_port";
import { resolveNodePortsLayout } from "./node_port";

/**
 * 节点壳布局所需的全部度量参数。
 * 这一层只关心尺寸与坐标，不关心具体颜色、描边或交互状态。
 */
export interface NodeShellLayoutMetrics {
  defaultNodeWidth: number;
  defaultNodeMinHeight: number;
  headerHeight: number;
  sectionPaddingX: number;
  sectionPaddingY: number;
  slotRowHeight: number;
  slotRowGap: number;
  portSize: number;
  widgetHeight: number;
  categoryPillHeight: number;
  categoryPillMinWidth: number;
  categoryCharWidth: number;
  slotTextWidth: number;
}

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
  bounds: LeaferGraphWidgetBounds;
}

/**
 * 整个节点壳的结构化布局结果。
 * 当前阶段主要服务主包渲染层，后续也可供命中、覆盖层和自动测试复用。
 */
export interface NodeShellLayout {
  width: number;
  height: number;
  slotCount: number;
  slotStartY: number;
  slotsHeight: number;
  widgetTop: number;
  widgetSectionHeight: number;
  hasWidgets: boolean;
  inputs: string[];
  outputs: string[];
  ports: NodeShellPortLayout[];
  widgets: NodeShellWidgetLayout[];
}

/**
 * 当前布局模块只依赖节点运行时状态中的结构字段。
 * 它不需要知道节点定义注册表、颜色或交互状态。
 */
type NodeLayoutSource = Pick<NodeRuntimeState, "layout" | "inputs" | "outputs" | "widgets">;

/** 计算槽位区域高度。 */
export function resolveNodeSlotsHeight(
  slotCount: number,
  metrics: NodeShellLayoutMetrics
): number {
  if (slotCount <= 1) {
    return metrics.slotRowHeight;
  }

  return (
    slotCount * metrics.slotRowHeight +
    (slotCount - 1) * metrics.slotRowGap
  );
}

/** 计算 Widget 区总高度。 */
export function resolveNodeWidgetSectionHeight(
  widgetCount: number,
  metrics: NodeShellLayoutMetrics
): number {
  return widgetCount * metrics.widgetHeight;
}

/** 计算 Widget 区起始 Y。 */
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
 * 统一计算节点壳布局结果。
 * 当前不包含颜色、字体和交互态，只输出纯几何信息。
 */
export function resolveNodeShellLayout(
  node: NodeLayoutSource,
  metrics: NodeShellLayoutMetrics
): NodeShellLayout {
  const width = node.layout.width ?? metrics.defaultNodeWidth;
  const { inputs, outputs, slotCount, slotStartY, ports } =
    resolveNodePortsLayout(node, width, metrics);
  const slotsHeight = resolveNodeSlotsHeight(slotCount, metrics);
  const widgetSectionHeight = resolveNodeWidgetSectionHeight(
    node.widgets.length,
    metrics
  );
  const widgetTop = resolveNodeWidgetTop(slotCount, metrics);
  const height = Math.max(
    node.layout.height ?? 0,
    metrics.headerHeight +
      metrics.sectionPaddingY +
      slotsHeight +
      metrics.sectionPaddingY +
      widgetSectionHeight,
    metrics.defaultNodeMinHeight
  );

  return {
    width,
    height,
    slotCount,
    slotStartY,
    slotsHeight,
    widgetTop,
    widgetSectionHeight,
    hasWidgets: node.widgets.length > 0,
    inputs,
    outputs,
    ports,
    widgets: node.widgets.map((_, index) => ({
      index,
      bounds: {
        x: metrics.sectionPaddingX,
        y: widgetTop + index * metrics.widgetHeight,
        width: width - metrics.sectionPaddingX * 2,
        height: metrics.widgetHeight
      }
    }))
  };
}
