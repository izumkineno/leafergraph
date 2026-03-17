import type {
  EditorRemoteAuthorityDocumentClient,
  EditorRemoteAuthorityTransport,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";
import { createTransportRemoteAuthorityClient } from "./graph_document_authority_transport";
import type {
  EditorRemoteAuthorityInboundEnvelope,
  EditorRemoteAuthorityRequestEnvelope
} from "./graph_document_authority_protocol";

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

const WEBSOCKET_READY_STATE_OPEN = 1;
const WEBSOCKET_READY_STATE_CLOSING = 2;
const WEBSOCKET_READY_STATE_CLOSED = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveDefaultWebSocketFactory(): WebSocketFactory {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("当前环境缺少 WebSocket");
  }

  return (url, protocols) => new globalThis.WebSocket(url, protocols);
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
  const pendingRequests = new Map<string, PendingRequestEntry>();
  const socketFactory = options.createWebSocket ?? resolveDefaultWebSocketFactory();
  const socket = socketFactory(options.url, options.protocols);
  let requestSequence = 0;
  let disposed = false;
  let readyResolved = false;
  let readyRejected = false;
  let resolveReadyPromise!: () => void;
  let rejectReadyPromise!: (error: Error) => void;
  let readyStatePollTimer: ReturnType<typeof setInterval> | null = null;
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

    if (readyStatePollTimer !== null) {
      clearInterval(readyStatePollTimer);
      readyStatePollTimer = null;
    }
    readyResolved = true;
    resolveReadyPromise();
  };

  const rejectReady = (reason: string): void => {
    if (readyResolved || readyRejected) {
      return;
    }

    if (readyStatePollTimer !== null) {
      clearInterval(readyStatePollTimer);
      readyStatePollTimer = null;
    }
    readyRejected = true;
    rejectReadyPromise(new Error(reason));
  };

  const handleInboundEnvelope = (
    envelope: EditorRemoteAuthorityInboundEnvelope
  ): void => {
    switch (envelope.channel) {
      case "authority.event":
        for (const listener of listeners) {
          listener(structuredClone(envelope.event));
        }
        return;
      case "authority.response": {
        const pendingRequest = pendingRequests.get(envelope.requestId);
        if (!pendingRequest) {
          return;
        }

        pendingRequests.delete(envelope.requestId);
        if (envelope.ok) {
          pendingRequest.resolve(structuredClone(envelope.response));
          return;
        }

        pendingRequest.reject(new Error(envelope.error || "authority 请求失败"));
      }
    }
  };

  const handleOpen = (): void => {
    resolveReady();
  };

  const handleMessage = (event: Event): void => {
    if (disposed) {
      return;
    }

    const messageEvent = event as MessageEvent<unknown>;
    const data = messageEvent.data;
    if (typeof data !== "string") {
      return;
    }

    try {
      const parsed = JSON.parse(data) as unknown;
      if (!isRecord(parsed) || typeof parsed.channel !== "string") {
        throw new Error("authority 返回了非法消息");
      }

      if (
        parsed.channel !== "authority.response" &&
        parsed.channel !== "authority.event"
      ) {
        return;
      }

      handleInboundEnvelope(
        parsed as unknown as EditorRemoteAuthorityInboundEnvelope
      );
    } catch (error) {
      rejectPendingRequests(
        error instanceof Error ? error.message : "authority 返回了无法解析的消息"
      );
    }
  };

  const handleClose = (): void => {
    if (disposed) {
      return;
    }

    rejectReady("authority websocket 已关闭");
    rejectPendingRequests("authority websocket 已关闭");
  };

  const handleError = (): void => {
    if (disposed) {
      return;
    }

    rejectReady("authority websocket 连接失败");
    rejectPendingRequests("authority websocket 连接失败");
  };

  socket.addEventListener("open", handleOpen as EventListener);
  socket.addEventListener("message", handleMessage as EventListener);
  socket.addEventListener("close", handleClose as EventListener);
  socket.addEventListener("error", handleError as EventListener);
  readyStatePollTimer = setInterval(() => {
    if (socket.readyState === WEBSOCKET_READY_STATE_OPEN) {
      resolveReady();
      return;
    }

    if (
      socket.readyState === WEBSOCKET_READY_STATE_CLOSING ||
      socket.readyState === WEBSOCKET_READY_STATE_CLOSED
    ) {
      rejectReady("authority websocket 已关闭");
    }
  }, 10);

  if (socket.readyState === WEBSOCKET_READY_STATE_OPEN) {
    resolveReady();
  } else if (
    socket.readyState === WEBSOCKET_READY_STATE_CLOSING ||
    socket.readyState === WEBSOCKET_READY_STATE_CLOSED
  ) {
    rejectReady("authority websocket 已关闭");
  }

  return {
    ready,

    request<TResponse extends EditorRemoteAuthorityTransportResponse>(
      request: EditorRemoteAuthorityTransportRequest
    ): Promise<TResponse> {
      if (disposed) {
        return Promise.reject(new Error("authority transport 已释放"));
      }

      if (socket.readyState !== WEBSOCKET_READY_STATE_OPEN) {
        return Promise.reject(new Error("authority websocket 尚未连接"));
      }

      const requestId = `websocket-request-${requestSequence += 1}`;
      const message: EditorRemoteAuthorityRequestEnvelope = {
        channel: "authority.request",
        requestId,
        request: structuredClone(request)
      };

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

    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      socket.removeEventListener("open", handleOpen as EventListener);
      socket.removeEventListener("message", handleMessage as EventListener);
      socket.removeEventListener("close", handleClose as EventListener);
      socket.removeEventListener("error", handleError as EventListener);
      if (readyStatePollTimer !== null) {
        clearInterval(readyStatePollTimer);
        readyStatePollTimer = null;
      }
      rejectReady("authority transport 已释放");
      rejectPendingRequests("authority transport 已释放");
      listeners.clear();
      socket.close();
    }
  };
}

/** 基于 WebSocket transport 创建 authority client。 */
export function createWebSocketRemoteAuthorityClient(options: {
  url: string;
  protocols?: string | string[];
  createWebSocket?: WebSocketFactory;
}): EditorRemoteAuthorityDocumentClient {
  return createTransportRemoteAuthorityClient({
    transport: createWebSocketRemoteAuthorityTransport(options)
  });
}
