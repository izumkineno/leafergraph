/**
 * public façade 的执行控制方法组。
 */

import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的执行控制 façade。
 */
export interface LeaferGraphExecutionFacade {
  playFromNode(nodeId: string, context?: unknown): boolean;
  play(): boolean;
  step(): boolean;
  stop(): boolean;
}

/**
 * 从指定节点开始运行一条正式执行链。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param context - 执行上下文。
 * @returns 是否成功启动执行。
 */
function playLeaferGraphFromNode(
  this: LeaferGraph,
  nodeId: string,
  context?: unknown
): boolean {
  return getLeaferGraphApiHost(this).playFromNode(nodeId, context);
}

/**
 * 从全部 `system/on-play` 启动事件节点开始图级运行。
 *
 * @param this - 当前图实例。
 * @returns 是否成功启动图级运行。
 */
function playLeaferGraph(this: LeaferGraph): boolean {
  return getLeaferGraphApiHost(this).play();
}

/**
 * 单步推进当前图级运行。
 *
 * @param this - 当前图实例。
 * @returns 是否成功推进一步。
 */
function stepLeaferGraph(this: LeaferGraph): boolean {
  return getLeaferGraphApiHost(this).step();
}

/**
 * 停止当前图级运行。
 *
 * @param this - 当前图实例。
 * @returns 是否成功停止运行。
 */
function stopLeaferGraph(this: LeaferGraph): boolean {
  return getLeaferGraphApiHost(this).stop();
}

export const leaferGraphExecutionFacadeMethods: LeaferGraphExecutionFacade = {
  playFromNode: playLeaferGraphFromNode,
  play: playLeaferGraph,
  step: stepLeaferGraph,
  stop: stopLeaferGraph
};
