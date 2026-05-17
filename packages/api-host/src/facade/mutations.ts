/**
 * public façade 的节点与连线 mutation 方法组。
 */

import type {
  GraphLink,
  NodeRuntimeState
} from "@leafergraph/core/node";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "@leafergraph/core/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的节点与连线 mutation façade。
 */
export interface LeaferGraphMutationFacade {
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState;
  removeNode(nodeId: string): boolean;
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): NodeRuntimeState | undefined;
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): NodeRuntimeState | undefined;
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): NodeRuntimeState | undefined;
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  removeLink(linkId: string): boolean;
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void;
}

/**
 * 创建一个新的节点实例并立即挂到主包场景中。
 *
 * @param this - 当前图实例。
 * @param input - 节点创建输入。
 * @returns 新建的节点运行时状态。
 */
function createLeaferGraphNode(
  this: LeaferGraph,
  input: LeaferGraphCreateNodeInput
): NodeRuntimeState {
  return getLeaferGraphApiHost(this).createNode(input);
}

/**
 * 删除一个节点，并同步清理它的全部关联连线与视图。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 是否成功删除节点。
 */
function removeLeaferGraphNode(this: LeaferGraph, nodeId: string): boolean {
  return getLeaferGraphApiHost(this).removeNode(nodeId);
}

/**
 * 更新一个既有节点的静态内容与布局。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param input - 节点更新输入。
 * @returns 更新后的节点运行时状态。
 */
function updateLeaferGraphNode(
  this: LeaferGraph,
  nodeId: string,
  input: LeaferGraphUpdateNodeInput
): NodeRuntimeState | undefined {
  return getLeaferGraphApiHost(this).updateNode(nodeId, input);
}

/**
 * 移动一个节点到新的图坐标。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param position - 目标节点位置。
 * @returns 更新后的节点运行时状态。
 */
function moveLeaferGraphNode(
  this: LeaferGraph,
  nodeId: string,
  position: LeaferGraphMoveNodeInput
): NodeRuntimeState | undefined {
  return getLeaferGraphApiHost(this).moveNode(nodeId, position);
}

/**
 * 调整一个节点的显式宽高。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param size - 目标节点尺寸。
 * @returns 更新后的节点运行时状态。
 */
function resizeLeaferGraphNode(
  this: LeaferGraph,
  nodeId: string,
  size: LeaferGraphResizeNodeInput
): NodeRuntimeState | undefined {
  return getLeaferGraphApiHost(this).resizeNode(nodeId, size);
}

/**
 * 创建一条正式连线并加入当前图状态。
 *
 * @param this - 当前图实例。
 * @param input - 连线创建输入。
 * @returns 新建的正式连线。
 */
function createLeaferGraphLink(
  this: LeaferGraph,
  input: LeaferGraphCreateLinkInput
): GraphLink {
  return getLeaferGraphApiHost(this).createLink(input);
}

/**
 * 删除一条既有连线。
 *
 * @param this - 当前图实例。
 * @param linkId - 目标连线 ID。
 * @returns 是否成功删除连线。
 */
function removeLeaferGraphLink(this: LeaferGraph, linkId: string): boolean {
  return getLeaferGraphApiHost(this).removeLink(linkId);
}

/**
 * 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param widgetIndex - Widget 索引。
 * @param newValue - 新的 Widget 值。
 * @returns 无返回值。
 */
function setLeaferGraphNodeWidgetValue(
  this: LeaferGraph,
  nodeId: string,
  widgetIndex: number,
  newValue: unknown
): void {
  getLeaferGraphApiHost(this).setNodeWidgetValue(nodeId, widgetIndex, newValue);
}

export const leaferGraphMutationFacadeMethods: LeaferGraphMutationFacade = {
  createNode: createLeaferGraphNode,
  removeNode: removeLeaferGraphNode,
  updateNode: updateLeaferGraphNode,
  moveNode: moveLeaferGraphNode,
  resizeNode: resizeLeaferGraphNode,
  createLink: createLeaferGraphLink,
  removeLink: removeLeaferGraphLink,
  setNodeWidgetValue: setLeaferGraphNodeWidgetValue
};
