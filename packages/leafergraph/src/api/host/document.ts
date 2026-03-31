/**
 * `LeaferGraphApiHost` 正式图文档 helper。
 *
 * @remarks
 * 负责正式图查询、整图替换和正式图操作的历史捕获。
 */

import {
  createLinkCreateHistoryRecord,
  createLinkReconnectHistoryRecord,
  createLinkRemoveHistoryRecord,
  createNodeCreateHistoryRecord,
  createNodeMoveHistoryRecord,
  createNodeResizeHistoryRecord,
  createSnapshotHistoryRecord
} from "../../graph/history";
import type {
  LeaferGraphApiGraphOperation,
  LeaferGraphApiGraphOperationResult,
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { GraphDocument, GraphLink } from "@leafergraph/node";

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

  // 再按正式操作类型分派对应的 history record，保持 operation / snapshot 语义不漂移。
  switch (operation.type) {
    case "node.create": {
      const nodeSnapshot = result.affectedNodeIds[0]
        ? runtime.nodeRuntimeHost.getNodeSnapshot(result.affectedNodeIds[0])
        : undefined;
      if (nodeSnapshot) {
        context.emitHistoryRecord(
          createNodeCreateHistoryRecord({
            nodeSnapshot,
            source: operation.source || "api"
          })
        );
      }
      break;
    }
    case "node.move": {
      const afterSnapshot = runtime.nodeRuntimeHost.getNodeSnapshot(operation.nodeId);
      if (beforeNodeSnapshot && afterSnapshot) {
        context.emitHistoryRecord(
          createNodeMoveHistoryRecord({
            nodeId: operation.nodeId,
            before: {
              x: beforeNodeSnapshot.layout.x,
              y: beforeNodeSnapshot.layout.y
            },
            after: {
              x: afterSnapshot.layout.x,
              y: afterSnapshot.layout.y
            },
            source: operation.source || "api"
          })
        );
      }
      break;
    }
    case "node.resize": {
      const afterSnapshot = runtime.nodeRuntimeHost.getNodeSnapshot(operation.nodeId);
      if (beforeNodeSnapshot && afterSnapshot) {
        context.emitHistoryRecord(
          createNodeResizeHistoryRecord({
            nodeId: operation.nodeId,
            before: context.resolveNodeSizeForHistory(
              operation.nodeId,
              beforeNodeSnapshot
            ),
            after: context.resolveNodeSizeForHistory(
              operation.nodeId,
              afterSnapshot
            ),
            source: operation.source || "api"
          })
        );
      }
      break;
    }
    case "link.create": {
      const link = result.affectedLinkIds[0]
        ? runtime.sceneRuntime.getLink(result.affectedLinkIds[0])
        : undefined;
      if (link) {
        context.emitHistoryRecord(
          createLinkCreateHistoryRecord({
            link,
            source: operation.source || "api"
          })
        );
      }
      break;
    }
    case "link.remove":
      if (beforeLink) {
        context.emitHistoryRecord(
          createLinkRemoveHistoryRecord({
            link: beforeLink,
            source: operation.source || "api"
          })
        );
      }
      break;
    case "link.reconnect": {
      const afterLink = runtime.sceneRuntime.getLink(operation.linkId);
      if (beforeLink && afterLink) {
        context.emitHistoryRecord(
          createLinkReconnectHistoryRecord({
            linkId: operation.linkId,
            before: beforeLink,
            after: afterLink,
            source: operation.source || "api"
          })
        );
      }
      break;
    }
    case "node.update":
    case "node.remove":
    case "document.update":
      context.emitHistoryRecord(
        createSnapshotHistoryRecord({
          beforeDocument,
          afterDocument: runtime.getGraphDocument(),
          source: operation.source || "api",
          label: resolveSnapshotOperationLabel(operation.type)
        })
      );
      break;
  }

  return result;
}

/**
 * 解析快照类图操作的默认历史标签。
 *
 * @param type - 当前图操作类型。
 * @returns 快照历史标签。
 */
export function resolveSnapshotOperationLabel(
  type: "node.update" | "node.remove" | "document.update"
): string {
  switch (type) {
    case "node.remove":
      return "Remove Node";
    case "document.update":
      return "Update Document";
    case "node.update":
    default:
      return "Update Node";
  }
}
