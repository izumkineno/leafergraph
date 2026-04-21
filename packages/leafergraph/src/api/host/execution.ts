/**
 * `LeaferGraphApiHost` 执行与运行时状态 helper。
 *
 * @remarks
 * 负责执行入口、执行状态、交互状态和节点 resize 能力查询。
 */

import type {
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphGraphExecutionState,
  LeaferGraphInteractionActivityState,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeResizeConstraint
} from "@leafergraph/core/contracts";

/**
 * 读取某个节点的正式 resize 约束。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点的 resize 约束。
 */
export function getLeaferGraphApiNodeResizeConstraint<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): LeaferGraphNodeResizeConstraint | undefined {
  return context.options.runtime.nodeRuntimeHost.getNodeResizeConstraint(nodeId);
}

/**
 * 读取某个节点当前的执行反馈快照。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点执行反馈快照。
 */
export function getLeaferGraphApiNodeExecutionState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): LeaferGraphNodeExecutionState | undefined {
  return context.options.runtime.nodeRuntimeHost.getNodeExecutionState(nodeId);
}

/**
 * 读取当前图级执行状态。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 当前图级执行状态。
 */
export function getLeaferGraphApiGraphExecutionState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): LeaferGraphGraphExecutionState {
  return context.options.runtime.graphExecutionHost.getGraphExecutionState();
}

/**
 * 读取当前最小交互活跃态。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 当前交互活跃态快照。
 */
export function getLeaferGraphApiInteractionActivityState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): LeaferGraphInteractionActivityState {
  return context.options.runtime.interactionHost.getInteractionActivityState();
}

/**
 * 判断节点当前是否允许 resize。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否允许 resize。
 */
export function canLeaferGraphApiResizeNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): boolean {
  return context.options.runtime.nodeRuntimeHost.canResizeNode(nodeId);
}

/**
 * 把节点尺寸恢复到定义默认值。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 重置后的节点状态。
 */
export function resetLeaferGraphApiNodeSize<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): TNodeState | undefined {
  return context.options.runtime.nodeRuntimeHost.resetNodeSize(nodeId);
}

/**
 * 从指定节点开始运行一条正式执行链。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param executionContext - 运行上下文。
 * @returns 是否成功触发执行。
 */
export function playLeaferGraphApiFromNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  executionContext?: unknown
): boolean {
  return context.options.runtime.nodeRuntimeHost.playFromNode(
    nodeId,
    executionContext
  );
}

/**
 * 从图级入口节点开始运行。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 是否成功触发图级运行。
 */
export function playLeaferGraphApiGraph<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): boolean {
  return context.options.runtime.graphExecutionHost.play();
}

/**
 * 单步推进图级运行。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 是否成功执行单步。
 */
export function stepLeaferGraphApiGraph<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): boolean {
  return context.options.runtime.graphExecutionHost.step();
}

/**
 * 停止当前图级运行。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 是否成功停止运行。
 */
export function stopLeaferGraphApiGraph<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): boolean {
  return context.options.runtime.graphExecutionHost.stop();
}
