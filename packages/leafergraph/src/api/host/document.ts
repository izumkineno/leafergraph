/**
 * `LeaferGraphApiHost` 正式图文档 helper。
 *
 * @remarks
 * 负责正式图查询、整图替换和正式图操作的历史捕获。
 */

import type {
  LeaferGraphApiGraphOperation,
  LeaferGraphApiGraphOperationResult,
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { GraphDocument, GraphLink } from "@leafergraph/node";
import { emitLeaferGraphApiGraphOperationHistory } from "./document_history";

/**
 * 直接替换当前正式文档。
 *
 * @param context - 当前 API 宿主上下文。
 * @param document - 需要替换进去的正式文档。
 * @returns 无返回值。
 */
export function replaceLeaferGraphApiDocument<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  document: GraphDocument
): void {
  context.options.runtime.bootstrapRuntime.replaceGraphDocument(document);
  context.notifyHistoryReset("replace-document");
}

/**
 * 根据节点 ID 查询当前图中的所有关联连线。
 *
 * @param context - 当前 API 宿主上下文。
 * @param nodeId - 目标节点 ID。
 * @returns 关联连线列表。
 */
export function findLeaferGraphApiLinksByNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  nodeId: string
): GraphLink[] {
  return context.options.runtime.sceneRuntime.findLinksByNode(nodeId);
}

/**
 * 根据连线 ID 读取当前图中的正式连线快照。
 *
 * @param context - 当前 API 宿主上下文。
 * @param linkId - 目标连线 ID。
 * @returns 当前正式连线快照。
 */
export function getLeaferGraphApiLink<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  linkId: string
): GraphLink | undefined {
  return context.options.runtime.sceneRuntime.getLink(linkId);
}

/**
 * 应用一条正式图操作，并在需要时同步生成历史记录。
 *
 * @param context - 当前 API 宿主上下文。
 * @param operation - 需要应用的正式图操作。
 * @returns 图操作应用结果。
 */
export function applyLeaferGraphApiGraphOperation<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  operation: LeaferGraphApiGraphOperation
): LeaferGraphApiGraphOperationResult {
  // 先捕获当前正式文档与受影响实体的“before”快照，为后续 history 分类提供稳定输入。
  const runtime = context.options.runtime;
  const beforeDocument = context.captureDocumentBeforeHistory();
  const beforeNodeSnapshot =
    operation.type === "node.create"
      ? undefined
      : operation.type.startsWith("node.")
        ? runtime.nodeRuntimeHost.getNodeSnapshot(
            "nodeId" in operation ? operation.nodeId : ""
          )
        : undefined;
  const beforeLink =
    operation.type === "link.remove" || operation.type === "link.reconnect"
      ? runtime.sceneRuntime.getLink(operation.linkId)
      : undefined;
  const result = runtime.sceneRuntime.applyGraphOperation(operation);

  if (!result.accepted || !result.changed || !beforeDocument) {
    return result;
  }

  emitLeaferGraphApiGraphOperationHistory({
    context,
    operation,
    result,
    beforeDocument,
    beforeNodeSnapshot,
    beforeLink
  });

  return result;
}
