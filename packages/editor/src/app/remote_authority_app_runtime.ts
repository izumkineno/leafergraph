import type { GraphDocument } from "leafergraph";
import type { EditorRuntimeFeedbackInlet } from "../runtime/runtime_feedback_inlet";
import {
  createConfigurableSessionBindingFactory,
  type EditorGraphDocumentSessionBindingFactory
} from "../session/graph_document_session_binding";
import {
  createTransportRemoteAuthorityClient,
  type EditorRemoteAuthorityDocumentClient,
  type EditorRemoteAuthorityTransport
} from "../session/graph_document_authority_transport";
import type { EditorRemoteAuthorityDocumentService } from "../session/graph_document_authority_service";
import type { EditorRemoteAuthorityConnectionStatus } from "../session/graph_document_authority_client";
import { createMessagePortRemoteAuthorityTransport } from "../session/message_port_remote_authority_transport";
import { createMessagePortRemoteAuthorityHost } from "../session/message_port_remote_authority_host";
import { DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE } from "../session/message_port_remote_authority_bridge_host";

/** editor 浏览器侧可装配的 remote authority 来源。 */
export interface EditorRemoteAuthorityAppSource {
  /** 当前 authority 来源的人类可读标题。 */
  label: string;
  /** 可选补充说明。 */
  description?: string;
  /**
   * 为一次画布挂载创建新的 authority client。
   *
   * @remarks
   * 若同时提供 `createClient` 和 `createTransport`，优先使用 `createClient`。
   */
  createClient?():
    | EditorRemoteAuthorityDocumentClient
    | Promise<EditorRemoteAuthorityDocumentClient>;
  /**
   * 为一次画布挂载创建新的 authority transport。
   *
   * @remarks
   * 这条路径用于浏览器内正式 transport 装配。
   * 若未提供 `createClient`，runtime 会自动把 transport 包装成标准 authority client。
   */
  createTransport?():
    | EditorRemoteAuthorityTransport
    | Promise<EditorRemoteAuthorityTransport>;
  /**
   * 可选自定义整图加载逻辑。
   *
   * @remarks
   * 未提供时默认调用 `client.getDocument()`。
   */
  loadDocument?(
    client: EditorRemoteAuthorityDocumentClient
  ): GraphDocument | Promise<GraphDocument>;
}

/** 基于 MessagePort 创建 authority source 的最小参数。 */
export interface CreateEditorRemoteAuthorityMessagePortSourceOptions {
  /** 当前 authority 来源标题。 */
  label?: string;
  /** 当前 authority 来源说明。 */
  description?: string;
  /** 浏览器原生消息端口。 */
  port: MessagePort;
  /**
   * 释放 runtime 时是否关闭 port。
   *
   * @remarks
   * 这里默认 `false`，因为 bootstrap 场景下通常会复用同一个长连接 port。
   */
  closePortOnDispose?: boolean;
}

/** 运行在主线程侧、可接收 `postMessage(..., [port])` 的最小宿主。 */
export interface EditorRemoteAuthorityPortConnectorTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
}

/** 运行在主线程侧、可接收 `postMessage(message, targetOrigin, [port])` 的最小窗口宿主。 */
export interface EditorRemoteAuthorityWindowTarget {
  postMessage(
    message: unknown,
    targetOrigin: string,
    transfer: Transferable[]
  ): void;
}

/** 基于连接回调创建 MessagePort authority source 的最小参数。 */
export interface CreateEditorRemoteAuthorityMessagePortConnectorSourceOptions {
  /** 当前 authority 来源标题。 */
  label?: string;
  /** 当前 authority 来源说明。 */
  description?: string;
  /**
   * 为本次 runtime 挂载把 port 连接到外部 authority 宿主。
   *
   * @remarks
   * 这里不要求宿主一定是 worker，也可以是自定义 bridge、iframe 容器或其他消息宿主。
   */
  connect(port: MessagePort): void | Promise<void>;
  /**
   * 释放 transport 时是否关闭 port。
   *
   * @remarks
   * connector source 默认创建的是专用 channel，因此这里默认 `true`。
   */
  closePortOnDispose?: boolean;
  /** transport 释放时的额外清理钩子。 */
  onTransportDispose?(): void;
}

