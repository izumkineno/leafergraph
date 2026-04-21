/**
 * public façade 的查询方法组。
 */

import type {
  GraphLink,
  NodeRuntimeState,
  NodeSerializeResult
} from "@leafergraph/core/node";
import type {
  LeaferGraphGraphExecutionState,
  LeaferGraphInteractionActivityState,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeResizeConstraint
} from "@leafergraph/core/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的查询 façade。
 */
export interface LeaferGraphQueryFacade {
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  getNodeInspectorState(nodeId: string): LeaferGraphNodeInspectorState | undefined;
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined;
  getNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined;
  getGraphExecutionState(): LeaferGraphGraphExecutionState;
  getInteractionActivityState(): LeaferGraphInteractionActivityState;
  canResizeNode(nodeId: string): boolean;
  resetNodeSize(nodeId: string): NodeRuntimeState | undefined;
  findLinksByNode(nodeId: string): GraphLink[];
  getLink(linkId: string): GraphLink | undefined;
}

/**
 * 读取一个正式可序列化节点快照。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 节点快照结果。
 */
function getLeaferGraphNodeSnapshot(
  this: LeaferGraph,
  nodeId: string
): NodeSerializeResult | undefined {
  return getLeaferGraphApiHost(this).getNodeSnapshot(nodeId);
}

/**
 * 读取一个节点当前的检查快照。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 节点检查快照。
 */
function getLeaferGraphNodeInspectorState(
  this: LeaferGraph,
  nodeId: string
): LeaferGraphNodeInspectorState | undefined {
  return getLeaferGraphApiHost(this).getNodeInspectorState(nodeId);
}

/**
 * 读取某个节点的正式 resize 约束。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 节点 resize 约束。
 */
function getLeaferGraphNodeResizeConstraint(
  this: LeaferGraph,
  nodeId: string
): LeaferGraphNodeResizeConstraint | undefined {
  return getLeaferGraphApiHost(this).getNodeResizeConstraint(nodeId);
}

/**
 * 读取某个节点当前的最小执行反馈快照。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 节点执行状态快照。
 */
function getLeaferGraphNodeExecutionState(
  this: LeaferGraph,
  nodeId: string
): LeaferGraphNodeExecutionState | undefined {
  return getLeaferGraphApiHost(this).getNodeExecutionState(nodeId);
}

/**
 * 读取当前图级执行状态。
 *
 * @param this - 当前图实例。
 * @returns 图级执行状态。
 */
function getLeaferGraphGraphExecutionState(
  this: LeaferGraph
): LeaferGraphGraphExecutionState {
  return getLeaferGraphApiHost(this).getGraphExecutionState();
}

/**
 * 读取当前最小交互活跃态快照。
 *
 * @param this - 当前图实例。
 * @returns 交互活跃态快照。
 */
function getLeaferGraphInteractionActivityState(
  this: LeaferGraph
): LeaferGraphInteractionActivityState {
  return getLeaferGraphApiHost(this).getInteractionActivityState();
}

/**
 * 判断某个节点当前是否允许显示并响应 resize 交互。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否允许 resize。
 */
function canLeaferGraphResizeNode(this: LeaferGraph, nodeId: string): boolean {
  return getLeaferGraphApiHost(this).canResizeNode(nodeId);
}

/**
 * 把节点尺寸恢复到定义默认值。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 重置后的节点运行时状态。
 */
function resetLeaferGraphNodeSize(
  this: LeaferGraph,
  nodeId: string
): NodeRuntimeState | undefined {
  return getLeaferGraphApiHost(this).resetNodeSize(nodeId);
}

/**
 * 根据节点 ID 查询当前图中的所有关联连线。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 关联连线列表。
 */
function findLeaferGraphLinksByNode(
  this: LeaferGraph,
  nodeId: string
): GraphLink[] {
  return getLeaferGraphApiHost(this).findLinksByNode(nodeId);
}

/**
 * 根据连线 ID 查询当前图中的正式连线快照。
 *
 * @param this - 当前图实例。
 * @param linkId - 目标连线 ID。
 * @returns 匹配到的正式连线。
 */
function getLeaferGraphLink(
  this: LeaferGraph,
  linkId: string
): GraphLink | undefined {
  return getLeaferGraphApiHost(this).getLink(linkId);
}

export const leaferGraphQueryFacadeMethods: LeaferGraphQueryFacade = {
  getNodeSnapshot: getLeaferGraphNodeSnapshot,
  getNodeInspectorState: getLeaferGraphNodeInspectorState,
  getNodeResizeConstraint: getLeaferGraphNodeResizeConstraint,
  getNodeExecutionState: getLeaferGraphNodeExecutionState,
  getGraphExecutionState: getLeaferGraphGraphExecutionState,
  getInteractionActivityState: getLeaferGraphInteractionActivityState,
  canResizeNode: canLeaferGraphResizeNode,
  resetNodeSize: resetLeaferGraphNodeSize,
  findLinksByNode: findLeaferGraphLinksByNode,
  getLink: getLeaferGraphLink
};
