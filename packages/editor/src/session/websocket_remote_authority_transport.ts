import type {
  EditorRemoteAuthorityDocumentClient,
  EditorRemoteAuthorityTransport,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";
import { createTransportRemoteAuthorityClient } from "./graph_document_authority_transport";
import type { EditorRemoteAuthorityConnectionStatus } from "./graph_document_authority_client";
import type {
  EditorRemoteAuthorityInboundEnvelope,
  EditorRemoteAuthorityFailureEnvelope,
  EditorRemoteAuthorityProtocolAdapter
  ,
  EditorRemoteAuthoritySuccessEnvelope
} from "./graph_document_authority_protocol";
import { DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER } from "./graph_document_authority_protocol";

interface PendingRequestEntry {
  resolve: (response: EditorRemoteAuthorityTransportResponse) => void;
  reject: (error: Error) => void;
}

interface WebSocketLike {
  readonly readyState: number;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: EventListener
  ): void;
  removeEventListener(
    type: "open" | "message" | "close" | "error",
    listener: EventListener
  ): void;
  send(data: string): void;
  close(): void;
}

type WebSocketFactory = (
  url: string,
  protocols?: string | string[]
) => WebSocketLike;

/** WebSocket transport 的最小创建参数。 */
export interface CreateWebSocketRemoteAuthorityTransportOptions {
  /** authority WebSocket 地址。 */
  url: string;
  /** 可选 WebSocket 子协议。 */
  protocols?: string | string[];
  /** 是否在首连成功后自动重连。 */
  autoReconnect?: boolean;
  /**
   * 自动重连等待时间。
   *
   * @remarks
   * - 传数字：所有重连尝试共用同一延迟
   * - 传函数：按重连次数动态计算延迟
   */
  reconnectDelayMs?:
    | number
    | ((attempt: number) => number);
  /** 可选 authority 协议适配器。 */
  protocolAdapter?: EditorRemoteAuthorityProtocolAdapter;
  /**
   * 可选自定义 WebSocket 创建器。
   *
   * @remarks
   * 正式浏览器环境默认使用全局 `WebSocket`；
   * 测试可通过这里注入 fake socket。
   */
  createWebSocket?: WebSocketFactory;
}

/** 带连接就绪 Promise 的 WebSocket authority transport。 */
export interface WebSocketRemoteAuthorityTransport
  extends EditorRemoteAuthorityTransport {
  readonly ready: Promise<void>;
}

interface ActiveWebSocketBinding {
  socket: WebSocketLike;
  handleOpen: EventListener;
  handleMessage: EventListener;
  handleClose: EventListener;
  handleError: EventListener;
  readyStatePollTimer: ReturnType<typeof setInterval> | null;
}

const WEBSOCKET_READY_STATE_OPEN = 1;
const WEBSOCKET_READY_STATE_CLOSING = 2;
const WEBSOCKET_READY_STATE_CLOSED = 3;

function resolveDefaultWebSocketFactory(): WebSocketFactory {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("当前环境缺少 WebSocket");
  }

  return (url, protocols) => new globalThis.WebSocket(url, protocols);
}

function normalizeReconnectDelayMs(
  delayMs: number | undefined
): number {
  if (typeof delayMs !== "number" || Number.isNaN(delayMs)) {
    return 300;
  }

  return Math.max(0, Math.round(delayMs));
}

function resolveReconnectDelayMs(
  options: CreateWebSocketRemoteAuthorityTransportOptions,
  attempt: number
): number {
  if (typeof options.reconnectDelayMs === "function") {
    return normalizeReconnectDelayMs(options.reconnectDelayMs(attempt));
  }

  return normalizeReconnectDelayMs(options.reconnectDelayMs);
}

/**
 * 基于浏览器原生 WebSocket 创建 authority transport。
 *
 * @remarks
 * 这层只负责 authority request/response 与 runtime feedback 事件：
 * - 不在这里处理自动重连
 * - 不在这里写死 editor bootstrap
 * - 宿主可通过自定义 host adapter 复用它
 */