/** 基于 worker 创建 authority source 的最小参数。 */
export interface CreateEditorRemoteAuthorityWorkerSourceOptions {
  /** 当前 authority 来源标题。 */
  label?: string;
  /** 当前 authority 来源说明。 */
  description?: string;
  /** 负责承接 authority host 的 worker。 */
  worker: EditorRemoteAuthorityPortConnectorTarget & {
    terminate?(): void;
  };
  /** 握手消息类型。 */
  handshakeType?: string;
  /** transport 释放时是否终止 worker。 */
  terminateWorkerOnDispose?: boolean;
  /** transport 释放时是否关闭专用 MessagePort。 */
  closePortOnDispose?: boolean;
}

/** 基于 window / iframe 创建 authority source 的最小参数。 */
export interface CreateEditorRemoteAuthorityWindowSourceOptions {
  /** 当前 authority 来源标题。 */
  label?: string;
  /** 当前 authority 来源说明。 */
  description?: string;
  /** 负责承接 authority host 的目标窗口。 */
  target: EditorRemoteAuthorityWindowTarget;
  /** postMessage 握手使用的 targetOrigin。 */
  targetOrigin: string;
  /** 握手消息类型。 */
  handshakeType?: string;
  /** transport 释放时是否关闭专用 MessagePort。 */
  closePortOnDispose?: boolean;
}

/** 基于 authority service 创建 source 的最小参数。 */
export interface CreateEditorRemoteAuthorityServiceSourceOptions {
  /** 当前 authority 来源标题。 */
  label?: string;
  /** 当前 authority 来源说明。 */
  description?: string;
  /**
   * 已存在的 authority service。
   *
   * @remarks
   * 若直接传入 singleton service，默认不会在 runtime dispose 时自动释放；
   * 如需自动释放，请显式传入 `disposeServiceOnDispose: true`。
   */
  service?: EditorRemoteAuthorityDocumentService;
  /**
   * 为一次 runtime 挂载创建新的 authority service。
   *
   * @remarks
   * 若提供此工厂，默认会在 runtime dispose 时自动释放本次 service。
   */
  createService?():
    | EditorRemoteAuthorityDocumentService
    | Promise<EditorRemoteAuthorityDocumentService>;
  /** 释放 transport 时是否关闭专用 MessagePort。 */
  closePortOnDispose?: boolean;
  /** 释放 runtime 时是否顺带释放 authority service。 */
  disposeServiceOnDispose?: boolean;
}

/** App 装配 remote authority 后得到的最小运行时。 */
export interface ResolvedEditorRemoteAuthorityAppRuntime {
  /** 当前 authority 来源标题。 */
  sourceLabel: string;
  /** 当前 authority 来源说明。 */
  sourceDescription?: string;
  /** 当前已连接的 authority client。 */
  client: EditorRemoteAuthorityDocumentClient;
  /** authority 返回的正式图文档。 */
  document: GraphDocument;
  /** 供 GraphViewport 使用的 session binding 工厂。 */
  createDocumentSessionBinding: EditorGraphDocumentSessionBindingFactory;
  /** 若 client 支持运行反馈订阅，则直接作为外部 feedback inlet 使用。 */
  runtimeFeedbackInlet?: EditorRuntimeFeedbackInlet;
  /** 读取当前 authority 连接状态。 */
  getConnectionStatus(): EditorRemoteAuthorityConnectionStatus;
  /** 订阅 authority 连接状态变化。 */
  subscribeConnectionStatus(
    listener: (status: EditorRemoteAuthorityConnectionStatus) => void
  ): () => void;
  /** 释放本次 authority runtime。 */
  dispose(): void;
}

function cloneGraphDocument(document: GraphDocument): GraphDocument {
  return structuredClone(document);
}

function wrapMessagePortTransport(options: {
  port: MessagePort;
  closePortOnDispose?: boolean;
  onDispose?(): void;
}): EditorRemoteAuthorityTransport {
  const transport = createMessagePortRemoteAuthorityTransport({
    port: options.port,
    closePortOnDispose: options.closePortOnDispose
  });
  let disposed = false;

  return {
    request: transport.request.bind(transport),
    subscribe: transport.subscribe.bind(transport),
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      transport.dispose?.();
      options.onDispose?.();
    }
  };
}

