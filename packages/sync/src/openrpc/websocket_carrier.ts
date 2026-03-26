/**
 * OpenRPC WebSocket carrier 模块。
 *
 * @remarks
 * 负责以惰性连接方式承载 JSON-RPC 消息，不在这里处理 method / notification 语义。
 */
import type { ConnectionStatus } from "../core";
import type {
  CreateOpenRpcWebSocketCarrierOptions,
  JsonRpcNotificationEnvelope,
  JsonRpcResponseEnvelope,
  OpenRpcCarrier,
  OpenRpcCarrierEvent,
  WebSocketFactory,
  WebSocketLike
} from "./types";
import {
  createDecodeError,
  createProtocolError,
  createTransportError,
  isJsonRpcNotificationEnvelope,
  isJsonRpcResponseEnvelope
} from "./validation";

const WEBSOCKET_READY_STATE_OPEN = 1;
const WEBSOCKET_READY_STATE_CLOSING = 2;
const WEBSOCKET_READY_STATE_CLOSED = 3;

interface PendingRequestEntry {
  resolve: (response: JsonRpcResponseEnvelope) => void;
  reject: (error: Error) => void;
}

interface ActiveSocketBinding {
  socket: WebSocketLike;
  handleOpen: EventListener;
  handleMessage: EventListener;
  handleClose: EventListener;
  handleError: EventListener;
}

/** 解析默认 WebSocket 工厂，供浏览器宿主直接复用原生实现。 */
function resolveDefaultWebSocketFactory(): WebSocketFactory {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("当前宿主缺少 WebSocket");
  }

  return (endpoint, protocols) => new globalThis.WebSocket(endpoint, protocols);
}

/** 归一化重连延迟，避免负数、浮点或 NaN 污染重连节奏。 */
function normalizeReconnectDelay(delay: number | undefined): number {
  if (typeof delay !== "number" || Number.isNaN(delay)) {
    return 300;
  }

  return Math.max(0, Math.round(delay));
}

/** 根据配置与重连次数解析本次等待时长。 */
function resolveReconnectDelay(
  options: CreateOpenRpcWebSocketCarrierOptions,
  attempt: number
): number {
  if (typeof options.reconnectDelayMs === "function") {
    return normalizeReconnectDelay(options.reconnectDelayMs(attempt));
  }

  return normalizeReconnectDelay(options.reconnectDelayMs);
}

/**
 * 创建基于 WebSocket 的 OpenRPC carrier。
 *
 * @remarks
 * 这层只负责 JSON-RPC envelope 的收发、连接状态和自动重连。
 */
