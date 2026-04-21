/**
 * `LeaferGraphApiHost` 订阅与投影 helper。
 *
 * @remarks
 * 负责把运行时事件订阅能力和外部反馈投影统一收口。
 */

import { projectExternalRuntimeFeedback } from "../../graph/feedback/projection";
import type {
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphHistoryEvent,
  LeaferGraphInteractionActivityState,
  LeaferGraphInteractionCommitEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";

/**
 * 订阅节点执行事件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiNodeExecution<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (event: LeaferGraphNodeExecutionEvent) => void
): () => void {
  return context.options.runtime.nodeRuntimeHost.subscribeNodeExecution(listener);
}

/**
 * 订阅图级执行事件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiGraphExecution<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (event: LeaferGraphGraphExecutionEvent) => void
): () => void {
  return context.options.runtime.graphExecutionHost.subscribeGraphExecution(
    listener
  );
}

/**
 * 订阅节点状态变化事件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiNodeState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (event: LeaferGraphNodeStateChangeEvent) => void
): () => void {
  return context.options.runtime.nodeRuntimeHost.subscribeNodeState(listener);
}

/**
 * 订阅统一运行反馈事件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiRuntimeFeedback<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (event: RuntimeFeedbackEvent) => void
): () => void {
  return context.options.runtime.runtimeAdapter.subscribe(listener);
}

/**
 * 订阅正式历史事件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (event: LeaferGraphHistoryEvent) => void
): () => void {
  return context.options.runtime.historySource.subscribe(listener);
}

/**
 * 订阅交互活跃态变化。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiInteractionActivity<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (state: LeaferGraphInteractionActivityState) => void
): () => void {
  return context.options.runtime.interactionHost.subscribeInteractionActivity(
    listener
  );
}

/**
 * 订阅交互提交事件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param listener - 需要注册的监听器。
 * @returns 用于取消订阅的清理函数。
 */
export function subscribeLeaferGraphApiInteractionCommit<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  listener: (event: LeaferGraphInteractionCommitEvent) => void
): () => void {
  return context.options.runtime.interactionCommitSource.subscribe(listener);
}

/**
 * 把外部 runtime feedback 投影回当前图运行时。
 *
 * @param context - 当前 API 宿主上下文。
 * @param feedback - 需要投影的运行反馈。
 * @returns 无返回值。
 */
export function projectLeaferGraphApiRuntimeFeedback<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  feedback: RuntimeFeedbackEvent
): void {
  projectExternalRuntimeFeedback(
    {
      projectExternalGraphExecution: (event) =>
        context.options.runtime.graphExecutionHost.projectExternalGraphExecution(
          event
        ),
      projectExternalNodeExecution: (event) =>
        context.options.runtime.nodeRuntimeHost.projectExternalNodeExecution(
          event
        ),
      projectExternalNodeState: (event) =>
        context.options.runtime.nodeRuntimeHost.projectExternalNodeState(event),
      projectExternalLinkPropagation: (event) =>
        context.options.runtime.nodeRuntimeHost.projectExternalLinkPropagation(
          event
        )
    },
    feedback
  );
}
