/**
 * public façade 的选区与折叠方法组。
 */

import type { LeaferGraphSelectionUpdateMode } from "@leafergraph/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的选区与折叠 façade。
 */
export interface LeaferGraphSelectionFacade {
  setNodeSelected(nodeId: string, selected: boolean): boolean;
  listSelectedNodeIds(): string[];
  isNodeSelected(nodeId: string): boolean;
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  clearSelectedNodes(): string[];
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
}

/**
 * 设置单个节点的选中态。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param selected - 是否选中。
 * @returns 是否成功完成写回。
 */
function setLeaferGraphNodeSelected(
  this: LeaferGraph,
  nodeId: string,
  selected: boolean
): boolean {
  return getLeaferGraphApiHost(this).setNodeSelected(nodeId, selected);
}

/**
 * 列出当前全部已选节点 ID。
 *
 * @param this - 当前图实例。
 * @returns 已选节点 ID 列表。
 */
function listLeaferGraphSelectedNodeIds(this: LeaferGraph): string[] {
  return getLeaferGraphApiHost(this).listSelectedNodeIds();
}

/**
 * 判断单个节点当前是否处于选中态。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @returns 当前节点是否选中。
 */
function isLeaferGraphNodeSelected(
  this: LeaferGraph,
  nodeId: string
): boolean {
  return getLeaferGraphApiHost(this).isNodeSelected(nodeId);
}

/**
 * 按正式选区更新模式批量写回当前节点选区。
 *
 * @param this - 当前图实例。
 * @param nodeIds - 节点 ID 列表。
 * @param mode - 选区更新模式。
 * @returns 更新后的选区列表。
 */
function setLeaferGraphSelectedNodeIds(
  this: LeaferGraph,
  nodeIds: readonly string[],
  mode: LeaferGraphSelectionUpdateMode = "replace"
): string[] {
  return getLeaferGraphApiHost(this).setSelectedNodeIds(nodeIds, mode);
}

/**
 * 清空当前全部节点选区。
 *
 * @param this - 当前图实例。
 * @returns 被清空的节点 ID 列表。
 */
function clearLeaferGraphSelectedNodes(this: LeaferGraph): string[] {
  return getLeaferGraphApiHost(this).clearSelectedNodes();
}

/**
 * 设置单个节点的折叠态。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param collapsed - 是否折叠。
 * @returns 是否成功完成写回。
 */
function setLeaferGraphNodeCollapsed(
  this: LeaferGraph,
  nodeId: string,
  collapsed: boolean
): boolean {
  return getLeaferGraphApiHost(this).setNodeCollapsed(nodeId, collapsed);
}

export const leaferGraphSelectionFacadeMethods: LeaferGraphSelectionFacade = {
  setNodeSelected: setLeaferGraphNodeSelected,
  listSelectedNodeIds: listLeaferGraphSelectedNodeIds,
  isNodeSelected: isLeaferGraphNodeSelected,
  setSelectedNodeIds: setLeaferGraphSelectedNodeIds,
  clearSelectedNodes: clearLeaferGraphSelectedNodes,
  setNodeCollapsed: setLeaferGraphNodeCollapsed
};
