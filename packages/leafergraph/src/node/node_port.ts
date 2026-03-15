/**
 * 节点端口布局模块。
 *
 * @remarks
 * 负责输入输出端口的布局、锚点和几何换算。
 */

import type { NodeRuntimeState, SlotDirection, SlotType } from "@leafergraph/node";
import type { NodeShellLayoutMetrics } from "./node_layout";

/**
 * 节点端口及其标签的布局结果。
 * 渲染层与连线路由层都应复用它，避免出现两套端口坐标规则。
 */
export interface NodeShellPortLayout {
  direction: SlotDirection;
  index: number;
  label: string;
  labelVisible: boolean;
  portX: number;
  portY: number;
  portWidth: number;
  portHeight: number;
  labelX: number;
  labelY: number;
  labelWidth?: number;
  textAlign?: "left" | "right";
  anchorY: number;
  slotType?: SlotType;
  slotColor?: string;
}

/**
 * 某个节点的端口布局汇总结果。
 * 这里额外保留 `inputs / outputs / slotCount / slotStartY`，方便节点壳布局和锚点查询复用。
 */
export interface NodePortsLayoutResult {
  inputs: string[];
  outputs: string[];
  slotCount: number;
  slotStartY: number;
  ports: NodeShellPortLayout[];
}

/**
 * 端口布局当前只依赖节点的结构字段。
 * 不关心属性、颜色、运行时缓存或宿主注册表。
 */
type NodePortSource = Pick<NodeRuntimeState, "layout" | "inputs" | "outputs" | "flags">;

/** 提取输入槽位展示文案。没有真实输入槽位时，不额外制造展示型假端口。 */
export function resolveNodeInputLabels(node: Pick<NodeRuntimeState, "inputs">): string[] {
  return node.inputs.map((input) => input.label ?? input.name);
}

/** 提取输出槽位展示文案。没有真实输出槽位时，不额外制造展示型假端口。 */
export function resolveNodeOutputLabels(node: Pick<NodeRuntimeState, "outputs">): string[] {
  return node.outputs.map((output) => output.label ?? output.name);
}

/** 计算端口布局所需的统一槽位数。 */
export function resolveNodePortSlotCount(
  inputs: string[],
  outputs: string[]
): number {
  return Math.max(inputs.length, outputs.length, 0);
}

/**
 * 计算某个槽位的纵向锚点。
 * 即使节点没有显式槽位，也会稳定回退到第一行默认位置。
 */
export function resolveNodePortAnchorY(
  slotCount: number,
  slotIndex: number,
  metrics: NodeShellLayoutMetrics
): number {
  const safeCount = Math.max(slotCount, 1);
  const safeIndex = Math.min(Math.max(0, slotIndex), safeCount - 1);

  return (
    metrics.headerHeight +
    metrics.sectionPaddingY +
    safeIndex * (metrics.slotRowHeight + metrics.slotRowGap) +
    metrics.slotRowHeight / 2
  );
}

/** 折叠节点时，端口统一吸附到头部中线，形成更紧凑的视觉表达。 */
export function resolveCollapsedNodePortAnchorY(
  metrics: NodeShellLayoutMetrics
): number {
  return metrics.headerHeight / 2;
}

/**
 * 根据节点输入输出，生成完整的端口与标签布局。
 * 节点壳与连线锚点应共享这份计算结果。
 */