function hasRuntimeFeedbackSubscribe(
  client: EditorRemoteAuthorityDocumentClient
): client is EditorRemoteAuthorityDocumentClient & EditorRuntimeFeedbackInlet {
  return typeof client.subscribe === "function";
}

function hasConnectionStatusSubscribe(
  client: EditorRemoteAuthorityDocumentClient
): client is EditorRemoteAuthorityDocumentClient & {
  getConnectionStatus(): EditorRemoteAuthorityConnectionStatus;
  subscribeConnectionStatus(
    listener: (status: EditorRemoteAuthorityConnectionStatus) => void
  ): () => void;
} {
  return (
    typeof client.getConnectionStatus === "function" &&
    typeof client.subscribeConnectionStatus === "function"
  );
}

async function resolveAuthorityService(
  options: CreateEditorRemoteAuthorityServiceSourceOptions
): Promise<EditorRemoteAuthorityDocumentService> {
  if (typeof options.createService === "function") {
    return options.createService();
  }

  if (options.service) {
    return options.service;
  }

  throw new Error("authority service source 缺少 service/createService");
}

async function resolveAuthorityClient(
  source: EditorRemoteAuthorityAppSource
): Promise<EditorRemoteAuthorityDocumentClient> {
  if (typeof source.createClient === "function") {
    return source.createClient();
  }

  if (typeof source.createTransport === "function") {
    return createTransportRemoteAuthorityClient({
      transport: await source.createTransport()
    });
  }

  throw new Error("remote authority source 缺少 createClient/createTransport");
}

/**
 * 基于浏览器原生 MessagePort 创建 authority source。
 *
 * @remarks
 * 这层给浏览器宿主一个更低成本的正式接入口：
 * 宿主不必自己手写 `createTransport()`，只需把 port 挂进 bootstrap。
 */
export function createEditorRemoteAuthorityMessagePortSource(
  options: CreateEditorRemoteAuthorityMessagePortSourceOptions
): EditorRemoteAuthorityAppSource {
  return {
    label: options.label ?? "MessagePort Authority",
    description: options.description,
    createTransport() {
      return wrapMessagePortTransport({
        port: options.port,
        closePortOnDispose: options.closePortOnDispose ?? false
      });
    }
  };
}

/**
 * 基于“连接回调”创建 MessagePort authority source。
 *
 * @remarks
 * 这层继续保持 runtime-agnostic：
 * editor 只知道自己拿到的是 `MessagePort transport`，
 * 不关心 port 背后是 worker、iframe 还是其他宿主桥。
 */
export function createEditorRemoteAuthorityMessagePortConnectorSource(
  options: CreateEditorRemoteAuthorityMessagePortConnectorSourceOptions
): EditorRemoteAuthorityAppSource {
  return {
    label: options.label ?? "Connected MessagePort Authority",
    description: options.description,
    async createTransport() {
      const channel = new MessageChannel();

      try {
        await options.connect(channel.port2);
      } catch (error) {
        channel.port1.close();
        channel.port2.close();
        throw error;
      }

      return wrapMessagePortTransport({
        port: channel.port1,
        closePortOnDispose: options.closePortOnDispose ?? true,
        onDispose() {
          channel.port2.close();
          options.onTransportDispose?.();
        }
      });
    }
  };
}

/**
 * 基于 worker 创建 authority source。
 *
 * @remarks
 * 主线程只负责：
 * 1. 新建专用 `MessageChannel`
 * 2. 把其中一端通过握手消息交给 worker
 * 3. 自己复用另一端创建标准 authority transport
 */
export function createEditorRemoteAuthorityWorkerSource(
  options: CreateEditorRemoteAuthorityWorkerSourceOptions
): EditorRemoteAuthorityAppSource {
  const handshakeType =
    options.handshakeType ?? DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE;

  return createEditorRemoteAuthorityMessagePortConnectorSource({
    label: options.label ?? "Worker Authority",
    description: options.description,
    closePortOnDispose: options.closePortOnDispose ?? true,
    connect(port) {
      options.worker.postMessage(
        {
          type: handshakeType
        },
        [port]
      );
    },
    onTransportDispose() {
      if (options.terminateWorkerOnDispose) {
        options.worker.terminate?.();
      }
    }
  });
}

