/**
 * 图文档 diff 轻量子出口。
 *
 * @remarks
 * 负责导出不依赖 UI 宿主的文档 diff 工具，供同步层等纯数据模块复用。
 */
export {
  applyGraphDocumentDiffToDocument,
  createUpdateNodeInputFromNodeSnapshot
} from "./api/graph_document_diff";
export type {
  ApplyGraphDocumentDiffResult,
  GraphDocumentDiff,
  GraphDocumentFieldChange
} from "./api/graph_document_diff";
