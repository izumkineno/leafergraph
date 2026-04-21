/**
 * `LeaferGraphApiHost` 正式变更 helper。
 *
 * @remarks
 * 负责节点、连线和 widget 值写回，并同步补齐历史记录。
 */

import {
  createLinkCreateHistoryRecord,
  createLinkRemoveHistoryRecord,
  createNodeCreateHistoryRecord,
  createNodeMoveHistoryRecord,
  createNodeResizeHistoryRecord,
  createSnapshotHistoryRecord
} from "../../graph/history";
import { applyLeaferGraphApiGraphOperation } from "./document";
import type {
  LeaferGraphApiGraphOperation,
  LeaferGraphApiCreateLinkInput,
  LeaferGraphApiCreateNodeInput,
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiMoveNodeInput,
  LeaferGraphApiNodeViewState,
  LeaferGraphApiResizeNodeInput,
  LeaferGraphApiUpdateNodeInput
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { GraphLink } from "@leafergraph/core/node";

let apiMutationOperationSeed = 1;

/**
 * 设置单个节点的折叠态。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param collapsed - 目标折叠状态。
 * @returns 是否成功更新折叠态。
 */
export function setLeaferGraphApiNodeCollapsed<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  collapsed: boolean
): boolean {
  const result = applyLeaferGraphApiMutationOperation(context, {
    type: "node.collapse",
    nodeId,
    collapsed
  });
  return result.accepted && result.changed;
}

/**
 * 创建一个新的节点实例并立即挂到主包场景中。
 *
 * @param context - 当前 API 宿主上下文。
 * @param input - 节点创建输入。
 * @returns 创建出的节点运行时状态。
 */
export function createLeaferGraphApiNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  input: LeaferGraphApiCreateNodeInput
): TNodeState {
  const node = context.options.runtime.sceneRuntime.createNode(input);
  const nodeSnapshot =
    context.options.runtime.nodeRuntimeHost.getNodeSnapshot(node.id);
  if (nodeSnapshot) {
    context.emitHistoryRecord(
      createNodeCreateHistoryRecord({
        nodeSnapshot,
        source: "api"
      })
    );
  }

  return node;
}

/**
 * 删除一个节点，并同步清理它的全部关联连线与视图。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 是否成功删除节点。
 */
export function removeLeaferGraphApiNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): boolean {
  const beforeDocument = context.captureDocumentBeforeHistory();
  const changed = context.options.runtime.sceneRuntime.removeNode(nodeId);
  if (changed && beforeDocument) {
    context.emitHistoryRecord(
      createSnapshotHistoryRecord({
        beforeDocument,
        afterDocument: context.options.runtime.getGraphDocument(),
        source: "api",
        label: "Remove Node"
      })
    );
  }

  return changed;
}

/**
 * 更新一个既有节点的静态内容与布局。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param input - 节点更新输入。
 * @returns 更新后的节点运行时状态。
 */
export function updateLeaferGraphApiNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  input: LeaferGraphApiUpdateNodeInput
): TNodeState | undefined {
  const beforeDocument = context.captureDocumentBeforeHistory();
  const node = context.options.runtime.sceneRuntime.updateNode(nodeId, input);
  if (node && beforeDocument) {
    context.emitHistoryRecord(
      createSnapshotHistoryRecord({
        beforeDocument,
        afterDocument: context.options.runtime.getGraphDocument(),
        source: "api",
        label: "Update Node"
      })
    );
  }

  return node;
}

/**
 * 移动一个节点到新的图坐标。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param position - 节点移动输入。
 * @returns 更新后的节点运行时状态。
 */
export function moveLeaferGraphApiNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  position: LeaferGraphApiMoveNodeInput
): TNodeState | undefined {
  const beforeSnapshot = context.captureNodeSnapshotBeforeHistory(nodeId);
  const node = context.options.runtime.sceneRuntime.moveNode(nodeId, position);
  if (node && beforeSnapshot) {
    context.emitHistoryRecord(
      createNodeMoveHistoryRecord({
        nodeId,
        before: {
          x: beforeSnapshot.layout.x,
          y: beforeSnapshot.layout.y
        },
        after: {
          x: node.layout.x,
          y: node.layout.y
        },
        source: "api"
      })
    );
  }

  return node;
}

