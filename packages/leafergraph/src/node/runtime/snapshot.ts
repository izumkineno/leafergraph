/**
 * 节点运行时快照 helper。
 *
 * @remarks
 * 负责节点序列化快照、检查面板快照和可读值克隆。
 */

import {
  serializeNode,
  type NodeSerializeResult,
  type NodeSlotSpec
} from "@leafergraph/node";
import type {
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeIoValueEntry
} from "@leafergraph/contracts";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphNodeRuntimeContext,
  LeaferGraphRuntimeNodeViewState
} from "./types";

/**
 * 获取节点快照。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 可序列化节点快照。
 */
export function getLeaferGraphNodeSnapshot<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): NodeSerializeResult | undefined {
  const node = context.options.graphNodes.get(nodeId);
  if (!node) {
    return undefined;
  }

  return serializeNode(context.options.nodeRegistry, node);
}

/**
 * 获取节点检查面板状态。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点检查快照。
 */
export function getLeaferGraphNodeInspectorState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): LeaferGraphNodeInspectorState | undefined {
  const node = context.options.graphNodes.get(nodeId);
  if (!node) {
    return undefined;
  }

  return {
    id: node.id,
    type: node.type,
    title: node.title,
    layout: cloneReadableValue(node.layout),
    flags: cloneReadableValue(node.flags),
    properties: cloneReadableValue(node.properties),
    data: cloneReadableValue(node.data),
    inputs: createNodeIoValueEntries(node.inputs, node.inputValues),
    outputs: createNodeIoValueEntries(node.outputs, node.outputValues),
    executionState: context.nodeExecutionHost.getNodeExecutionState(nodeId) ?? {
      status: "idle",
      runCount: 0
    }
  };
}

/**
 * 把节点输入输出值转换成检查面板可读结构。
 *
 * @param slots - 节点槽位定义。
 * @param values - 当前槽位值列表。
 * @returns IO 值条目列表。
 */
export function createNodeIoValueEntries(
  slots: readonly NodeSlotSpec[],
  values: readonly unknown[]
): LeaferGraphNodeIoValueEntry[] {
  return slots.map((slot, index) => ({
    slot: index,
    name: slot.name,
    label: slot.label,
    type: slot.type,
    value: cloneReadableValue(values[index])
  }));
}

/**
 * 克隆可读值，避免检查面板把运行时对象引用直接暴露出去。
 *
 * @param value - 原始值。
 * @returns 尽量深拷贝后的值。
 */
export function cloneReadableValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

