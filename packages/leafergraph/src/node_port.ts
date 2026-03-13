import type { NodeRuntimeState, SlotDirection } from "@leafergraph/node";
import type { NodeShellLayoutMetrics } from "./node_layout";

/**
 * 节点端口及其标签的布局结果。
 * 渲染层与连线路由层都应复用它，避免出现两套端口坐标规则。
 */
export interface NodeShellPortLayout {
  direction: SlotDirection;
  index: number;
  label: string;
  portX: number;
  portY: number;
  portWidth: number;
  portHeight: number;
  labelX: number;
  labelY: number;
  labelWidth?: number;
  textAlign?: "left" | "right";
  anchorY: number;
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
type NodePortSource = Pick<NodeRuntimeState, "layout" | "inputs" | "outputs">;

/** 提取输入槽位展示文案，空节点时回退到最小默认值。 */
export function resolveNodeInputLabels(node: Pick<NodeRuntimeState, "inputs">): string[] {
  return node.inputs.length
    ? node.inputs.map((input) => input.label ?? input.name)
    : ["Input"];
}

/** 提取输出槽位展示文案，空节点时回退到最小默认值。 */
export function resolveNodeOutputLabels(node: Pick<NodeRuntimeState, "outputs">): string[] {
  return node.outputs.length
    ? node.outputs.map((output) => output.label ?? output.name)
    : ["Output"];
}

/** 计算端口布局所需的统一槽位数。 */
export function resolveNodePortSlotCount(
  inputs: string[],
  outputs: string[]
): number {
  return Math.max(inputs.length, outputs.length, 1);
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
  const slotCount = resolveNodePortSlotCount(inputs, outputs);
  const slotStartY = metrics.headerHeight + metrics.sectionPaddingY;
  const ports: NodeShellPortLayout[] = [];

  for (let index = 0; index < inputs.length; index += 1) {
    const slotY = slotStartY + index * (metrics.slotRowHeight + metrics.slotRowGap);
    const anchorY = slotY + metrics.slotRowHeight / 2;

    ports.push({
      direction: "input",
      index,
      label: inputs[index],
      portX: -metrics.portSize / 2,
      portY: anchorY - metrics.portSize / 2,
      portWidth: metrics.portSize,
      portHeight: metrics.portSize,
      labelX: metrics.sectionPaddingX,
      labelY: slotY + 4,
      textAlign: "left",
      anchorY
    });
  }

  for (let index = 0; index < outputs.length; index += 1) {
    const slotY = slotStartY + index * (metrics.slotRowHeight + metrics.slotRowGap);
    const anchorY = slotY + metrics.slotRowHeight / 2;

    ports.push({
      direction: "output",
      index,
      label: outputs[index],
      portX: width - metrics.portSize / 2,
      portY: anchorY - metrics.portSize / 2,
      portWidth: metrics.portSize,
      portHeight: metrics.portSize,
      labelX: width - metrics.sectionPaddingX - metrics.slotTextWidth,
      labelY: slotY + 4,
      labelWidth: metrics.slotTextWidth,
      textAlign: "right",
      anchorY
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
  const width = node.layout.width ?? metrics.defaultNodeWidth;
  const { slotCount, ports } = resolveNodePortsLayout(node, width, metrics);

  return (
    findNodePortLayout(ports, direction, slotIndex)?.anchorY ??
    resolveNodePortAnchorY(slotCount, slotIndex, metrics)
  );
}
