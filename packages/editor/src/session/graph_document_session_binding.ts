import type {
  GraphDocument,
  LeaferGraph,
  LeaferGraphNodeStateChangeReason,
  RuntimeFeedbackEvent
} from "leafergraph";
import type { EditorCommandExecution } from "../commands/command_bus";
import type { EditorRemoteAuthorityClient } from "./graph_document_authority_client";
import {
  createLoopbackGraphDocumentSession,
  createMockRemoteGraphDocumentSession,
  createRemoteGraphDocumentSession,
  type CreateMockRemoteGraphDocumentSessionOptions,
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
  /** 当前 binding 是否依赖 session 文档快照驱动 graph 投影。 */
  readonly projectsSessionDocument: boolean;
  /** 通过统一 authority 路径替换整图文档。 */
  replaceDocument(document: GraphDocument): void;
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

/** 当前可选的 authority 模式。 */
export type EditorGraphDocumentSessionAuthorityMode =
  | "loopback"
  | "remote-mock"
  | "remote-client";

/** remote-mock 模式可配置项。 */
export type RemoteMockSessionBindingOptions = Omit<
  CreateMockRemoteGraphDocumentSessionOptions,
  "graph" | "document"
>;

/** remote-client 模式可配置项。 */
export interface RemoteClientSessionBindingOptions {
  client: EditorRemoteAuthorityClient;
}

/** 可配置 session binding 工厂的最小参数。 */
export interface CreateConfigurableSessionBindingFactoryOptions {
  mode?: EditorGraphDocumentSessionAuthorityMode;
  remoteMock?: RemoteMockSessionBindingOptions;
  remoteClient?: RemoteClientSessionBindingOptions;
}

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

function createSessionBinding(
  session: EditorGraphDocumentSession,
  options: {
    authorityMode: EditorGraphDocumentSessionAuthorityMode;
    projectsSessionDocument?: boolean;
    shouldReconcileRuntimeNodeState?: boolean;
    dispose?: () => void;
  }
): EditorGraphDocumentSessionBinding {
  return {
    session,
    projectsSessionDocument: Boolean(options.projectsSessionDocument),

    replaceDocument(document: GraphDocument): void {
      session.replaceDocument(document);
    },

    handleCommandExecution(execution: EditorCommandExecution): void {
      if (
        options.authorityMode === "loopback" &&
        execution.operations?.length &&
        !execution.documentRecorded
      ) {
        session.recordAppliedOperations(execution.operations);
      }
    },

    handleRuntimeFeedback(feedback: RuntimeFeedbackEvent): void {
      if (
        options.shouldReconcileRuntimeNodeState !== false &&
        feedback.type === "node.state" &&
        shouldReconcileNodeStateReason(feedback.event.reason)
      ) {
        session.reconcileNodeState(feedback.event.nodeId, feedback.event.exists);
      }
    },

    dispose(): void {
      session.dispose?.();
      options.dispose?.();
    }
  };
}

function resolveAuthorityModeSession(
  options: CreateEditorGraphDocumentSessionBindingOptions,
  config: CreateConfigurableSessionBindingFactoryOptions
): EditorGraphDocumentSession {
  const mode = config.mode ?? "loopback";

  switch (mode) {
    case "remote-client": {
      if (!config.remoteClient?.client) {
        throw new Error("remote-client 模式缺少 authority client");
      }

      return createRemoteGraphDocumentSession({
        document: options.document,
        client: config.remoteClient.client
      });
    }
    case "remote-mock":
      return createMockRemoteGraphDocumentSession({
        graph: options.graph,
        document: options.document,
        ...config.remoteMock
      });
    case "loopback":
    default:
      return createLoopbackGraphDocumentSession(options);
  }
}

/**
 * 创建可切换 authority 模式的 session binding 工厂。
 *
 * @remarks
 * GraphViewport 继续只依赖同一个 binding 接口；
 * 切换 loopback / remote-mock 只需要替换工厂，不需要修改视口主流程。
 */
export function createConfigurableSessionBindingFactory(
  config: CreateConfigurableSessionBindingFactoryOptions = {}
): EditorGraphDocumentSessionBindingFactory {
  const authorityMode = config.mode ?? "loopback";

  return (
    options: CreateEditorGraphDocumentSessionBindingOptions
  ): EditorGraphDocumentSessionBinding => {
    const session = resolveAuthorityModeSession(options, config);
    return createSessionBinding(session, {
      authorityMode,
      projectsSessionDocument: authorityMode === "remote-client",
      shouldReconcileRuntimeNodeState: authorityMode !== "remote-client",
      dispose:
        authorityMode === "remote-client"
          ? () => {
              config.remoteClient?.client.dispose?.();
            }
          : undefined
    });
  };
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
  return createConfigurableSessionBindingFactory({
    mode: "loopback"
  })(options);
}

/** 创建 remote-mock 模式的 session binding。 */
export function createRemoteMockGraphDocumentSessionBinding(
  options: CreateEditorGraphDocumentSessionBindingOptions,
  remoteMock?: RemoteMockSessionBindingOptions
): EditorGraphDocumentSessionBinding {
  return createConfigurableSessionBindingFactory({
    mode: "remote-mock",
    remoteMock
  })(options);
}

/** 创建 remote-client 模式的 session binding。 */
export function createRemoteGraphDocumentSessionBinding(
  options: CreateEditorGraphDocumentSessionBindingOptions,
  remoteClient: RemoteClientSessionBindingOptions
): EditorGraphDocumentSessionBinding {
  return createConfigurableSessionBindingFactory({
    mode: "remote-client",
    remoteClient
  })(options);
}
