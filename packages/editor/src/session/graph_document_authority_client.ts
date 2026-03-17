import type {
  GraphDocument,
  GraphOperation
} from "leafergraph";
import type { EditorRuntimeFeedbackInlet } from "../runtime/runtime_feedback_inlet";

/** authority 客户端提交操作时可见的最小上下文。 */
export interface EditorRemoteAuthorityOperationContext {
  /** 当前 editor 已知的正式文档快照。 */
  currentDocument: GraphDocument;
  /** 当前仍处于 pending 的操作 ID。 */
  pendingOperationIds: readonly string[];
}

/** authority 客户端回给 editor 的最小操作确认结果。 */
export interface EditorRemoteAuthorityOperationResult {
  /** 本次操作是否被 authority 接受。 */
  accepted: boolean;
  /** authority 是否确认这条操作真的改动了文档。 */
  changed: boolean;
  /** authority 确认后的文档 revision。 */
  revision: GraphDocument["revision"];
  /** 未接受或无变化时的最小原因。 */
  reason?: string;
  /**
   * authority 返回的新文档快照。
   *
   * @remarks
   * 当前阶段优先使用整图快照，后续若要补 patch / delta 再扩协议。
   */
  document?: GraphDocument;
}

/** authority 客户端替换整图时可见的最小上下文。 */
export interface EditorRemoteAuthorityReplaceDocumentContext {
  /** 替换前的正式文档快照。 */
  currentDocument: GraphDocument;
}

/**
 * editor 面向真实后端 authority 的最小客户端协议。
 *
 * @remarks
 * 这层先只约束“提交操作 / 替换文档 / 可选反馈订阅”三件事，
 * 不把 HTTP、WebSocket、gRPC 或 Dora 专属协议细节写进 session 层。
 */
export interface EditorRemoteAuthorityClient
  extends Partial<EditorRuntimeFeedbackInlet> {
  /** 提交一条正式图操作，并等待 authority 确认。 */
  submitOperation(
    operation: GraphOperation,
    context: EditorRemoteAuthorityOperationContext
  ): Promise<EditorRemoteAuthorityOperationResult>;
  /**
   * 替换整图文档。
   *
   * @remarks
   * 返回值可选；若未返回，则 session 继续以调用方传入的文档作为当前权威快照。
   */
  replaceDocument?(
    document: GraphDocument,
    context: EditorRemoteAuthorityReplaceDocumentContext
  ): Promise<GraphDocument | void>;
  /** 释放 authority 客户端资源。 */
  dispose?(): void;
}
