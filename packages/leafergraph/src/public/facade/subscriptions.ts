/**
 * public façade 的订阅与反馈方法组。
 */

import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphHistoryEvent,
  LeaferGraphInteractionActivityState,
  LeaferGraphInteractionCommitEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的订阅与反馈 façade。
 */
export interface LeaferGraphSubscriptionFacade {
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void;
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void;
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void;
  subscribeRuntimeFeedback(
    listener: (event: RuntimeFeedbackEvent) => void
  ): () => void;
  subscribeHistory(listener: (event: LeaferGraphHistoryEvent) => void): () => void;
  subscribeInteractionActivity(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): () => void;
  projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void;
  subscribeInteractionCommit(
    listener: (event: LeaferGraphInteractionCommitEvent) => void
  ): () => void;
}

/**
 * 订阅节点执行完成事件。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphNodeExecution(
  this: LeaferGraph,
  listener: (event: LeaferGraphNodeExecutionEvent) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeNodeExecution(listener);
}

/**
 * 订阅图级执行事件。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphGraphExecution(
  this: LeaferGraph,
  listener: (event: LeaferGraphGraphExecutionEvent) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeGraphExecution(listener);
}

/**
 * 订阅节点状态变化事件。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphNodeState(
  this: LeaferGraph,
  listener: (event: LeaferGraphNodeStateChangeEvent) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeNodeState(listener);
}

/**
 * 订阅统一运行反馈事件。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphRuntimeFeedback(
  this: LeaferGraph,
  listener: (event: RuntimeFeedbackEvent) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeRuntimeFeedback(listener);
}

/**
 * 订阅正式历史事件。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphHistory(
  this: LeaferGraph,
  listener: (event: LeaferGraphHistoryEvent) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeHistory(listener);
}

/**
 * 订阅交互活跃态变化。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphInteractionActivity(
  this: LeaferGraph,
  listener: (state: LeaferGraphInteractionActivityState) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeInteractionActivity(listener);
}

/**
 * 把外部 runtime feedback 投影回当前图运行时。
 *
 * @param this - 当前图实例。
 * @param feedback - 需要投影的运行反馈。
 * @returns 无返回值。
 */
function projectLeaferGraphRuntimeFeedback(
  this: LeaferGraph,
  feedback: RuntimeFeedbackEvent
): void {
  getLeaferGraphApiHost(this).projectRuntimeFeedback(feedback);
}

/**
 * 订阅交互结束后的正式提交事件。
 *
 * @param this - 当前图实例。
 * @param listener - 需要注册的监听器。
 * @returns 取消当前订阅的清理函数。
 */
function subscribeLeaferGraphInteractionCommit(
  this: LeaferGraph,
  listener: (event: LeaferGraphInteractionCommitEvent) => void
): () => void {
  return getLeaferGraphApiHost(this).subscribeInteractionCommit(listener);
}

export const leaferGraphSubscriptionFacadeMethods: LeaferGraphSubscriptionFacade = {
  subscribeNodeExecution: subscribeLeaferGraphNodeExecution,
  subscribeGraphExecution: subscribeLeaferGraphGraphExecution,
  subscribeNodeState: subscribeLeaferGraphNodeState,
  subscribeRuntimeFeedback: subscribeLeaferGraphRuntimeFeedback,
  subscribeHistory: subscribeLeaferGraphHistory,
  subscribeInteractionActivity: subscribeLeaferGraphInteractionActivity,
  projectRuntimeFeedback: projectLeaferGraphRuntimeFeedback,
  subscribeInteractionCommit: subscribeLeaferGraphInteractionCommit
};
