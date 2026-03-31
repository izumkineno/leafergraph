/**
 * public façade 的图文档 diff 投影能力。
 */

import type { Group } from "leafer-ui";
import type {
  GraphDocument,
  NodeSerializeResult
} from "@leafergraph/node";
import {
  createUpdateNodeInputFromNodeSnapshot,
  type ApplyGraphDocumentDiffResult,
  type GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import type { LeaferGraphUpdateNodeInput } from "@leafergraph/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

interface LeaferGraphFindHost {
  findId?(id: string): unknown;
  findOne?(query: { id?: string }): unknown;
}

/**
 * 按 ID 查找当前场景里的目标图元。
 *
 * @param host - 目标图层宿主。
 * @param id - 目标图元 ID。
 * @returns 匹配到的图元结果。
 */
function findGraphicById(host: Group, id: string): unknown {
  const findHost = host as Group & LeaferGraphFindHost;
  return findHost.findId?.(id) ?? findHost.findOne?.({ id });
}

/**
 * 在文档中查找节点快照。
 *
 * @param document - 目标文档。
 * @param nodeId - 目标节点 ID。
 * @returns 匹配到的节点快照。
 */
function findNodeSnapshotInDocument(
  document: GraphDocument,
  nodeId: string
): NodeSerializeResult | undefined {
  return document.nodes.find((node) => node.id === nodeId);
}

/**
 * 根据节点快照创建一次完整刷新输入。
 *
 * @param options - 当前与下一步快照信息。
 * @returns 可用于 `updateNode(...)` 的刷新输入。
 */
function createRefreshNodeInput(options: {
  currentSnapshot?: NodeSerializeResult;
  nextSnapshot: NodeSerializeResult;
}): LeaferGraphUpdateNodeInput | null {
  // 先把下一步快照归一化成正式 update 输入，确保基础字段齐全。
  const input = createUpdateNodeInputFromNodeSnapshot(options.nextSnapshot);
  const currentSnapshot = options.currentSnapshot;
  if (!currentSnapshot) {
    return input;
  }

  // 再按“旧快照显式存在但新快照缺失”的情况补齐清空语义，避免局部刷新漏删字段。
  if (currentSnapshot.title !== undefined && options.nextSnapshot.title === undefined) {
    return null;
  }
  if (
    currentSnapshot.properties !== undefined &&
    options.nextSnapshot.properties === undefined
  ) {
    input.properties = {};
  }
  if (
    currentSnapshot.propertySpecs !== undefined &&
    options.nextSnapshot.propertySpecs === undefined
  ) {
    input.propertySpecs = [];
  }
  if (currentSnapshot.inputs !== undefined && options.nextSnapshot.inputs === undefined) {
    input.inputs = [];
  }
  if (
    currentSnapshot.outputs !== undefined &&
    options.nextSnapshot.outputs === undefined
  ) {
    input.outputs = [];
  }
  if (
    currentSnapshot.widgets !== undefined &&
    options.nextSnapshot.widgets === undefined
  ) {
    input.widgets = [];
  }
  if (currentSnapshot.data !== undefined && options.nextSnapshot.data === undefined) {
    input.data = {};
  }
  if (currentSnapshot.flags !== undefined && options.nextSnapshot.flags === undefined) {
    input.flags = {};
  }

  // 最后返回可直接交给 `updateNode(...)` 的完整刷新输入。
  return input;
}

/**
 * 创建一条需要整图替换的 diff 投影回退结果。
 *
 * @param document - 回退时使用的目标文档。
 * @param options - 回退原因配置。
 * @returns 标记为 full replace 的失败结果。
 */
function createDiffProjectionFallback(
  document: GraphDocument,
  options: {
    reason: string;
  }
): ApplyGraphDocumentDiffResult {
  return {
    success: false,
    requiresFullReplace: true,
    document: structuredClone(document),
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason: options.reason
  };
}

/**
 * 优先调用 façade 方法，缺失时再回退到 `apiHost`。
 *
 * @param graph - 当前图实例。
 * @param methodName - 目标 façade 方法名。
 * @param fallback - 方法缺失时的回退实现。
 * @param args - 调用参数。
 * @returns façade 方法或回退实现的结果。
 */
function callLeaferGraphFacadeMethod<TArgs extends unknown[], TResult>(
  graph: LeaferGraph,
  methodName: string,
  fallback: (...args: TArgs) => TResult,
  ...args: TArgs
): TResult {
  const candidate = (graph as unknown as Record<string, unknown>)[methodName];
  if (typeof candidate === "function") {
    return (candidate as (...args: TArgs) => TResult).apply(graph, args);
  }

  return fallback(...args);
}

/**
 * 把共享 diff 协议增量投影到当前图运行时。
 *
 * @remarks
 * 这里故意停留在 public façade 层：
 * 既复用现有正式 API，又避免把“authority diff 协议”的理解塞回更底层宿主。
 *
 * @param graph - 当前图实例。
 * @param diff - 需要投影的文档差异。
 * @param nextDocument - 已经合并完成的下一步文档。
 * @returns 图文档 diff 投影结果。
 */
export function projectLeaferGraphDocumentDiff(
  graph: LeaferGraph,
  diff: GraphDocumentDiff,
  nextDocument: GraphDocument
): ApplyGraphDocumentDiffResult {
  const apiHost = getLeaferGraphApiHost(graph);
  if (
    diff.documentId !== nextDocument.documentId ||
    diff.revision !== nextDocument.revision
  ) {
    return createDiffProjectionFallback(nextDocument, {
      reason: "diff 与 nextDocument 不一致，必须回退到整图替换"
    });
  }

  const affectedNodeIds = new Set<string>();
  const affectedLinkIds = new Set<string>();
  const nodeIdsNeedingFullRefresh = new Set<string>();
  const nodesWithNonFastFieldChanges = new Set(
    diff.fieldChanges
      .filter((fieldChange) => fieldChange.type !== "node.widget.value.set")
      .map((fieldChange) => fieldChange.nodeId)
  );

  // 先按 operation 顺序投影正式图结构变更，尽量走最小增量路径。
  for (const operation of diff.operations) {
    try {
      switch (operation.type) {
        case "document.update":
          continue;
        case "node.create": {
          const nodeId = operation.input.id;
          if (!nodeId || findGraphicById(graph.nodeLayer, `node-${nodeId}`)) {
            return createDiffProjectionFallback(nextDocument, {
              reason: "node.create 无法安全增量投影"
            });
          }
          callLeaferGraphFacadeMethod(
            graph,
            "createNode",
            (input) => apiHost.createNode(input),
            operation.input
          );
          affectedNodeIds.add(nodeId);
          continue;
        }
        case "node.update": {
          const snapshot = findNodeSnapshotInDocument(nextDocument, operation.nodeId);
          const currentSnapshot = callLeaferGraphFacadeMethod(
            graph,
            "getNodeSnapshot",
            (nodeId) => apiHost.getNodeSnapshot(nodeId),
            operation.nodeId
          );
          const refreshInput =
            snapshot && currentSnapshot
              ? createRefreshNodeInput({
                  currentSnapshot,
                  nextSnapshot: snapshot
                })
              : null;
          if (
            !snapshot ||
            !refreshInput ||
            !findGraphicById(graph.nodeLayer, `node-${operation.nodeId}`)
          ) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `node.update 目标节点缺失: ${operation.nodeId}`
            });
          }
          if (
            !callLeaferGraphFacadeMethod(
              graph,
              "updateNode",
              (nodeId, input) => apiHost.updateNode(nodeId, input),
              operation.nodeId,
              refreshInput
            )
          ) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `node.update 投影失败: ${operation.nodeId}`
            });
          }
          affectedNodeIds.add(operation.nodeId);
          continue;
        }
        case "node.move":
          if (
            !findGraphicById(graph.nodeLayer, `node-${operation.nodeId}`) ||
            !callLeaferGraphFacadeMethod(
              graph,
              "moveNode",
              (nodeId, input) => apiHost.moveNode(nodeId, input),
              operation.nodeId,
              operation.input
            )
          ) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `node.move 投影失败: ${operation.nodeId}`
            });
          }
          affectedNodeIds.add(operation.nodeId);
          continue;
        case "node.resize":
          if (
            !findGraphicById(graph.nodeLayer, `node-${operation.nodeId}`) ||
            !callLeaferGraphFacadeMethod(
              graph,
              "resizeNode",
              (nodeId, input) => apiHost.resizeNode(nodeId, input),
              operation.nodeId,
              operation.input
            )
          ) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `node.resize 投影失败: ${operation.nodeId}`
            });
          }
          affectedNodeIds.add(operation.nodeId);
          continue;
        case "node.remove":
          if (
            !findGraphicById(graph.nodeLayer, `node-${operation.nodeId}`) ||
            !callLeaferGraphFacadeMethod(
              graph,
              "removeNode",
              (nodeId) => apiHost.removeNode(nodeId),
              operation.nodeId
            )
          ) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `node.remove 投影失败: ${operation.nodeId}`
            });
          }
          affectedNodeIds.add(operation.nodeId);
          continue;
        case "link.create": {
          const linkId = operation.input.id;
          if (!linkId || findGraphicById(graph.linkLayer, `graph-link-${linkId}`)) {
            return createDiffProjectionFallback(nextDocument, {
              reason: "link.create 无法安全增量投影"
            });
          }
          callLeaferGraphFacadeMethod(
            graph,
            "createLink",
            (input) => apiHost.createLink(input),
            operation.input
          );
          affectedNodeIds.add(operation.input.source.nodeId);
          affectedNodeIds.add(operation.input.target.nodeId);
          affectedLinkIds.add(linkId);
          continue;
        }
        case "link.remove":
          if (
            !findGraphicById(graph.linkLayer, `graph-link-${operation.linkId}`) ||
            !callLeaferGraphFacadeMethod(
              graph,
              "removeLink",
              (linkId) => apiHost.removeLink(linkId),
              operation.linkId
            )
          ) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `link.remove 投影失败: ${operation.linkId}`
            });
          }
          affectedLinkIds.add(operation.linkId);
          continue;
        case "link.reconnect": {
          if (!findGraphicById(graph.linkLayer, `graph-link-${operation.linkId}`)) {
            return createDiffProjectionFallback(nextDocument, {
              reason: `link.reconnect 目标连线缺失: ${operation.linkId}`
            });
          }
          const result = callLeaferGraphFacadeMethod(
            graph,
            "applyGraphOperation",
            (nextOperation) => apiHost.applyGraphOperation(nextOperation),
            operation
          );
          if (!result.accepted) {
            return createDiffProjectionFallback(nextDocument, {
              reason: result.reason ?? `link.reconnect 投影失败: ${operation.linkId}`
            });
          }
          result.affectedNodeIds.forEach((nodeId: string) =>
            affectedNodeIds.add(nodeId)
          );
          result.affectedLinkIds.forEach((linkId: string) =>
            affectedLinkIds.add(linkId)
          );
          continue;
        }
      }
    } catch (error) {
      return createDiffProjectionFallback(nextDocument, {
        reason: error instanceof Error ? error.message : "diff 增量投影时发生未知异常"
      });
    }
  }

  // 再处理 field change：优先走 widget fast path，剩余节点回退到完整 refresh。
  for (const fieldChange of diff.fieldChanges) {
    if (fieldChange.type === "node.widget.value.set") {
      if (
        !nodesWithNonFastFieldChanges.has(fieldChange.nodeId) &&
        findGraphicById(
          graph.nodeLayer,
          `widget-${fieldChange.nodeId}-${fieldChange.widgetIndex}`
        )
      ) {
        callLeaferGraphFacadeMethod(
          graph,
          "setNodeWidgetValue",
          (nodeId, widgetIndex, value) =>
            apiHost.setNodeWidgetValue(nodeId, widgetIndex, value),
          fieldChange.nodeId,
          fieldChange.widgetIndex,
          fieldChange.value
        );
        affectedNodeIds.add(fieldChange.nodeId);
        continue;
      }
    }

    nodeIdsNeedingFullRefresh.add(fieldChange.nodeId);
  }

  // 最后把无法走 fast path 的节点统一刷新，并整理最终受影响集合。
  for (const nodeId of nodeIdsNeedingFullRefresh) {
    const snapshot = findNodeSnapshotInDocument(nextDocument, nodeId);
    const currentSnapshot = callLeaferGraphFacadeMethod(
      graph,
      "getNodeSnapshot",
      (nextNodeId) => apiHost.getNodeSnapshot(nextNodeId),
      nodeId
    );
    const refreshInput =
      snapshot && currentSnapshot
        ? createRefreshNodeInput({
            currentSnapshot,
            nextSnapshot: snapshot
          })
        : null;
    if (!snapshot || !refreshInput || !findGraphicById(graph.nodeLayer, `node-${nodeId}`)) {
      return createDiffProjectionFallback(nextDocument, {
        reason: `fieldChanges 无法安全刷新节点: ${nodeId}`
      });
    }

    if (
      !callLeaferGraphFacadeMethod(
        graph,
        "updateNode",
        (nextNodeId, input) => apiHost.updateNode(nextNodeId, input),
        nodeId,
        refreshInput
      )
    ) {
      return createDiffProjectionFallback(nextDocument, {
        reason: `fieldChanges 节点刷新失败: ${nodeId}`
      });
    }

    affectedNodeIds.add(nodeId);
  }

  return {
    success: true,
    requiresFullReplace: false,
    document: structuredClone(nextDocument),
    affectedNodeIds: [...affectedNodeIds],
    affectedLinkIds: [...affectedLinkIds]
  };
}
