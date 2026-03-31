/**
 * 节点运行时执行 helper。
 *
 * @remarks
 * 负责节点执行、执行事件桥接和 widget 动作任务推进。
 */

import type {
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent
} from "@leafergraph/contracts";
import type {
  LeaferGraphCreateEntryExecutionTaskOptions,
  LeaferGraphNodeExecutionTask,
  LeaferGraphNodeExecutionTaskResult
} from "@leafergraph/execution";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphNodeRuntimeContext,
  LeaferGraphRuntimeNodeViewState
} from "./types";

/**
 * 初始化执行宿主相关订阅。
 *
 * @param context - 节点运行时上下文。
 * @returns 无返回值。
 */
export function initializeLeaferGraphNodeRuntimeExecutionSubscriptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>
): void {
  context.nodeExecutionHost.subscribeNodeExecution((event) => {
    context.refreshExecutedNode(event.nodeId);
    context.notifyNodeStateChanged(event.nodeId, "execution");
  });
  context.nodeExecutionHost.subscribeLinkPropagation((event) => {
    context.options.sceneRuntime.requestRender();
    context.notifyNodeStateChanged(event.targetNodeId, "input-values");
  });
}

/**
 * 获取节点执行状态。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 节点执行状态。
 */
export function getLeaferGraphNodeExecutionState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
) {
  return context.nodeExecutionHost.getNodeExecutionState(nodeId);
}

/**
 * 判断是否可以执行节点。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否支持执行。
 */
export function canLeaferGraphExecuteNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): boolean {
  const node = context.options.graphNodes.get(nodeId);
  if (!node) {
    return false;
  }

  return Boolean(context.options.nodeRegistry.getNode(node.type)?.onExecute);
}

/**
 * 按类型列出节点 ID 列表。
 *
 * @param context - 节点运行时上下文。
 * @param type - 目标节点类型。
 * @returns 节点 ID 列表。
 */
export function listLeaferGraphNodeIdsByType<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  type: string
): string[] {
  return context.nodeExecutionHost.listNodeIdsByType(type);
}

/**
 * 从某个节点开始执行。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param payload - 当前执行上下文。
 * @returns 当前是否成功处理执行。
 */
export function playLeaferGraphFromNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  payload?: unknown
): boolean {
  const entryTask = createLeaferGraphEntryExecutionTask(context, nodeId, {
    source: "node-play",
    payload
  });
  if (!entryTask) {
    return false;
  }

  const queue: LeaferGraphNodeExecutionTask[] = [entryTask];
  let stepIndex = 0;
  let handled = false;

  while (queue.length) {
    const task = queue.shift();
    if (!task) {
      break;
    }

    const result = executeLeaferGraphExecutionTask(context, task, stepIndex);
    stepIndex += 1;
    handled = handled || result.handled;
    queue.push(...result.nextTasks);
  }

  return handled;
}

/**
 * 创建条目执行任务。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param options - 执行任务创建选项。
 * @returns 条目执行任务。
 */
export function createLeaferGraphEntryExecutionTask<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  options: LeaferGraphCreateEntryExecutionTaskOptions
): LeaferGraphNodeExecutionTask | undefined {
  return context.nodeExecutionHost.createEntryExecutionTask(nodeId, options);
}

/**
 * 执行单个执行任务。
 *
 * @param context - 节点运行时上下文。
 * @param task - 目标执行任务。
 * @param stepIndex - 当前步骤序号。
 * @returns 执行任务结果。
 */
export function executeLeaferGraphExecutionTask<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  task: LeaferGraphNodeExecutionTask,
  stepIndex: number
): LeaferGraphNodeExecutionTaskResult {
  return context.nodeExecutionHost.executeExecutionTask(task, stepIndex);
}

/**
 * 订阅节点执行事件。
 *
 * @param context - 节点运行时上下文。
 * @param listener - 目标监听器。
 * @returns 取消订阅函数。
 */
export function subscribeLeaferGraphNodeExecution<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  listener: (event: LeaferGraphNodeExecutionEvent) => void
): () => void {
  return context.nodeExecutionHost.subscribeNodeExecution(listener);
}

/**
 * 投影外部节点执行事件。
 *
 * @param context - 节点运行时上下文。
 * @param event - 外部节点执行事件。
 * @returns 无返回值。
 */
export function projectLeaferGraphExternalNodeExecution<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  event: LeaferGraphNodeExecutionEvent
): void {
  context.nodeExecutionHost.projectExternalNodeExecution(event);
}

/**
 * 订阅连线传播事件。
 *
 * @param context - 节点运行时上下文。
 * @param listener - 目标监听器。
 * @returns 取消订阅函数。
 */
export function subscribeLeaferGraphLinkPropagation<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  listener: (event: LeaferGraphLinkPropagationEvent) => void
): () => void {
  return context.nodeExecutionHost.subscribeLinkPropagation(listener);
}

/**
 * 投影外部连线传播事件。
 *
 * @param context - 节点运行时上下文。
 * @param event - 外部连线传播事件。
 * @returns 无返回值。
 */
export function projectLeaferGraphExternalLinkPropagation<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  event: LeaferGraphLinkPropagationEvent
): void {
  context.nodeExecutionHost.projectExternalLinkPropagation(event);
}

/**
 * 清理节点执行状态。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 无返回值。
 */
export function clearLeaferGraphNodeExecutionState<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string
): void {
  context.nodeExecutionHost.clearNodeExecutionState(nodeId);
}

/**
 * 清理全部执行状态。
 *
 * @param context - 节点运行时上下文。
 * @returns 无返回值。
 */
export function clearAllLeaferGraphNodeExecutionStates<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>
): void {
  context.nodeExecutionHost.clearAllExecutionStates();
}

/**
 * 派发节点 Widget 动作，并推进后续执行任务。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param action - 目标动作名。
 * @param param - 动作参数。
 * @param options - 额外动作配置。
 * @returns 当前动作是否被处理。
 */
export function emitLeaferGraphNodeWidgetAction<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  action: string,
  param?: unknown,
  options?: Record<string, unknown>
): boolean {
  const result = context.nodeExecutionHost.dispatchNodeAction(
    nodeId,
    action,
    param,
    options
  );
  if (!result.handled) {
    return false;
  }

  let stepIndex = 0;
  const queue = [...result.nextTasks];
  while (queue.length) {
    const task = queue.shift();
    if (!task) {
      break;
    }

    const taskResult = executeLeaferGraphExecutionTask(context, task, stepIndex);
    stepIndex += 1;
    queue.push(...taskResult.nextTasks);
  }

  context.options.sceneRuntime.requestRender();
  context.notifyNodeStateChanged(nodeId, "widget-action");
  return true;
}