export function resolveNodePortsLayout(
  node: NodePortSource,
  width: number,
  metrics: NodeShellLayoutMetrics
): NodePortsLayoutResult {
  const inputs = resolveNodeInputLabels(node);
  const outputs = resolveNodeOutputLabels(node);
  const collapsed = Boolean(node.flags.collapsed);
  const slotCount = collapsed ? 1 : resolveNodePortSlotCount(inputs, outputs);
  const slotStartY = collapsed
    ? resolveCollapsedNodePortAnchorY(metrics)
    : metrics.headerHeight + metrics.sectionPaddingY;
  const ports: NodeShellPortLayout[] = [];

  if (collapsed) {
    const anchorY = resolveCollapsedNodePortAnchorY(metrics);
    const firstInput = node.inputs[0];
    const firstOutput = node.outputs[0];

    if (inputs.length) {
      ports.push({
        direction: "input",
        index: 0,
        label: inputs[0],
        labelVisible: false,
        portX: -metrics.portSize / 2,
        portY: anchorY - metrics.portSize / 2,
        portWidth: metrics.portSize,
        portHeight: metrics.portSize,
        labelX: metrics.sectionPaddingX,
        labelY: anchorY,
        textAlign: "left",
        anchorY,
        slotType: firstInput?.type,
        slotColor: firstInput?.color
      });
    }

    if (outputs.length) {
      ports.push({
        direction: "output",
        index: 0,
        label: outputs[0],
        labelVisible: false,
        portX: width - metrics.portSize / 2,
        portY: anchorY - metrics.portSize / 2,
        portWidth: metrics.portSize,
        portHeight: metrics.portSize,
        labelX: width - metrics.sectionPaddingX - metrics.slotTextWidth,
        labelY: anchorY,
        labelWidth: metrics.slotTextWidth,
        textAlign: "right",
        anchorY,
        slotType: firstOutput?.type,
        slotColor: firstOutput?.color
      });
    }

    return {
      inputs,
      outputs,
      slotCount,
      slotStartY,
      ports
    };
  }

  for (let index = 0; index < inputs.length; index += 1) {
    const slotY = slotStartY + index * (metrics.slotRowHeight + metrics.slotRowGap);
    const anchorY = slotY + metrics.slotRowHeight / 2;
    const slot = node.inputs[index];

    ports.push({
      direction: "input",
      index,
      label: inputs[index],
      labelVisible: true,
      portX: -metrics.portSize / 2,
      portY: anchorY - metrics.portSize / 2,
      portWidth: metrics.portSize,
      portHeight: metrics.portSize,
      labelX: metrics.sectionPaddingX,
      labelY: slotY + 4,
      textAlign: "left",
      anchorY,
      slotType: slot?.type,
      slotColor: slot?.color
    });
  }

  for (let index = 0; index < outputs.length; index += 1) {
    const slotY = slotStartY + index * (metrics.slotRowHeight + metrics.slotRowGap);
    const anchorY = slotY + metrics.slotRowHeight / 2;
    const slot = node.outputs[index];

    ports.push({
      direction: "output",
      index,
      label: outputs[index],
      labelVisible: true,
      portX: width - metrics.portSize / 2,
      portY: anchorY - metrics.portSize / 2,
      portWidth: metrics.portSize,
      portHeight: metrics.portSize,
      labelX: width - metrics.sectionPaddingX - metrics.slotTextWidth,
      labelY: slotY + 4,
      labelWidth: metrics.slotTextWidth,
      textAlign: "right",
      anchorY,
      slotType: slot?.type,
      slotColor: slot?.color
    });
  }

  return {
    inputs,
    outputs,
    slotCount,
    slotStartY,
    ports
  };
}

/** 在端口布局结果中查找某个方向某个索引的端口。 */
export function findNodePortLayout(
  ports: NodeShellPortLayout[],
  direction: SlotDirection,
  slotIndex: number
): NodeShellPortLayout | undefined {
  const safeIndex = Math.max(0, slotIndex);
  return ports.find(
    (port) => port.direction === direction && port.index === safeIndex
  );
}

/**
 * 直接从节点结构解析某个端口锚点。
 * 这是给连线路由使用的快捷入口，内部仍然复用端口布局计算。
 */
export function resolveNodePortAnchorYForNode(
  node: NodePortSource,
  direction: SlotDirection,
  slotIndex: number,
  metrics: NodeShellLayoutMetrics
): number {
  if (node.flags.collapsed) {
    return resolveCollapsedNodePortAnchorY(metrics);
  }

  const width = node.layout.width ?? metrics.defaultNodeWidth;
  const { slotCount, ports } = resolveNodePortsLayout(node, width, metrics);

  return (
    findNodePortLayout(ports, direction, slotIndex)?.anchorY ??
    resolveNodePortAnchorY(slotCount, slotIndex, metrics)
  );
}
