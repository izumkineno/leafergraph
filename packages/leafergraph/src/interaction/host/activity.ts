/**
 * 图交互宿主活跃态 helper。
 *
 * @remarks
 * 负责把当前手势状态折叠成对外可见的交互活跃态快照。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import type {
  LeaferGraphInteractionActivityState
} from "@leafergraph/core/contracts";
import type {
  LeaferGraphInteractionHostContext,
  LeaferGraphInteractiveNodeViewState
} from "./types";

/**
 * 读取当前最小交互活跃态快照。
 *
 * @param context - 当前交互宿主上下文。
 * @returns 当前交互活跃态快照。
 */
export function getLeaferGraphInteractionActivityStateSnapshot<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>
): LeaferGraphInteractionActivityState {
  return { ...context.getInteractionActivityState() };
}

/**
 * 订阅交互活跃态变化。
 *
 * @param context - 当前交互宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphInteractionActivity<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>,
  listener: (state: LeaferGraphInteractionActivityState) => void
): () => void {
  context.addInteractionActivityListener(listener);
  listener(getLeaferGraphInteractionActivityStateSnapshot(context));

  return () => {
    context.removeInteractionActivityListener(listener);
  };
}

/**
 * 根据当前内部状态同步对外可见的交互活跃态。
 *
 * @param context - 当前交互宿主上下文。
 * @returns 无返回值。
 */
export function syncLeaferGraphInteractionActivityState<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionHostContext<TNodeState, TNodeViewState>
): void {
  let mode: LeaferGraphInteractionActivityState["mode"] = "idle";
  if (context.getConnectionState()) {
    mode = "link-connect";
  } else if (context.getResizeState()) {
    mode = "node-resize";
  } else if (context.getSelectionState()?.started) {
    mode = "selection-box";
  } else if (context.getDragState()) {
    mode = "node-drag";
  }

  const nextState: LeaferGraphInteractionActivityState = {
    active: mode !== "idle",
    mode
  };
  const currentState = context.getInteractionActivityState();
  if (
    currentState.active === nextState.active &&
    currentState.mode === nextState.mode
  ) {
    return;
  }

  context.setInteractionActivityState(nextState);
  if (!context.getInteractionActivityListeners().size) {
    return;
  }

  const snapshot = getLeaferGraphInteractionActivityStateSnapshot(context);
  for (const listener of context.getInteractionActivityListeners()) {
    listener(snapshot);
  }
}