export function createOpenRpcWebSocketCarrier(
  options: CreateOpenRpcWebSocketCarrierOptions
): OpenRpcCarrier {
  const listeners = new Set<(event: OpenRpcCarrierEvent) => void>();
  const pendingRequests = new Map<string, PendingRequestEntry>();
  const socketFactory = options.createWebSocket ?? resolveDefaultWebSocketFactory();
  const autoReconnect = options.autoReconnect ?? true;
  let connectionStatus: ConnectionStatus = "idle";
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let hadSuccessfulConnection = false;
  let activeSocketBinding: ActiveSocketBinding | null = null;
  let connectionPromise: Promise<void> | null = null;
  let resolveConnectionPromise: (() => void) | null = null;
  let rejectConnectionPromise: ((error: Error) => void) | null = null;

  const emit = (event: OpenRpcCarrierEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const setConnectionStatus = (status: ConnectionStatus): void => {
    if (connectionStatus === status) {
      return;
    }

    connectionStatus = status;
    emit({
      type: "connection",
      status
    });
  };

  const rejectPendingRequests = (message: string): void => {
    const error = new Error(message);
    for (const pending of pendingRequests.values()) {
      pending.reject(error);
    }
    pendingRequests.clear();
  };

  const cleanupBinding = (
    binding: ActiveSocketBinding | null,
    closeSocket: boolean
  ): void => {
    if (!binding) {
      return;
    }

    binding.socket.removeEventListener("open", binding.handleOpen);
    binding.socket.removeEventListener("message", binding.handleMessage);
    binding.socket.removeEventListener("close", binding.handleClose);
    binding.socket.removeEventListener("error", binding.handleError);
    if (closeSocket) {
      binding.socket.close();
    }
  };

  const createConnectionPromise = (): Promise<void> => {
    connectionPromise = new Promise<void>((resolve, reject) => {
      resolveConnectionPromise = resolve;
      rejectConnectionPromise = reject;
    });
    return connectionPromise;
  };

  const settleConnectionSuccess = (): void => {
    resolveConnectionPromise?.();
    resolveConnectionPromise = null;
    rejectConnectionPromise = null;
    connectionPromise = Promise.resolve();
  };

  const settleConnectionFailure = (message: string): void => {
    rejectConnectionPromise?.(new Error(message));
    resolveConnectionPromise = null;
    rejectConnectionPromise = null;
    connectionPromise = null;
  };

  const handleInboundText = (text: string): void => {
    try {
      const parsed = JSON.parse(text) as unknown;

      // carrier 只识别两类合法消息：
      // - notification: 继续交给 outlet 做 method 映射
      // - response: 按 requestId 配对回 pending request
      // 其余内容统一视为 decode / protocol 错误。
      if (isJsonRpcNotificationEnvelope(parsed)) {
        emit({
          type: "notification",
          notification: parsed as JsonRpcNotificationEnvelope
        });
        return;
      }

      if (isJsonRpcResponseEnvelope(parsed)) {
        const requestId = String(parsed.id);
        const pendingRequest = pendingRequests.get(requestId);
        if (!pendingRequest) {
          emit({
            type: "error",
            error: createProtocolError(`收到未知 requestId 的响应: ${requestId}`)
          });
          return;
        }

        pendingRequests.delete(requestId);
        pendingRequest.resolve(parsed);
        return;
      }

      emit({
        type: "error",
        error: createDecodeError("收到无法识别的 JSON-RPC envelope", parsed)
      });
    } catch (error) {
      emit({
        type: "error",
        error: createDecodeError("收到无法解析的 JSON 文本", error)
      });
    }
  };

  const scheduleReconnect = (): void => {
    // 只有“曾经真正连通过”的 socket 才进入自动重连。
    // 首次建连失败保持 disconnected，方便上层区分初始化失败与已连接后断线。
    if (disposed || !autoReconnect || !hadSuccessfulConnection) {
      setConnectionStatus("disconnected");
      return;
    }

    if (reconnectTimer !== null) {
      return;
    }

    setConnectionStatus("reconnecting");
    const nextAttempt = reconnectAttempt + 1;
    const reconnectDelay = resolveReconnectDelay(options, nextAttempt);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectAttempt = nextAttempt;
      void ensureConnection();
    }, reconnectDelay);
  };

  const handleSocketFailure = (message: string, cause?: unknown): void => {
    // socket 失效时先明确拒绝所有在途请求，再决定是否自动重连。
    // carrier 不会尝试重发 request，只负责准确上报链路状态。
    cleanupBinding(activeSocketBinding, false);
    activeSocketBinding = null;
    rejectPendingRequests(message);
    settleConnectionFailure(message);

    if (cause) {
      emit({
        type: "error",
        error: createTransportError(message, cause)
      });
    }

    scheduleReconnect();
  };

  const createSocketBinding = (): ActiveSocketBinding => {
    const socket = socketFactory(options.endpoint, options.protocols);
    const binding: ActiveSocketBinding = {
      socket,
      handleOpen: () => {
        if (disposed || activeSocketBinding !== binding) {
          return;
        }

        hadSuccessfulConnection = true;
        reconnectAttempt = 0;
        setConnectionStatus("connected");
        settleConnectionSuccess();
      },
      handleMessage: (event: Event) => {
        const messageEvent = event as MessageEvent<unknown>;
        if (typeof messageEvent.data !== "string") {
          emit({
            type: "error",
            error: createDecodeError("WebSocket 收到的消息不是字符串", messageEvent.data)
          });
          return;
        }

        handleInboundText(messageEvent.data);
      },
      handleClose: () => {
        handleSocketFailure("OpenRPC WebSocket 连接已关闭");
      },
      handleError: (event: Event) => {
        handleSocketFailure("OpenRPC WebSocket 连接失败", event);
      }
    };

    // 所有事件监听都绑在单次 socket binding 上，便于在重连或 dispose 时整体清理。
    socket.addEventListener("open", binding.handleOpen);
    socket.addEventListener("message", binding.handleMessage);
    socket.addEventListener("close", binding.handleClose);
    socket.addEventListener("error", binding.handleError);

    if (socket.readyState === WEBSOCKET_READY_STATE_OPEN) {
      hadSuccessfulConnection = true;
      reconnectAttempt = 0;
      setConnectionStatus("connected");
      settleConnectionSuccess();
    } else if (
      socket.readyState === WEBSOCKET_READY_STATE_CLOSING ||
      socket.readyState === WEBSOCKET_READY_STATE_CLOSED
    ) {
      handleSocketFailure("OpenRPC WebSocket 初始状态不可用");
    }

    return binding;
  };

  const ensureConnection = async (): Promise<void> => {
    if (disposed) {
      throw new Error("OpenRPC WebSocket carrier 已释放");
    }

    if (
      activeSocketBinding &&
      activeSocketBinding.socket.readyState === WEBSOCKET_READY_STATE_OPEN
    ) {
      return;
    }

    if (connectionPromise) {
      return connectionPromise;
    }

    // carrier 采用惰性连接；首次订阅、请求或拉快照时才真正建连。
    // 并发重入时统一复用同一个 connectionPromise，避免重复创建 socket。
    setConnectionStatus(hadSuccessfulConnection ? "reconnecting" : "connecting");
    createConnectionPromise();
    activeSocketBinding = createSocketBinding();
    return connectionPromise ?? Promise.resolve();
  };

  return {
    async request(envelope): Promise<JsonRpcResponseEnvelope> {
      await ensureConnection();

      if (
        !activeSocketBinding ||
        activeSocketBinding.socket.readyState !== WEBSOCKET_READY_STATE_OPEN
      ) {
        throw new Error("OpenRPC WebSocket 尚未连接");
      }

      const requestId = String(envelope.id);
      return new Promise<JsonRpcResponseEnvelope>((resolve, reject) => {
        pendingRequests.set(requestId, {
          resolve,
          reject
        });

        try {
          activeSocketBinding?.socket.send(JSON.stringify(envelope));
        } catch (error) {
          pendingRequests.delete(requestId);
          reject(
            error instanceof Error
              ? error
              : new Error("OpenRPC WebSocket 请求发送失败")
          );
        }
      });
    },

    subscribe(listener): () => void {
      listeners.add(listener);

      // 长流订阅会触发惰性建连，这样只有真正需要协议事件时才保活 socket。
      void ensureConnection().catch((error) => {
        emit({
          type: "error",
          error: createTransportError("OpenRPC WebSocket 建立连接失败", error)
        });
      });

      return () => {
        listeners.delete(listener);
      };
    },

    getConnectionStatus(): ConnectionStatus {
      return connectionStatus;
    },

    async dispose(): Promise<void> {
      if (disposed) {
        return;
      }

      disposed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      cleanupBinding(activeSocketBinding, true);
      activeSocketBinding = null;
      rejectPendingRequests("OpenRPC WebSocket carrier 已释放");
      settleConnectionFailure("OpenRPC WebSocket carrier 已释放");
      listeners.clear();
      // `dispose()` 统一负责关闭 socket、取消重连并拒绝在途请求。
      setConnectionStatus("disconnected");
    }
  };
}
