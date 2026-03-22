import type {
  GraphDocument,
  GraphOperation
} from "leafergraph";
import type { EditorRuntimeFeedbackInlet } from "../runtime/runtime_feedback_inlet";
import type {
  EditorRemoteAuthorityDocumentInlet,
  EditorRemoteAuthorityDocumentDiffInlet,
  EditorRemoteAuthorityOperationContext,
  EditorRemoteAuthorityOperationResult,
  EditorRemoteAuthorityRuntimeControlRequest,
  EditorRemoteAuthorityRuntimeControlResult,
  EditorRemoteAuthorityReplaceDocumentContext
} from "./graph_document_authority_client";

/**
 * authority 宿主 / 后端侧最小服务接口。
 *
 * @remarks
 * 这层专门表达“协议对端真正需要实现什么”，
 * 让 MessagePort、后续其他 transport 只做适配，不重复发明业务接口。
 */
export interface EditorRemoteAuthorityDocumentService
  extends Partial<EditorRuntimeFeedbackInlet>,
    Partial<EditorRemoteAuthorityDocumentInlet>,
    Partial<EditorRemoteAuthorityDocumentDiffInlet> {
  /** 返回当前 authority 持有的正式图文档。 */
  getDocument(): GraphDocument | Promise<GraphDocument>;
  /** 提交一条图操作，并返回 authority 确认结果。 */
  submitOperation(
    operation: GraphOperation,
    context: EditorRemoteAuthorityOperationContext
  ): EditorRemoteAuthorityOperationResult | Promise<EditorRemoteAuthorityOperationResult>;
  /** 替换当前 authority 持有的正式图文档。 */
  replaceDocument(
    document: GraphDocument,
    context: EditorRemoteAuthorityReplaceDocumentContext
  ): GraphDocument | void | Promise<GraphDocument | void>;
  /** 执行一次 authority 运行控制请求。 */
  controlRuntime?(
    request: EditorRemoteAuthorityRuntimeControlRequest
  ): EditorRemoteAuthorityRuntimeControlResult | Promise<EditorRemoteAuthorityRuntimeControlResult>;
  /** 释放 authority 服务资源。 */
  dispose?(): void;
}