export function createWebSocketRemoteAuthorityTransport(
  options: CreateWebSocketRemoteAuthorityTransportOptions
): WebSocketRemoteAuthorityTransport {
  const listeners = new Set<
    (event: EditorRemoteAuthorityTransportEvent) => void
  >();
  const connectionStatusListeners = new Set<
    (status: EditorRemoteAuthorityConnectionStatus) => void
  >();
  const pendingRequests = new Map<string, PendingRequestEntry>();
  const protocolAdapter =
    options.protocolAdapter ?? DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER;
  const socketFactory = options.createWebSocket ?? resolveDefaultWebSocketFactory();
  const autoReconnect = options.autoReconnect === true;
  let requestSequence = 0;
  let disposed = false;
  let hadSuccessfulConnection = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectionStatus: EditorRemoteAuthorityConnectionStatus = "connecting";
  let readyResolved = false;
  let readyRejected = false;
  let resolveReadyPromise!: () => void;
  let rejectReadyPromise!: (error: Error) => void;
  let activeSocketBinding: ActiveWebSocketBinding | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReadyPromise = resolve;
    rejectReadyPromise = reject;
  });
  void ready.catch(() => undefined);

  const rejectPendingRequests = (reason: string): void => {
    const error = new Error(reason);
    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    pendingRequests.clear();
  };

  const resolveReady = (): void => {
    if (readyResolved || readyRejected) {
      return;
    }

    readyResolved = true;
    resolveReadyPromise();
  };

  const rejectReady = (reason: string): void => {
    if (readyResolved || readyRejected) {
      return;
    }

    readyRejected = true;
    rejectReadyPromise(new Error(reason));
  };

  const emitConnectionStatus = (
    nextStatus: EditorRemoteAuthorityConnectionStatus
  ): void => {
    if (connectionStatus === nextStatus) {
      return;
    }

    connectionStatus = nextStatus;
    for (const listener of connectionStatusListeners) {
      listener(nextStatus);
    }
  };

  const cleanupSocketBinding = (
    binding: ActiveWebSocketBinding | null,
    options?: {
      closeSocket?: boolean;
    }
  ): void => {
    if (!binding) {
      return;
    }

    binding.socket.removeEventListener("open", binding.handleOpen);
    binding.socket.removeEventListener("message", binding.handleMessage);
    binding.socket.removeEventListener("close", binding.handleClose);
    binding.socket.removeEventListener("error", binding.handleError);
    if (binding.readyStatePollTimer !== null) {
      clearInterval(binding.readyStatePollTimer);
      binding.readyStatePollTimer = null;
    }

    if (options?.closeSocket) {
      binding.socket.close();
    }
  };

  const handleInboundEnvelope = (
    envelope: EditorRemoteAuthorityInboundEnvelope
  ): void => {
    if ("event" in envelope && envelope.event) {
      for (const listener of listeners) {
        listener(structuredClone(envelope.event));
      }
      return;
    }

    const responseEnvelope =
      envelope as
        | EditorRemoteAuthoritySuccessEnvelope
        | EditorRemoteAuthorityFailureEnvelope;
    const pendingRequest = pendingRequests.get(String(responseEnvelope.id));
    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(String(responseEnvelope.id));
    if (responseEnvelope.ok) {
      pendingRequest.resolve(structuredClone(responseEnvelope.result));
      return;
    }

    pendingRequest.reject(
      new Error(
        ("error" in responseEnvelope && responseEnvelope.error.message) ||
          "authority 请求失败"
      )
    );
  };

  const scheduleReconnect = (): void => {
    if (disposed || !autoReconnect || !hadSuccessfulConnection) {
      emitConnectionStatus("disconnected");
      return;
    }

    if (reconnectTimer !== null) {
      return;
    }

    emitConnectionStatus("reconnecting");
    const nextAttempt = reconnectAttempt + 1;
    const reconnectDelayMs = resolveReconnectDelayMs(options, nextAttempt);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectAttempt = nextAttempt;

      if (disposed) {
        return;
      }

      activeSocketBinding = createSocketBinding();
    }, reconnectDelayMs);
  };

  const handleSocketFailure = (
    binding: ActiveWebSocketBinding,
    reason: string
  ): void => {
    if (disposed || activeSocketBinding !== binding) {
      return;
    }

    cleanupSocketBinding(binding);
    activeSocketBinding = null;
    rejectPendingRequests(reason);

    if (!hadSuccessfulConnection) {
      emitConnectionStatus("disconnected");
      rejectReady(reason);
      return;
    }

    scheduleReconnect();
  };

  const createSocketBinding = (): ActiveWebSocketBinding => {
    const socket = socketFactory(options.url, options.protocols);
    const binding: ActiveWebSocketBinding = {
      socket,
      handleOpen: () => {
        if (disposed || activeSocketBinding !== binding) {
          return;
        }

        hadSuccessfulConnection = true;
        reconnectAttempt = 0;
        resolveReady();
        emitConnectionStatus("connected");
      },
      handleMessage: (event: Event) => {
        if (disposed || activeSocketBinding !== binding) {
          return;
        }

        const messageEvent = event as MessageEvent<unknown>;
        const data = messageEvent.data;
        if (typeof data !== "string") {
          return;
        }

        try {
          const parsed = JSON.parse(data) as unknown;
          const envelope = protocolAdapter.parseInboundEnvelope(parsed);
          if (!envelope) {
            return;
          }
          handleInboundEnvelope(envelope as EditorRemoteAuthorityInboundEnvelope);
        } catch (error) {
          rejectPendingRequests(
            error instanceof Error
              ? error.message
              : "authority 返回了无法解析的消息"
          );
        }
      },
      handleClose: () => {
        handleSocketFailure(binding, "authority websocket 已关闭");
      },
      handleError: () => {
        handleSocketFailure(binding, "authority websocket 连接失败");
      },
      readyStatePollTimer: null
    };

    socket.addEventListener("open", binding.handleOpen);
    socket.addEventListener("message", binding.handleMessage);
    socket.addEventListener("close", binding.handleClose);
    socket.addEventListener("error", binding.handleError);
    binding.readyStatePollTimer = setInterval(() => {
      if (disposed || activeSocketBinding !== binding) {
        return;
      }

      if (socket.readyState === WEBSOCKET_READY_STATE_OPEN) {
        hadSuccessfulConnection = true;
        reconnectAttempt = 0;
        resolveReady();
        emitConnectionStatus("connected");
        return;
      }

      if (
        socket.readyState === WEBSOCKET_READY_STATE_CLOSING ||
        socket.readyState === WEBSOCKET_READY_STATE_CLOSED
      ) {
        handleSocketFailure(binding, "authority websocket 已关闭");
      }
    }, 10);

    if (socket.readyState === WEBSOCKET_READY_STATE_OPEN) {
      hadSuccessfulConnection = true;
      reconnectAttempt = 0;
      resolveReady();
      emitConnectionStatus("connected");
    } else if (
      socket.readyState === WEBSOCKET_READY_STATE_CLOSING ||
      socket.readyState === WEBSOCKET_READY_STATE_CLOSED
    ) {
      handleSocketFailure(binding, "authority websocket 已关闭");
    }

    return binding;
  };

  activeSocketBinding = createSocketBinding();

  return {
    ready,

    request<TResponse extends EditorRemoteAuthorityTransportResponse>(
      request: EditorRemoteAuthorityTransportRequest
    ): Promise<TResponse> {
      if (disposed) {
        return Promise.reject(new Error("authority transport 已释放"));
      }

      if (
        !activeSocketBinding ||
        activeSocketBinding.socket.readyState !== WEBSOCKET_READY_STATE_OPEN
      ) {
        return Promise.reject(new Error("authority websocket 尚未连接"));
      }

      const requestId = `websocket-request-${requestSequence += 1}`;
      const message = protocolAdapter.createRequestEnvelope(
        requestId,
        structuredClone(request)
      );
      const socket = activeSocketBinding.socket;

      return new Promise<TResponse>((resolve, reject) => {
        pendingRequests.set(requestId, {
          resolve: resolve as PendingRequestEntry["resolve"],
          reject
        });

        try {
          socket.send(JSON.stringify(message));
        } catch (error) {
          pendingRequests.delete(requestId);
          reject(
            error instanceof Error
              ? error
              : new Error("authority websocket 请求发送失败")
          );
        }
      });
    },

    subscribe(
      listener: (event: EditorRemoteAuthorityTransportEvent) => void
    ): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getConnectionStatus(): EditorRemoteAuthorityConnectionStatus {
      return connectionStatus;
    },

    subscribeConnectionStatus(
      listener: (status: EditorRemoteAuthorityConnectionStatus) => void
    ): () => void {
      connectionStatusListeners.add(listener);
      listener(connectionStatus);

      return () => {
        connectionStatusListeners.delete(listener);
      };
    },

    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      cleanupSocketBinding(activeSocketBinding, {
        closeSocket: true
      });
      activeSocketBinding = null;
      rejectReady("authority transport 已释放");
      rejectPendingRequests("authority transport 已释放");
      listeners.clear();
      connectionStatusListeners.clear();
    }
  };
}

/** 基于 WebSocket transport 创建 authority client。 */
export function createWebSocketRemoteAuthorityClient(options: {
  url: string;
  protocols?: string | string[];
  autoReconnect?: boolean;
  reconnectDelayMs?:
    | number
    | ((attempt: number) => number);
  createWebSocket?: WebSocketFactory;
}): EditorRemoteAuthorityDocumentClient {
  return createTransportRemoteAuthorityClient({
    transport: createWebSocketRemoteAuthorityTransport(options)
  });
}
