/**
 * `LeaferGraphApiHost` 视图与查询 helper。
 *
 * @remarks
 * 负责主题、视图宿主查询、节点快照查询和选区控制。
 */

import type { Group } from "leafer-ui";
import type {
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState,
  LeaferGraphInteractionTargetLike
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphNodeInspectorState,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import type { NodeSerializeResult } from "@leafergraph/node";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";

/**
 * 运行时切换主包主题。
 *
 * @param context - 当前 API 宿主上下文。
 * @param mode - 目标主题模式。
 * @returns 无返回值。
 */
export function setLeaferGraphApiThemeMode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  mode: LeaferGraphThemeMode
): void {
  context.options.runtime.themeHost.setThemeMode(mode);
}

/**
 * 获取一个节点对应的 Leafer 视图宿主。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 匹配到的节点视图宿主。
 */
export function getLeaferGraphApiNodeView<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): Group | undefined {
  return context.options.nodeViews.get(nodeId)?.view;
}

/**
 * 获取一条连线对应的最小交互宿主。
 *
 * @param context - 当前 API 宿主上下文。
 * @param linkId - 目标连线 ID。
 * @returns 匹配到的连线视图宿主。
 */
export function getLeaferGraphApiLinkView<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  linkId: string
): LeaferGraphInteractionTargetLike | undefined {
  return context.options.linkViews.find((state) => state.linkId === linkId)?.view;
}

/**
 * 让当前画布内容适配到可视区域。
 *
 * @param context - 当前 API 宿主上下文。
 * @param padding - 适配时使用的内边距。
 * @returns 是否成功执行适配。
 */
export function fitLeaferGraphApiView<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  padding: number
): boolean {
  return context.options.runtime.viewHost.fitView(padding);
}

/**
 * 读取一个节点的正式可序列化快照。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点快照。
 */
export function getLeaferGraphApiNodeSnapshot<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): NodeSerializeResult | undefined {
  return context.options.runtime.nodeRuntimeHost.getNodeSnapshot(nodeId);
}

/**
 * 读取一个节点当前的检查快照。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点检查快照。
 */
export function getLeaferGraphApiNodeInspectorState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): LeaferGraphNodeInspectorState | undefined {
  return context.options.runtime.nodeRuntimeHost.getNodeInspectorState(nodeId);
}

/**
 * 设置单个节点的选中态。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param selected - 目标选中状态。
 * @returns 是否成功更新选中态。
 */
export function setLeaferGraphApiNodeSelected<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  selected: boolean
): boolean {
  return context.options.runtime.viewHost.setNodeSelected(nodeId, selected);
}

/**
 * 列出当前全部已选节点。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 当前选区中的节点 ID 列表。
 */
export function listLeaferGraphApiSelectedNodeIds<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): string[] {
  return context.options.runtime.viewHost.listSelectedNodeIds();
}

/**
 * 判断单个节点当前是否处于选中态。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否已被选中。
 */
export function isLeaferGraphApiNodeSelected<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): boolean {
  return context.options.runtime.viewHost.isNodeSelected(nodeId);
}

/**
 * 批量写回当前节点选区。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeIds - 需要写入的节点 ID 列表。
 * @param mode - 选区更新模式。
 * @returns 更新后的节点 ID 列表。
 */
export function setLeaferGraphApiSelectedNodeIds<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeIds: readonly string[],
  mode?: LeaferGraphSelectionUpdateMode
): string[] {
  return context.options.runtime.viewHost.setSelectedNodeIds(nodeIds, mode);
}

/**
 * 清空当前节点选区。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 清空后的节点 ID 列表。
 */
export function clearLeaferGraphApiSelectedNodes<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): string[] {
  return context.options.runtime.viewHost.clearSelectedNodes();
}
