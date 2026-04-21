/**
 * `LeaferGraphApiHost` 连线交互 helper。
 *
 * @remarks
 * 负责把公共 API 暴露的端口命中与预览能力转发到交互运行时壳面。
 */

import type {
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult
} from "@leafergraph/core/contracts";

/**
 * 解析某个节点方向和槽位对应的正式端口几何。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param direction - 目标端口方向。
 * @param slot - 目标槽位。
 * @returns 解析到的端口状态。
 */
export function resolveLeaferGraphApiConnectionPort<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  direction: LeaferGraphConnectionPortState["direction"],
  slot: number
): LeaferGraphConnectionPortState | undefined {
  return context.options.runtime.interactionRuntime.resolvePort(
    nodeId,
    direction,
    slot
  );
}

/**
 * 根据 page 坐标命中一个方向匹配的端口。
 *
 * @param context - 当前 API 宿主上下文。
 * @param point - 需要命中的 page 坐标。
 * @param direction - 目标端口方向。
 * @returns 命中到的端口状态。
 */
export function resolveLeaferGraphApiConnectionPortAtPoint<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  point: { x: number; y: number },
  direction: LeaferGraphConnectionPortState["direction"]
): LeaferGraphConnectionPortState | undefined {
  return context.options.runtime.interactionRuntime.resolvePortAtPoint(
    point,
    direction
  );
}

/**
 * 设置当前连接预览的起点高亮。
 *
 * @param context - 当前 API 宿主上下文。
 * @param port - 当前来源端口。
 * @returns 无返回值。
 */
export function setLeaferGraphApiConnectionSourcePort<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  port: LeaferGraphConnectionPortState | null
): void {
  context.options.runtime.interactionRuntime.setConnectionSourcePort(port);
}

/**
 * 设置当前连接预览的候选终点高亮。
 *
 * @param context - 当前 API 宿主上下文。
 * @param port - 当前候选端口。
 * @returns 无返回值。
 */
export function setLeaferGraphApiConnectionCandidatePort<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  port: LeaferGraphConnectionPortState | null
): void {
  context.options.runtime.interactionRuntime.setConnectionCandidatePort(port);
}

/**
 * 更新当前连接预览线。
 *
 * @param context - 当前 API 宿主上下文。
 * @param source - 当前来源端口。
 * @param pointer - 当前指针位置。
 * @param target - 当前候选目标端口。
 * @returns 无返回值。
 */
export function setLeaferGraphApiConnectionPreview<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  source: LeaferGraphConnectionPortState,
  pointer: { x: number; y: number },
  target?: LeaferGraphConnectionPortState
): void {
  context.options.runtime.interactionRuntime.setConnectionPreview(
    source,
    pointer,
    target
  );
}

/**
 * 清理当前连接预览线和端口高亮。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 无返回值。
 */
export function clearLeaferGraphApiConnectionPreview<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): void {
  context.options.runtime.interactionRuntime.clearConnectionPreview();
}

/**
 * 校验两个端口当前是否允许建立正式连线。
 *
 * @param context - 当前 API 宿主上下文。
 * @param source - 当前来源端口。
 * @param target - 当前目标端口。
 * @returns 端口连接校验结果。
 */
export function canLeaferGraphApiCreateConnection<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  source: LeaferGraphConnectionPortState,
  target: LeaferGraphConnectionPortState
): LeaferGraphConnectionValidationResult {
  return context.options.runtime.interactionRuntime.canCreateLink(source, target);
}
