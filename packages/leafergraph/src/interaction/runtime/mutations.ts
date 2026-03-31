/**
 * 图交互运行时正式变更 helper。
 *
 * @remarks
 * 负责拖拽位移、节点 resize、折叠和 page 坐标换算等能力。
 */

import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import type {
  GraphDragNodePosition,
  LeaferGraphInteractionRuntimeContext,
  LeaferGraphInteractionRuntimeNodeViewState
} from "./types";

/**
 * 解析一次拖拽应带上的节点集合。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 拖拽锚点节点 ID。
 * @returns 本次拖拽应带上的节点 ID 列表。
 */
export function resolveLeaferGraphInteractionDraggedNodeIds<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): string[] {
  return context.options.resolveDraggedNodeIds(nodeId);
}

/**
 * 按位移量批量移动节点。
 *
 * @param context - 当前交互运行时上下文。
 * @param positions - 节点起始位置信息。
 * @param deltaX - X 方向位移量。
 * @param deltaY - Y 方向位移量。
 * @returns 无返回值。
 */
export function moveLeaferGraphInteractionNodesByDelta<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  positions: readonly GraphDragNodePosition[],
  deltaX: number,
  deltaY: number
): void {
  context.options.sceneRuntime.moveNodesByDelta(positions, deltaX, deltaY);
}

/**
 * 调整单个节点尺寸。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param size - 目标尺寸。
 * @returns 无返回值。
 */
export function resizeLeaferGraphInteractionNode<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  size: { width: number; height: number }
): void {
  context.options.sceneRuntime.resizeNode(nodeId, size);
}

/**
 * 切换单个节点折叠态。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param collapsed - 目标折叠状态。
 * @returns 是否成功切换折叠态。
 */
export function setLeaferGraphInteractionNodeCollapsed<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  collapsed: boolean
): boolean {
  return context.options.setNodeCollapsed(nodeId, collapsed);
}

/**
 * 判断节点当前是否可 resize。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否允许 resize。
 */
export function canLeaferGraphInteractionResizeNode<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): boolean {
  return context.options.canResizeNode(nodeId);
}

/**
 * 把浏览器 client 坐标换成 Leafer page 坐标。
 *
 * @param context - 当前交互运行时上下文。
 * @param event - 浏览器指针事件坐标。
 * @returns 规范化后的 page 坐标。
 */
export function getLeaferGraphInteractionPagePointByClient<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  event: Pick<PointerEvent, "clientX" | "clientY">
): { x: number; y: number } {
  return context.options.getPagePointByClient(event);
}

/**
 * 把 Leafer 指针事件换成 page 坐标。
 *
 * @param context - 当前交互运行时上下文。
 * @param event - Leafer 指针事件。
 * @returns 规范化后的 page 坐标。
 */
export function getLeaferGraphInteractionPagePointFromGraphEvent<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  event: LeaferGraphWidgetPointerEvent
): { x: number; y: number } {
  return context.options.getPagePointFromGraphEvent(event);
}

/**
 * 读取节点当前可用于 resize 的尺寸。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点可用于 resize 的尺寸。
 */
export function resolveLeaferGraphInteractionNodeSize<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): { width: number; height: number } | undefined {
  const state = context.options.nodeViews.get(nodeId);
  if (!state) {
    return undefined;
  }

  return context.options.resolveNodeSize(state);
}
