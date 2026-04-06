/**
 * 节点运行时状态订阅 helper。
 *
 * @remarks
 * 负责节点状态事件的订阅、投影和对外分发。
 */

import type {
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason
} from "@leafergraph/contracts";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphNodeRuntimeContext,
  LeaferGraphRuntimeNodeViewState
} from "./types";

/**
 * 订阅节点状态变化。
 *
 * @param context - 节点运行时上下文。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
export function subscribeLeaferGraphNodeState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  listener: (event: LeaferGraphNodeStateChangeEvent) => void
): () => void {
  context.stateListeners.add(listener);

  return () => {
    context.stateListeners.delete(listener);
  };
}

/**
 * 投影外部节点状态事件。
 *
 * @param context - 节点运行时上下文。
 * @param event - 外部节点状态事件。
 * @returns 无返回值。
 */
export function projectLeaferGraphExternalNodeState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  event: LeaferGraphNodeStateChangeEvent
): void {
  if (!event.exists) {
    context.nodeExecutionHost.clearNodeExecutionState(event.nodeId);
  } else if (event.reason === "execution") {
    context.refreshExecutedNode(event.nodeId);
    context.syncLongTaskProgressAnimation();
  } else if (event.reason === "connections") {
    context.options.sceneRuntime.updateConnectedLinks(event.nodeId);
    context.options.sceneRuntime.requestRender();
  }

  if (!context.stateListeners.size) {
    return;
  }

  const snapshot = cloneNodeStateEvent(event);
  for (const listener of context.stateListeners) {
    listener(snapshot);
  }
}

/**
 * 派发内部节点状态变化事件。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param reason - 节点状态变化原因。
 * @returns 无返回值。
 */
export function notifyLeaferGraphNodeStateChanged<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  reason: LeaferGraphNodeStateChangeReason
): void {
  if (!context.stateListeners.size) {
    return;
  }

  const exists = context.options.graphNodes.has(nodeId);
  const event: LeaferGraphNodeStateChangeEvent = {
    nodeId,
    exists,
    reason,
    timestamp: Date.now()
  };

  for (const listener of context.stateListeners) {
    listener(event);
  }
}

/**
 * 克隆节点状态事件。
 *
 * @param event - 原始节点状态事件。
 * @returns 克隆后的事件快照。
 */
export function cloneNodeStateEvent(
  event: LeaferGraphNodeStateChangeEvent
): LeaferGraphNodeStateChangeEvent {
  return {
    ...event
  };
}
