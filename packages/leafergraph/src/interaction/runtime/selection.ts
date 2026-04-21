/**
 * 图交互运行时选区 helper。
 *
 * @remarks
 * 负责把选区相关能力统一代理到 scene / view 侧。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import type { LeaferGraphSelectionUpdateMode } from "@leafergraph/core/contracts";
import type {
  LeaferGraphInteractionRuntimeContext,
  LeaferGraphInteractionRuntimeNodeViewState
} from "./types";

/**
 * 列出当前全部已选节点。
 *
 * @param context - 当前交互运行时上下文。
 * @returns 当前选区中的节点 ID 列表。
 */
export function listLeaferGraphInteractionSelectedNodeIds<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>
): string[] {
  return context.options.listSelectedNodeIds();
}

/**
 * 判断单个节点当前是否处于选中态。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否已被选中。
 */
export function isLeaferGraphInteractionNodeSelected<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): boolean {
  return context.options.isNodeSelected(nodeId);
}

/**
 * 批量更新当前节点选区。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeIds - 需要写入的节点 ID 列表。
 * @param mode - 选区更新模式。
 * @returns 更新后的节点 ID 列表。
 */
export function setLeaferGraphInteractionSelectedNodeIds<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeIds: readonly string[],
  mode?: LeaferGraphSelectionUpdateMode
): string[] {
  return context.options.setSelectedNodeIds(nodeIds, mode);
}

/**
 * 清空当前节点选区。
 *
 * @param context - 当前交互运行时上下文。
 * @returns 清空后的节点 ID 列表。
 */
export function clearLeaferGraphInteractionSelectedNodes<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>
): string[] {
  return context.options.clearSelectedNodes();
}
