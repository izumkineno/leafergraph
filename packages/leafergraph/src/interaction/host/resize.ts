/**
 * 图交互宿主 resize helper。
 *
 * @remarks
 * 负责 resize 句柄绑定、尺寸拖拽更新和提交事件发出。
 */

import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import type {
  LeaferGraphInteractionHostContext,
  LeaferGraphInteractiveNodeViewState
} from "./types";

/**
 * 绑定节点右下角 resize 句柄。
 *
 * @param context - 当前交互宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param state - 当前节点视图状态。
 * @returns 无返回值。
 */
export function bindLeaferGraphNodeResize<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  nodeId: string,
  state: TNodeViewState
): void {
  if (!context.options.runtime.canResizeNode(nodeId)) {
    return;
  }

  state.resizeHandle.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
    event.stopNow?.();
    event.stop?.();
    if (!event.right && !event.middle) {
      if (!context.options.runtime.isNodeSelected(nodeId)) {
        context.options.runtime.setSelectedNodeIds([nodeId], "replace");
      }
      context.options.runtime.focusNode(nodeId);
    }
    context.setDragState(null);
    const point = context.options.runtime.getPagePointFromGraphEvent(event);
    const size = context.options.runtime.resolveNodeSize(nodeId);
    if (!size) {
      context.syncInteractionActivityState();
      return;
    }
    context.setResizeState({
      nodeId,
      startWidth: size.width,
      startHeight: size.height,
      startPageX: point.x,
      startPageY: point.y
    });
    context.syncInteractionActivityState();
    context.options.runtime.syncNodeResizeHandleVisibility(nodeId);
    context.options.container.style.cursor = "nwse-resize";
  });
}

/**
 * 根据当前指针位置刷新 resize 结果。
 *
 * @param context - 当前交互宿主上下文。
 * @param event - 浏览器指针事件。
 * @returns 是否已经处理本次 pointer move。
 */
export function updateLeaferGraphNodeResize<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  event: PointerEvent
): boolean {
  const resizeState = context.getResizeState();
  if (!resizeState) {
    return false;
  }

  const point = context.options.runtime.getPagePointByClient(event);
  const width = resizeState.startWidth + (point.x - resizeState.startPageX);
  const height = resizeState.startHeight + (point.y - resizeState.startPageY);

  context.options.runtime.resizeNode(resizeState.nodeId, {
    width,
    height
  });
  context.options.container.style.cursor = "nwse-resize";
  return true;
}

/**
 * 在窗口级 pointer up 时完成一次 resize 提交。
 *
 * @param context - 当前交互宿主上下文。
 * @returns 完成 resize 的节点 ID。
 */
export function finishLeaferGraphNodeResize<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>
): string | undefined {
  const resizeState = context.getResizeState();
  if (!resizeState) {
    return undefined;
  }

  const nextSize = context.options.runtime.resolveNodeSize(resizeState.nodeId);
  if (
    nextSize &&
    (Math.round(nextSize.width) !== Math.round(resizeState.startWidth) ||
      Math.round(nextSize.height) !== Math.round(resizeState.startHeight))
  ) {
    context.options.emitInteractionCommit?.({
      type: "node.resize.commit",
      nodeId: resizeState.nodeId,
      before: {
        width: resizeState.startWidth,
        height: resizeState.startHeight
      },
      after: {
        width: Math.round(nextSize.width),
        height: Math.round(nextSize.height)
      }
    });
  }

  context.setResizeState(null);
  context.options.container.style.cursor = "";
  context.syncInteractionActivityState();
  return resizeState.nodeId;
}
