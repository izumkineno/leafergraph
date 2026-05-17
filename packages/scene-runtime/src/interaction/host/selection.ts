/**
 * 图交互宿主框选 helper。
 *
 * @remarks
 * 负责空白区框选开始、刷新和结束时的 overlay 与选区同步。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import type {
  GraphSelectionState,
  LeaferGraphInteractionHostContext,
  LeaferGraphInteractiveNodeViewState
} from "./types";

/**
 * 启动一次空白区框选。
 *
 * @param context - 当前交互宿主上下文。
 * @param event - 浏览器指针事件。
 * @returns 无返回值。
 */
export function startLeaferGraphSelectionDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  event: PointerEvent
): void {
  if (
    event.button !== 0 ||
    event.defaultPrevented ||
    context.isSpaceKeyPressed() ||
    event.ctrlKey
  ) {
    return;
  }

  const point = context.options.runtime.getPagePointByClient(event);
  if (context.options.runtime.resolveNodeAtPoint(point)) {
    return;
  }

  context.setDragState(null);
  context.setResizeState(null);
  context.clearConnectionState();
  context.setSelectionState({
    startPageX: point.x,
    startPageY: point.y,
    currentPageX: point.x,
    currentPageY: point.y,
    additive: event.shiftKey,
    started: false
  });
  context.syncInteractionActivityState();
}

/**
 * 根据当前框选手势刷新矩形 overlay 和选区结果。
 *
 * @param context - 当前交互宿主上下文。
 * @param event - 浏览器指针事件。
 * @returns 无返回值。
 */
export function updateLeaferGraphSelectionDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  event: PointerEvent
): void {
  const selectionState = context.getSelectionState();
  if (!selectionState) {
    return;
  }

  const point = context.options.runtime.getPagePointByClient(event);
  selectionState.currentPageX = point.x;
  selectionState.currentPageY = point.y;

  if (
    !selectionState.started &&
    Math.abs(selectionState.currentPageX - selectionState.startPageX) < 4 &&
    Math.abs(selectionState.currentPageY - selectionState.startPageY) < 4
  ) {
    return;
  }

  selectionState.started = true;
  const selectionBounds = resolveLeaferGraphSelectionBounds(selectionState);
  context.selectionBoxHost.show(selectionBounds);
  context.options.runtime.setSelectedNodeIds(
    context.options.runtime.resolveNodeIdsInBounds(selectionBounds),
    selectionState.additive ? "add" : "replace"
  );
  context.syncInteractionActivityState();
}

/**
 * 结束一次空白区点击或框选拖拽。
 *
 * @param context - 当前交互宿主上下文。
 * @returns 无返回值。
 */
export function finishLeaferGraphSelectionDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>
): void {
  const selectionState = context.getSelectionState();
  if (!selectionState) {
    return;
  }

  context.setSelectionState(null);
  context.selectionBoxHost.hide();
  if (!selectionState.started && !selectionState.additive) {
    context.options.runtime.clearSelectedNodes();
  }
  context.syncInteractionActivityState();
}

/**
 * 把一次框选手势归一成 page 坐标矩形。
 *
 * @param selectionState - 当前框选手势状态。
 * @returns 规范化后的 page 坐标矩形。
 */
export function resolveLeaferGraphSelectionBounds(
  selectionState: GraphSelectionState
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(selectionState.startPageX, selectionState.currentPageX),
    y: Math.min(selectionState.startPageY, selectionState.currentPageY),
    width: Math.abs(selectionState.currentPageX - selectionState.startPageX),
    height: Math.abs(selectionState.currentPageY - selectionState.startPageY)
  };
}