/**
 * 调整一个节点的显式宽高。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param size - 节点 resize 输入。
 * @returns 更新后的节点运行时状态。
 */
export function resizeLeaferGraphApiNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  size: LeaferGraphApiResizeNodeInput
): TNodeState | undefined {
  const beforeSnapshot = context.captureNodeSnapshotBeforeHistory(nodeId);
  const node = context.options.runtime.sceneRuntime.resizeNode(nodeId, size);
  if (node && beforeSnapshot) {
    const afterSnapshot =
      context.options.runtime.nodeRuntimeHost.getNodeSnapshot(nodeId);
    if (afterSnapshot) {
      context.emitHistoryRecord(
        createNodeResizeHistoryRecord({
          nodeId,
          before: context.resolveNodeSizeForHistory(nodeId, beforeSnapshot),
          after: context.resolveNodeSizeForHistory(nodeId, afterSnapshot),
          source: "api"
        })
      );
    }
  }

  return node;
}

/**
 * 创建一条正式连线并加入当前图状态。
 *
 * @param context - 当前 API 宿主上下文。
 * @param input - 连线创建输入。
 * @returns 创建出的正式连线。
 */
export function createLeaferGraphApiLink<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  input: LeaferGraphApiCreateLinkInput
): GraphLink {
  const link = context.options.runtime.sceneRuntime.createLink(input);
  context.emitHistoryRecord(
    createLinkCreateHistoryRecord({
      link,
      source: "api"
    })
  );
  return link;
}

/**
 * 删除一条既有连线。
 *
 * @param context - 当前 API 宿主上下文。
 * @param linkId - 目标连线 ID。
 * @returns 是否成功删除连线。
 */
export function removeLeaferGraphApiLink<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  linkId: string
): boolean {
  const beforeLink = context.shouldCaptureHistory()
    ? context.options.runtime.sceneRuntime.getLink(linkId)
    : undefined;
  const changed = context.options.runtime.sceneRuntime.removeLink(linkId);
  if (changed && beforeLink) {
    context.emitHistoryRecord(
      createLinkRemoveHistoryRecord({
        link: beforeLink,
        source: "api"
      })
    );
  }

  return changed;
}

/**
 * 更新某个节点某个 widget 的值。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @param widgetIndex - 目标 widget 索引。
 * @param newValue - 需要写入的新值。
 * @returns 无返回值。
 */
export function setLeaferGraphApiNodeWidgetValue<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string,
  widgetIndex: number,
  newValue: unknown
): void {
  applyLeaferGraphApiMutationOperation(context, {
    type: "node.widget.value.set",
    nodeId,
    widgetIndex,
    value: structuredClone(newValue)
  });
}

/**
 * 以 `source: "api"` 创建并应用一条正式图操作。
 *
 * @param context - 当前 API 宿主上下文。
 * @param input - 不含元信息的正式图操作输入。
 * @returns 图操作应用结果。
 */
function applyLeaferGraphApiMutationOperation<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState,
  TOperation extends GraphOperationInput
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  input: TOperation
) {
  return applyLeaferGraphApiGraphOperation(
    context,
    createLeaferGraphApiMutationOperation(input)
  );
}

/**
 * 为 API 直接 mutation 构造带元信息的正式图操作。
 *
 * @param input - 不含元信息的正式图操作输入。
 * @returns 完整正式图操作。
 */
function createLeaferGraphApiMutationOperation<
  TOperation extends GraphOperationInput
>(input: TOperation): LeaferGraphApiGraphOperation {
  const operation = {
    ...input,
    operationId: `api-mutation:${input.type}:${Date.now()}:${apiMutationOperationSeed}`,
    timestamp: Date.now(),
    source: "api"
  } satisfies LeaferGraphApiGraphOperation;
  apiMutationOperationSeed += 1;
  return operation;
}

type GraphOperationInput = {
  [TType in LeaferGraphApiGraphOperation["type"]]: Omit<
    Extract<LeaferGraphApiGraphOperation, { type: TType }>,
    "operationId" | "timestamp" | "source"
  >;
}[LeaferGraphApiGraphOperation["type"]];
