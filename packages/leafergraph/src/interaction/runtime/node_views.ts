/**
 * 图交互运行时节点视图 helper。
 *
 * @remarks
 * 负责节点视图查询、hover / focus 更新，以及节点矩形命中。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import type {
  LeaferGraphInteractionRuntimeContext,
  LeaferGraphInteractionRuntimeNodeViewState
} from "./types";
import { doBoundsIntersect, isPointInBounds, normalizeRectBounds } from "./geometry";

/**
 * 读取节点视图状态。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点视图状态。
 */
export function getLeaferGraphInteractionNodeView<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): TNodeViewState | undefined {
  return context.options.nodeViews.get(nodeId);
}

/**
 * 写回节点 hover 状态，并同步 resize 句柄显隐。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param hovered - 目标 hover 状态。
 * @returns 无返回值。
 */
export function setLeaferGraphInteractionNodeHovered<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  hovered: boolean
): void {
  const state = context.options.nodeViews.get(nodeId);
  if (!state) {
    return;
  }

  if (state.hovered !== hovered) {
    state.hovered = hovered;
  }

  context.options.syncNodeResizeHandleVisibility(state);
}

/**
 * 让一个节点进入当前交互焦点。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 是否成功聚焦节点。
 */
export function focusLeaferGraphInteractionNode<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): boolean {
  const state = context.options.nodeViews.get(nodeId);
  if (!state) {
    return false;
  }

  context.options.bringNodeViewToFront(state);
  context.options.requestRender();
  return true;
}

/**
 * 按当前节点状态同步 resize 句柄显隐。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 无返回值。
 */
export function syncLeaferGraphInteractionNodeResizeHandleVisibility<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): void {
  const state = context.options.nodeViews.get(nodeId);
  if (!state) {
    return;
  }

  context.options.syncNodeResizeHandleVisibility(state);
}

/**
 * 根据 page 坐标命中当前最上层节点。
 *
 * @param context - 当前交互运行时上下文。
 * @param point - 需要命中的坐标点。
 * @returns 命中到的节点 ID。
 */
export function resolveLeaferGraphInteractionNodeAtPoint<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  point: { x: number; y: number }
): string | undefined {
  let bestMatch:
    | {
        nodeId: string;
        zIndex: number;
      }
    | undefined;

  for (const state of context.options.nodeViews.values()) {
    const bounds = context.resolveNodeBounds(state);
    if (!bounds || !isPointInBounds(point, bounds)) {
      continue;
    }

    const rawZIndex = state.view.zIndex;
    const zIndex =
      typeof rawZIndex === "number" && Number.isFinite(rawZIndex) ? rawZIndex : 0;

    if (!bestMatch || zIndex >= bestMatch.zIndex) {
      bestMatch = {
        nodeId: state.state.id,
        zIndex
      };
    }
  }

  return bestMatch?.nodeId;
}

/**
 * 读取与给定矩形相交的全部节点 ID。
 *
 * @param context - 当前交互运行时上下文。
 * @param bounds - 需要命中的矩形边界。
 * @returns 与边界相交的节点 ID 列表。
 */
export function resolveLeaferGraphInteractionNodeIdsInBounds<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }
): string[] {
  const normalizedBounds = normalizeRectBounds(bounds);
  const nodeIds: string[] = [];

  for (const state of context.options.nodeViews.values()) {
    const nodeBounds = context.resolveNodeBounds(state);
    if (!nodeBounds || !doBoundsIntersect(nodeBounds, normalizedBounds)) {
      continue;
    }

    nodeIds.push(state.state.id);
  }

  return nodeIds;
}
