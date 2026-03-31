/**
 * 节点运行时连线变化 helper。
 *
 * @remarks
 * 负责节点 `onConnectionsChange` 分发和连接残留状态判断。
 */

import {
  createNodeApi,
  type GraphLink
} from "@leafergraph/node";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type {
  LeaferGraphNodeRuntimeContext,
  LeaferGraphRuntimeNodeViewState
} from "./types";

/**
 * 响应正式连线创建。
 *
 * @param context - 节点运行时上下文。
 * @param link - 新创建的正式连线。
 * @returns 无返回值。
 */
export function notifyLeaferGraphLinkCreated<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  link: GraphLink
): void {
  dispatchLeaferGraphNodeConnectionsChange(
    context,
    link.source.nodeId,
    "output",
    normalizeLeaferGraphConnectionSlot(link.source.slot),
    true
  );
  dispatchLeaferGraphNodeConnectionsChange(
    context,
    link.target.nodeId,
    "input",
    normalizeLeaferGraphConnectionSlot(link.target.slot),
    true
  );
  context.notifyNodeStateChanged(link.source.nodeId, "connections");
  context.notifyNodeStateChanged(link.target.nodeId, "connections");
}

/**
 * 响应正式连线移除。
 *
 * @param context - 节点运行时上下文。
 * @param link - 被移除的正式连线。
 * @returns 无返回值。
 */
export function notifyLeaferGraphLinkRemoved<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  link: GraphLink
): void {
  const sourceSlot = normalizeLeaferGraphConnectionSlot(link.source.slot);
  const targetSlot = normalizeLeaferGraphConnectionSlot(link.target.slot);

  dispatchLeaferGraphNodeConnectionsChange(
    context,
    link.source.nodeId,
    "output",
    sourceSlot,
    hasLeaferGraphNodeRemainingConnections(
      context,
      link.source.nodeId,
      "output",
      sourceSlot
    )
  );
  dispatchLeaferGraphNodeConnectionsChange(
    context,
    link.target.nodeId,
    "input",
    targetSlot,
    hasLeaferGraphNodeRemainingConnections(
      context,
      link.target.nodeId,
      "input",
      targetSlot
    )
  );
  context.notifyNodeStateChanged(link.source.nodeId, "connections");
  context.notifyNodeStateChanged(link.target.nodeId, "connections");
}

/**
 * 判断某个节点槽位是否还存在剩余连接。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param type - 端口方向。
 * @param slot - 目标槽位。
 * @returns 当前槽位是否仍有连接。
 */
export function hasLeaferGraphNodeRemainingConnections<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  type: "input" | "output",
  slot: number
): boolean {
  for (const link of context.options.graphLinks.values()) {
    if (
      type === "input" &&
      link.target.nodeId === nodeId &&
      normalizeLeaferGraphConnectionSlot(link.target.slot) === slot
    ) {
      return true;
    }

    if (
      type === "output" &&
      link.source.nodeId === nodeId &&
      normalizeLeaferGraphConnectionSlot(link.source.slot) === slot
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 分发节点连接变化到节点定义。
 *
 * @param context - 节点运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param type - 端口方向。
 * @param slot - 槽位索引。
 * @param connected - 当前是否仍处于已连接状态。
 * @returns 无返回值。
 */
export function dispatchLeaferGraphNodeConnectionsChange<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphNodeRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  type: "input" | "output",
  slot: number,
  connected: boolean
): void {
  const node = context.options.graphNodes.get(nodeId);
  const state = context.options.nodeViews.get(nodeId);
  if (!node || !state) {
    return;
  }

  const definition = context.options.nodeRegistry.getNode(node.type);
  if (!definition?.onConnectionsChange) {
    return;
  }

  try {
    definition.onConnectionsChange(
      node,
      type,
      slot,
      connected,
      createNodeApi(node, {
        definition,
        widgetDefinitions: context.options.widgetRegistry
      })
    );
  } catch (error) {
    console.error(
      `[leafergraph] 节点 onConnectionsChange 执行失败: ${node.type}#${node.id}`,
      {
        type,
        slot,
        connected
      },
      error
    );
  } finally {
    context.options.sceneRuntime.refreshNodeView(state);
    context.options.sceneRuntime.updateConnectedLinks(nodeId);
    context.options.sceneRuntime.requestRender();
  }
}

/**
 * 规范化连接槽位。
 *
 * @param slot - 原始槽位值。
 * @returns 可安全使用的槽位索引。
 */
export function normalizeLeaferGraphConnectionSlot(
  slot: number | undefined
): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