/**
 * 基于 window / iframe 创建 authority source。
 *
 * @remarks
 * 这层适合：
 * - iframe.contentWindow
 * - popup / opener window
 * - 其他兼容 `postMessage(message, targetOrigin, transfer)` 的窗口宿主
 */
export function createEditorRemoteAuthorityWindowSource(
  options: CreateEditorRemoteAuthorityWindowSourceOptions
): EditorRemoteAuthorityAppSource {
  const handshakeType =
    options.handshakeType ?? DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE;

  return createEditorRemoteAuthorityMessagePortConnectorSource({
    label: options.label ?? "Window Authority",
    description: options.description,
    closePortOnDispose: options.closePortOnDispose ?? true,
    connect(port) {
      options.target.postMessage(
        {
          type: handshakeType
        },
        options.targetOrigin,
        [port]
      );
    }
  });
}

/**
 * 基于 authority service 创建浏览器侧 authority source。
 *
 * @remarks
 * 这层把宿主已有的 authority service 重新桥接成标准 `MessagePort transport`：
 * - editor 主链继续只消费 authority source / transport / client
 * - 外部协议适配停留在 service 或更外层的 adapter
 */
export function createEditorRemoteAuthorityServiceSource(
  options: CreateEditorRemoteAuthorityServiceSourceOptions
): EditorRemoteAuthorityAppSource {
  const shouldDisposeServiceOnDispose =
    options.disposeServiceOnDispose ??
    (typeof options.createService === "function");

  return {
    label: options.label ?? "Service Authority",
    description: options.description,
    async createTransport() {
      const channel = new MessageChannel();
      const service = await resolveAuthorityService(options);
      let host: ReturnType<typeof createMessagePortRemoteAuthorityHost> | null =
        null;

      try {
        host = createMessagePortRemoteAuthorityHost({
          port: channel.port2,
          service,
          closePortOnDispose: options.closePortOnDispose ?? true,
          disposeServiceOnDispose: shouldDisposeServiceOnDispose
        });

        return wrapMessagePortTransport({
          port: channel.port1,
          closePortOnDispose: options.closePortOnDispose ?? true,
          onDispose() {
            host?.dispose();
          }
        });
      } catch (error) {
        channel.port1.close();
        channel.port2.close();

        if (shouldDisposeServiceOnDispose) {
          service.dispose?.();
        }

        throw error;
      }
    }
  };
}

/**
 * 为 editor App 创建一份浏览器侧 remote authority runtime。
 *
 * @remarks
 * 这层专门负责把：
 * - client 创建
 * - authority 文档加载
 * - session binding 装配
 * - runtime feedback inlet 装配
 *
 * 收口成同一份运行时对象，避免 App 自己散落拼装细节。
 */
export async function createEditorRemoteAuthorityAppRuntime(
  source: EditorRemoteAuthorityAppSource
): Promise<ResolvedEditorRemoteAuthorityAppRuntime> {
  const client = await resolveAuthorityClient(source);

  try {
    const document = cloneGraphDocument(
      source.loadDocument
        ? await source.loadDocument(client)
        : await client.getDocument()
    );
    const createDocumentSessionBinding = createConfigurableSessionBindingFactory({
      mode: "remote-client",
      remoteClient: {
        client
      }
    });

    return {
      sourceLabel: source.label,
      sourceDescription: source.description,
      client,
      document,
      createDocumentSessionBinding,
      runtimeFeedbackInlet: hasRuntimeFeedbackSubscribe(client)
        ? client
        : undefined,
      getConnectionStatus(): EditorRemoteAuthorityConnectionStatus {
        return hasConnectionStatusSubscribe(client)
          ? client.getConnectionStatus()
          : "disconnected";
      },
      subscribeConnectionStatus(
        listener: (status: EditorRemoteAuthorityConnectionStatus) => void
      ): () => void {
        if (!hasConnectionStatusSubscribe(client)) {
          listener("disconnected");
          return () => {};
        }

        return client.subscribeConnectionStatus(listener);
      },
      dispose(): void {
        client.dispose?.();
      }
    };
  } catch (error) {
    client.dispose?.();
    throw error;
  }
}
