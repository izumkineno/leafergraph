/**
 * 图交互宿主连线 helper。
 *
 * @remarks
 * 负责端口拖线绑定、预览刷新、正式建线提交和临时状态清理。
 */

import type { NodeRuntimeState, SlotDirection } from "@leafergraph/node";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import type {
  LeaferGraphInteractionHostContext,
  LeaferGraphInteractiveNodeViewState
} from "./types";
import {
  getOppositeDirection,
  resolveConnectionEndpoints
} from "./hit_test";

/**
 * 绑定节点端口的最小拖线交互。
 *
 * @param context - 当前交互宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param state - 当前节点视图状态。
 * @returns 无返回值。
 */
export function bindLeaferGraphNodePorts<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  nodeId: string,
  state: TNodeViewState
): void {
  for (const portView of state.shellView.portViews) {
    portView.hitArea.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      if (event.right || event.middle) {
        return;
      }

      if (!context.options.runtime.isNodeSelected(nodeId)) {
        context.options.runtime.setSelectedNodeIds([nodeId], "replace");
      }
      event.stopNow?.();
      event.stop?.();
      context.options.runtime.focusNode(nodeId);
      startLeaferGraphConnectionDrag(
        context,
        nodeId,
        portView.layout.direction,
        portView.layout.index,
        event
      );
    });
  }
}

/**
 * 启动一次端口拖线。
 *
 * @param context - 当前交互宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param direction - 起点端口方向。
 * @param slot - 起点槽位。
 * @param event - 当前 Leafer 指针事件。
 * @returns 无返回值。
 */
export function startLeaferGraphConnectionDrag<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  nodeId: string,
  direction: SlotDirection,
  slot: number,
  event: LeaferGraphWidgetPointerEvent
): void {
  const originPort = context.options.runtime.resolvePort(nodeId, direction, slot);
  if (!originPort) {
    return;
  }

  context.setDragState(null);
  context.setResizeState(null);
  context.setConnectionState({
    originNodeId: nodeId,
    originDirection: originPort.direction,
    originSlot: originPort.slot,
    hoveredTarget: null
  });
  context.syncInteractionActivityState();

  context.options.runtime.setConnectionSourcePort(originPort);
  context.options.runtime.setConnectionCandidatePort(null);
  context.options.runtime.setConnectionPreview(
    originPort,
    context.options.runtime.getPagePointFromGraphEvent(event)
  );
  context.options.container.style.cursor = "crosshair";
}

/**
 * 根据当前鼠标位置刷新拖线预览和候选目标。
 *
 * @param context - 当前交互宿主上下文。
 * @param point - 当前 page 坐标。
 * @returns 是否已经处理本次拖线刷新。
 */
export function updateLeaferGraphConnectionPreview<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  point: { x: number; y: number }
): boolean {
  // 先恢复当前拖线起点，并基于指针位置解析候选目标端口。
  const connectionState = context.getConnectionState();
  if (!connectionState) {
    return false;
  }

  const originPort = context.options.runtime.resolvePort(
    connectionState.originNodeId,
    connectionState.originDirection,
    connectionState.originSlot
  );
  if (!originPort) {
    context.clearConnectionState();
    context.options.container.style.cursor = "";
    return true;
  }

  const rawTarget = context.options.runtime.resolvePortAtPoint(
    point,
    getOppositeDirection(originPort.direction)
  );
  const endpoints = rawTarget
    ? resolveConnectionEndpoints(originPort, rawTarget)
    : null;
  const validation = endpoints
    ? context.options.runtime.canCreateLink(endpoints.source, endpoints.target)
    : { valid: false as const };
  const hoveredTarget = rawTarget && validation.valid ? rawTarget : null;

  // 再统一刷新候选高亮、预览线和容器 cursor，让拖线反馈保持单一来源。
  connectionState.hoveredTarget = hoveredTarget;
  context.options.runtime.setConnectionCandidatePort(hoveredTarget);
  context.options.runtime.setConnectionPreview(
    originPort,
    point,
    hoveredTarget ?? undefined
  );
  context.options.container.style.cursor =
    rawTarget && !validation.valid ? "not-allowed" : "crosshair";
  return true;
}

/**
 * 在窗口级 pointer up 时完成或取消一次拖线。
 *
 * @param context - 当前交互宿主上下文。
 * @param point - 可选的 page 坐标。
 * @returns 无返回值。
 */
export function finishLeaferGraphConnection<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  point?: { x: number; y: number }
): void {
  // 先恢复当前拖线会话和最终命中的候选端口，避免仅依赖上一次 move 的临时状态。
  const connection = context.getConnectionState();
  if (!connection) {
    return;
  }

  const originPort = context.options.runtime.resolvePort(
    connection.originNodeId,
    connection.originDirection,
    connection.originSlot
  );
  let targetPort = connection.hoveredTarget;

  if (point && originPort) {
    const rawTarget = context.options.runtime.resolvePortAtPoint(
      point,
      getOppositeDirection(originPort.direction)
    );
    const endpoints = rawTarget
      ? resolveConnectionEndpoints(originPort, rawTarget)
      : null;
    if (
      rawTarget &&
      endpoints &&
      context.options.runtime.canCreateLink(endpoints.source, endpoints.target).valid
    ) {
      targetPort = rawTarget;
    }
  }

  // 最后把合法端点归一成正式 output -> input 结构，并走提交或直接建线分支。
  if (originPort && targetPort) {
    const endpoints = resolveConnectionEndpoints(originPort, targetPort);
    if (endpoints) {
      if (context.options.emitInteractionCommit) {
        context.options.emitInteractionCommit({
          type: "link.create.commit",
          input: {
            source: {
              nodeId: endpoints.source.nodeId,
              slot: endpoints.source.slot
            },
            target: {
              nodeId: endpoints.target.nodeId,
              slot: endpoints.target.slot
            }
          }
        });
      } else {
        context.options.runtime.createLink(endpoints.source, endpoints.target);
      }
    }
  }

  context.clearConnectionState();
  context.options.container.style.cursor = "";
}

/**
 * 清理当前拖线相关的视觉反馈和临时状态。
 *
 * @param context - 当前交互宿主上下文。
 * @returns 无返回值。
 */
export function clearLeaferGraphConnectionState<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>
): void {
  context.setConnectionState(null);
  context.options.runtime.setConnectionSourcePort(null);
  context.options.runtime.setConnectionCandidatePort(null);
  context.options.runtime.clearConnectionPreview();
  context.syncInteractionActivityState();
}
