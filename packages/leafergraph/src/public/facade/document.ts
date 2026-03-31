/**
 * public façade 的文档与 diff 方法组。
 */

import type { GraphDocument } from "@leafergraph/node";
import type {
  ApplyGraphDocumentDiffResult,
  GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import type {
  GraphOperation,
  GraphOperationApplyResult
} from "@leafergraph/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";
import { projectLeaferGraphDocumentDiff } from "./diff_projection";

/**
 * `LeaferGraph` 的文档与 diff façade。
 */
export interface LeaferGraphDocumentFacade {
  replaceGraphDocument(document: GraphDocument): void;
  applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult;
  applyGraphDocumentDiff(
    diff: GraphDocumentDiff,
    nextDocument: GraphDocument
  ): ApplyGraphDocumentDiffResult;
}

/**
 * 直接替换当前正式文档。
 *
 * @param this - 当前图实例。
 * @param document - 新的正式文档。
 * @returns 无返回值。
 */
function replaceLeaferGraphDocument(
  this: LeaferGraph,
  document: GraphDocument
): void {
  getLeaferGraphApiHost(this).replaceGraphDocument(document);
}

/**
 * 应用一条正式图操作。
 *
 * @param this - 当前图实例。
 * @param operation - 需要应用的图操作。
 * @returns 图操作应用结果。
 */
function applyLeaferGraphOperation(
  this: LeaferGraph,
  operation: GraphOperation
): GraphOperationApplyResult {
  return getLeaferGraphApiHost(this).applyGraphOperation(operation);
}

/**
 * 按共享 diff 协议增量投影当前图文档。
 *
 * @remarks
 * 这里把“session 已经合并出的 nextDocument”作为第二输入传进来，
 * 避免主包在 scene 层再次自己推导文档真相。
 *
 * @param this - 当前图实例。
 * @param diff - 需要投影的文档差异。
 * @param nextDocument - 已经合并完成的下一步文档。
 * @returns 文档差异投影结果。
 */
function applyLeaferGraphDocumentDiff(
  this: LeaferGraph,
  diff: GraphDocumentDiff,
  nextDocument: GraphDocument
): ApplyGraphDocumentDiffResult {
  const apiHost = getLeaferGraphApiHost(this);
  const result = apiHost.runWithoutHistoryCapture(() =>
    projectLeaferGraphDocumentDiff(this, diff, nextDocument)
  );

  if (result.success && !result.requiresFullReplace) {
    apiHost.notifyHistoryReset("apply-document-diff");
  }

  return result;
}

export const leaferGraphDocumentFacadeMethods: LeaferGraphDocumentFacade = {
  replaceGraphDocument: replaceLeaferGraphDocument,
  applyGraphOperation: applyLeaferGraphOperation,
  applyGraphDocumentDiff: applyLeaferGraphDocumentDiff
};
