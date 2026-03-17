import type {
  GraphDocument,
  LeaferGraph,
  LeaferGraphNodeStateChangeReason,
  RuntimeFeedbackEvent
} from "leafergraph";
import type { EditorCommandExecution } from "../commands/command_bus";
import {
  createLoopbackGraphDocumentSession,
  type EditorGraphDocumentSession
} from "./graph_document_session";

/** 创建 document session binding 的最小输入。 */
export interface CreateEditorGraphDocumentSessionBindingOptions {
  graph: LeaferGraph;
  document: GraphDocument;
}

/**
 * GraphViewport 面向的最小 session binding。
 *
 * @remarks
 * command bus / history 只依赖 `session`；
 * GraphViewport 只依赖这里暴露的 runtime 钩子，
 * 这样未来要把 loopback 替换成 remote session 时，不需要再改视口主流程。
 */
export interface EditorGraphDocumentSessionBinding {
  /** 当前实际供 editor 命令层使用的 session。 */
  readonly session: EditorGraphDocumentSession;
  /** 命令执行后，用于把已落地结果同步回 session。 */
  handleCommandExecution(execution: EditorCommandExecution): void;
  /** 运行反馈进入 editor 后，允许 session 决定是否消费。 */
  handleRuntimeFeedback(feedback: RuntimeFeedbackEvent): void;
  /** 释放 binding 自己持有的资源。 */
  dispose(): void;
}

/** editor 当前阶段的 session binding 工厂。 */
export type EditorGraphDocumentSessionBindingFactory = (
  options: CreateEditorGraphDocumentSessionBindingOptions
) => EditorGraphDocumentSessionBinding;

/** 判断 loopback session 是否应该消费这类节点状态变化。 */
function shouldReconcileNodeStateReason(
  reason: LeaferGraphNodeStateChangeReason
): boolean {
  switch (reason) {
    case "created":
    case "updated":
    case "removed":
    case "moved":
    case "resized":
    case "collapsed":
    case "connections":
    case "widget-value":
      return true;
    default:
      return false;
  }
}

/**
 * 创建默认 loopback session binding。
 *
 * @remarks
 * 这层把“命令执行回填”和“运行反馈回填”从 GraphViewport 主流程中抽离出来，
 * 让未来 remote session 只需要替换 binding 工厂，不再穿透 editor 其它模块。
 */
export function createLoopbackGraphDocumentSessionBinding(
  options: CreateEditorGraphDocumentSessionBindingOptions
): EditorGraphDocumentSessionBinding {
  const session = createLoopbackGraphDocumentSession(options);

  return {
    session,

    handleCommandExecution(execution: EditorCommandExecution): void {
      if (execution.operations?.length && !execution.documentRecorded) {
        session.recordAppliedOperations(execution.operations);
      }
    },

    handleRuntimeFeedback(feedback: RuntimeFeedbackEvent): void {
      if (
        feedback.type === "node.state" &&
        shouldReconcileNodeStateReason(feedback.event.reason)
      ) {
        session.reconcileNodeState(feedback.event.nodeId, feedback.event.exists);
      }
    },

    dispose(): void {}
  };
}
