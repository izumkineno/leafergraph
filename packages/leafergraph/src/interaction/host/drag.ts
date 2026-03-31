/**
 * 图交互宿主节点拖拽 helper。
 *
 * @remarks
 * 负责节点拖拽绑定、拖拽开始、拖拽刷新和拖拽结束提交。
 */

import type { Group } from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import { isWidgetInteractionTarget } from "@leafergraph/widget-runtime";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import type {
  LeaferGraphInteractionHostContext,
  LeaferGraphInteractiveNodeViewState
} from "./types";
import {
  isPortHitTarget,
  isResizeHandleHit,
  isResizeHandleTarget,
  isSelectionModifierPressed
} from "./hit_test";

/**
 * 绑定节点拖拽交互。
 *
 * @param context - 当前交互宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param view - 当前节点视图。
 * @returns 无返回值。
 */
export function bindLeaferGraphNodeDragging<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  nodeId: string,
  view: Group
): void {
  // 先绑定 hover 反馈，让节点在进入和离开时同步更新 hover 态与 cursor。
  view.on("pointer.enter", (event: LeaferGraphWidgetPointerEvent) => {
    context.options.runtime.setNodeHovered(nodeId, true);

    if (
      !context.getDragState() &&
      !context.getConnectionState() &&
      !context.getResizeState() &&
      !isResizeHandleTarget(event.target)
    ) {
      context.options.container.style.cursor = "grab";
    }
  });

  view.on("pointer.leave", () => {
    context.options.runtime.setNodeHovered(nodeId, false);

    if (!context.getDragState() && !context.getResizeState() && !context.getConnectionState()) {
      context.options.container.style.cursor = "";
    }
  });

  // 再绑定按下逻辑，把选区切换、focus 和拖拽启动收口到同一个入口。
  view.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
    const state = context.options.runtime.getNodeView(nodeId);
    if (!state) {
      return;
    }

    const interactiveSubTarget =
      isWidgetInteractionTarget(event.target) ||
      isPortHitTarget(event.target) ||
      isResizeHandleTarget(event.target) ||
      isResizeHandleHit(
        event,
        state,
        (targetNodeId) => context.options.runtime.resolveNodeSize(targetNodeId),
        (graphEvent) => context.options.runtime.getPagePointFromGraphEvent(graphEvent)
      );
    const shiftPressed = isSelectionModifierPressed(event);

    if (!event.right && !event.middle) {
      if (!interactiveSubTarget && shiftPressed) {
        const mode = context.options.runtime.isNodeSelected(nodeId) ? "remove" : "add";
        context.options.runtime.setSelectedNodeIds([nodeId], mode);
        return;
      }

      if (!context.options.runtime.isNodeSelected(nodeId)) {
        context.options.runtime.setSelectedNodeIds([nodeId], "replace");
      }

      context.options.runtime.focusNode(nodeId);
    }

    if (event.right || event.middle || interactiveSubTarget) {
      return;
    }

    startLeaferGraphNodeDrag(context, nodeId, state, event);
  });
}

/**
 * 启动一次节点拖拽。
 *
 * @param context - 当前交互宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param state - 当前节点视图状态。
 * @param event - 当前 Leafer 指针事件。
 * @returns 无返回值。
 */
export function startLeaferGraphNodeDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  nodeId: string,
  state: TNodeViewState,
  event: LeaferGraphWidgetPointerEvent
): void {
  const point = context.options.runtime.getPagePointFromGraphEvent(event);
  const anchorStartX = state.state.layout.x;
  const anchorStartY = state.state.layout.y;
  const draggedNodeIds = context.options.runtime.resolveDraggedNodeIds(nodeId);

  context.setResizeState(null);
  context.setDragState({
    anchorNodeId: nodeId,
    offsetX: point.x - anchorStartX,
    offsetY: point.y - anchorStartY,
    anchorStartX,
    anchorStartY,
    nodes: draggedNodeIds.map((draggedNodeId) => {
      const node = context.options.runtime.getNodeView(draggedNodeId)?.state;

      return {
        nodeId: draggedNodeId,
        startX: node?.layout.x ?? 0,
        startY: node?.layout.y ?? 0
      };
    })
  });
  context.syncInteractionActivityState();
  context.options.runtime.syncNodeResizeHandleVisibility(nodeId);
  context.options.container.style.cursor = "grabbing";
}

/**
 * 根据当前指针位置刷新节点拖拽结果。
 *
 * @param context - 当前交互宿主上下文。
 * @param event - 浏览器指针事件。
 * @returns 是否已经处理本次 pointer move。
 */
export function updateLeaferGraphNodeDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  event: PointerEvent
): boolean {
  const dragState = context.getDragState();
  if (!dragState) {
    return false;
  }

  const point = context.options.runtime.getPagePointByClient(event);
  const anchorX = point.x - dragState.offsetX;
  const anchorY = point.y - dragState.offsetY;
  const deltaX = anchorX - dragState.anchorStartX;
  const deltaY = anchorY - dragState.anchorStartY;

  context.options.runtime.moveNodesByDelta(dragState.nodes, deltaX, deltaY);
  context.options.container.style.cursor = "grabbing";
  return true;
}

/**
 * 在窗口级 pointer up 时完成一次节点拖拽提交。
 *
 * @param context - 当前交互宿主上下文。
 * @returns 拖拽锚点节点 ID，供宿主后续同步 resize 句柄显隐。
 */
export function finishLeaferGraphNodeDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>
): string | undefined {
  // 先把本次拖拽影响的节点位置变更归一成正式 commit entries。
  const dragState = context.getDragState();
  if (!dragState) {
    return undefined;
  }

  const entries = dragState.nodes
    .map((item) => {
      const currentNode = context.options.runtime.getNodeView(item.nodeId)?.state;
      if (!currentNode) {
        return null;
      }

      const nextX = Math.round(currentNode.layout.x);
      const nextY = Math.round(currentNode.layout.y);
      if (nextX === Math.round(item.startX) && nextY === Math.round(item.startY)) {
        return null;
      }

      return {
        nodeId: item.nodeId,
        before: {
          x: Math.round(item.startX),
          y: Math.round(item.startY)
        },
        after: {
          x: nextX,
          y: nextY
        }
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (entries.length) {
    context.options.emitInteractionCommit?.({
      type: "node.move.commit",
      entries
    });
  }

  // 最后清空拖拽状态并恢复 cursor / activity，同步把控制权交回宿主。
  context.setDragState(null);
  context.options.container.style.cursor = "";
  context.syncInteractionActivityState();
  return dragState.anchorNodeId;
}
