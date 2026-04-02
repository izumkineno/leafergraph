import type {
  GraphOperation,
  GraphOperationApplyResult
} from "@leafergraph/contracts";
import type {
  LeaferGraphRuntimeBridgeTransport,
  RuntimeBridgeControlCommand,
  RuntimeBridgeInboundEvent
} from "@leafergraph/runtime-bridge/transport";
import type { GraphDocument } from "@leafergraph/runtime-bridge/portable";
import type {
  DemoBridgeClientMessage,
  DemoBridgeServerMessage
} from "../shared/protocol";
import {
  parseDemoBridgeMessage,
  serializeDemoBridgeMessage
} from "../shared/protocol";

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

export interface DemoWebSocketEventMap {
  close: {
    code?: number;
    reason?: string;
  };
  error: unknown;
  message: {
    data: unknown;
  };
  open: Record<string, never>;
}

export interface DemoWebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener<TKey extends keyof DemoWebSocketEventMap>(
    type: TKey,
    listener: (event: DemoWebSocketEventMap[TKey]) => void
  ): void;
  removeEventListener<TKey extends keyof DemoWebSocketEventMap>(
    type: TKey,
    listener: (event: DemoWebSocketEventMap[TKey]) => void
  ): void;
}

export type DemoWebSocketFactory = (
  url: string,
  protocols?: string | string[]
) => DemoWebSocketLike;

export type WebSocketRuntimeBridgeTransportState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting";

export interface WebSocketRuntimeBridgeTransportStatus {
  state: WebSocketRuntimeBridgeTransportState;
  url: string;
  lastError: string | null;
}

export interface WebSocketRuntimeBridgeTransportDebugEvent {
  type:
    | "socket.open"
    | "socket.close"
    | "socket.error"
    | "outbound.request"
    | "inbound.response"
    | "inbound.bridge.event"
    | "bridge.error";
  at: number;
  detail?: unknown;
}

export interface WebSocketRuntimeBridgeTransportOptions {
  url: string;
  protocols?: string | string[];
  createSocket?: DemoWebSocketFactory;
}

interface PendingRequest<TResult> {
  resolve(value: TResult): void;
  reject(error: unknown): void;
}

type DemoBridgeClientRequestInput =
  | {
      type: "snapshot.request";
    }
  | {
      type: "operations.submit";
      operations: GraphOperation[];
    }
  | {
      type: "control.send";
      command: RuntimeBridgeControlCommand;
    };

/**
 * 浏览器侧 WebSocket transport。
 *
 * @remarks
 * 这个实现只负责 demo 自己的 wire protocol，
 * 并把它翻译成 `LeaferGraphRuntimeBridgeTransport` 所需的最小接口。
 */
export class WebSocketRuntimeBridgeTransport
  implements LeaferGraphRuntimeBridgeTransport
{
  private readonly url: string;
  private readonly protocols?: string | string[];
  private readonly createSocket: DemoWebSocketFactory;
  private readonly inboundListeners = new Set<
    (event: RuntimeBridgeInboundEvent) => void
  >();
  private readonly debugListeners = new Set<
    (event: WebSocketRuntimeBridgeTransportDebugEvent) => void
  >();
  private readonly statusListeners = new Set<
    (status: WebSocketRuntimeBridgeTransportStatus) => void
  >();
  private readonly pendingRequests = new Map<
    string,
    PendingRequest<DemoBridgeServerMessage>
  >();
  private socket: DemoWebSocketLike | null = null;
  private state: WebSocketRuntimeBridgeTransportState = "idle";
  private lastError: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: unknown) => void) | null = null;
  private requestSeed = 1;

  private readonly handleOpen = () => {
    this.state = "connected";
    this.emitStatus();
    this.emitDebug({
      type: "socket.open",
      at: Date.now()
    });
    this.connectResolve?.();
    this.clearConnectDeferred();
  };

  private readonly handleMessage = (event: DemoWebSocketEventMap["message"]) => {
    const message = parseDemoBridgeMessage(event.data) as DemoBridgeServerMessage;

    switch (message.type) {
      case "snapshot.response":
      case "operations.response":
      case "control.response":
        this.emitDebug({
          type: "inbound.response",
          at: Date.now(),
          detail: message
        });
        this.pendingRequests.get(message.requestId)?.resolve(message);
        this.pendingRequests.delete(message.requestId);
        return;
      case "bridge.event":
        this.emitDebug({
          type: "inbound.bridge.event",
          at: Date.now(),
          detail: message.event
        });
        for (const listener of this.inboundListeners) {
          listener(message.event);
        }
        return;
      case "bridge.error":
        this.lastError = message.message;
        this.emitStatus();
        this.emitDebug({
          type: "bridge.error",
          at: Date.now(),
          detail: message
        });
        if (message.requestId) {
          this.pendingRequests.get(message.requestId)?.reject(
            new Error(message.message)
          );
          this.pendingRequests.delete(message.requestId);
        }
        return;
      default:
        return;
    }
  };

  private readonly handleClose = (event: DemoWebSocketEventMap["close"]) => {
    this.emitDebug({
      type: "socket.close",
      at: Date.now(),
      detail: event
    });
    const shouldRejectPending = this.state !== "disconnecting";
    this.detachSocket();
    this.state = "idle";
    this.emitStatus();

    if (this.connectReject) {
      this.connectReject(new Error("WebSocket closed before transport connected."));
      this.clearConnectDeferred();
    }

    if (shouldRejectPending) {
      this.rejectPendingRequests(new Error("WebSocket transport disconnected."));
    }
  };

  private readonly handleError = (event: DemoWebSocketEventMap["error"]) => {
    this.lastError = event instanceof Error ? event.message : "WebSocket error";
    this.emitStatus();
    this.emitDebug({
      type: "socket.error",
      at: Date.now(),
      detail: event
    });
  };

  constructor(options: WebSocketRuntimeBridgeTransportOptions) {
    this.url = options.url;
    this.protocols = options.protocols;
    this.createSocket =
      options.createSocket ??
      ((url, protocols) =>
        new WebSocket(url, protocols) as unknown as DemoWebSocketLike);
  }

  async connect(): Promise<void> {
    if (this.state === "connected") {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.state = "connecting";
    this.lastError = null;
    this.emitStatus();

    const socket = this.createSocket(this.url, this.protocols);
    this.socket = socket;
    this.attachSocket(socket);
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
    }).finally(() => {
      this.connectPromise = null;
    });

    if (socket.readyState === SOCKET_OPEN) {
      this.handleOpen();
    }

    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.socket) {
      this.state = "idle";
      this.emitStatus();
      return;
    }

    if (this.socket.readyState === SOCKET_CLOSED) {
      this.detachSocket();
      this.state = "idle";
      this.emitStatus();
      return;
    }

    this.state = "disconnecting";
    this.emitStatus();

    const socket = this.socket;
    const waitForClose = new Promise<void>((resolve) => {
      const listener = () => {
        socket.removeEventListener("close", listener);
        resolve();
      };
      socket.addEventListener("close", listener);
    });

    if (socket.readyState === SOCKET_CONNECTING || socket.readyState === SOCKET_OPEN) {
      socket.close();
    }

    await waitForClose;
    this.rejectPendingRequests(new Error("WebSocket transport disconnected."));
  }

  subscribe(listener: (event: RuntimeBridgeInboundEvent) => void): () => void {
    this.inboundListeners.add(listener);
    return () => {
      this.inboundListeners.delete(listener);
    };
  }

  subscribeStatus(
    listener: (status: WebSocketRuntimeBridgeTransportStatus) => void
  ): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeDebug(
    listener: (event: WebSocketRuntimeBridgeTransportDebugEvent) => void
  ): () => void {
    this.debugListeners.add(listener);
    return () => {
      this.debugListeners.delete(listener);
    };
  }

  getStatus(): WebSocketRuntimeBridgeTransportStatus {
    return {
      state: this.state,
      url: this.url,
      lastError: this.lastError
    };
  }

  async requestSnapshot(): Promise<GraphDocument> {
    const response = await this.sendRequest({
      type: "snapshot.request"
    });
    if (response.type !== "snapshot.response") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return response.document;
  }

  async submitOperations(
    operations: readonly GraphOperation[]
  ): Promise<readonly GraphOperationApplyResult[]> {
    const response = await this.sendRequest({
      type: "operations.submit",
      operations: structuredClone([...operations])
    });
    if (response.type !== "operations.response") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return response.results;
  }

  async sendControl(command: RuntimeBridgeControlCommand): Promise<void> {
    const response = await this.sendRequest({
      type: "control.send",
      command: structuredClone(command)
    });
    if (response.type !== "control.response") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
  }

  private async sendRequest(
    input: DemoBridgeClientRequestInput
  ): Promise<DemoBridgeServerMessage> {
    await this.connect();

    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) {
      throw new Error("WebSocket transport is not connected.");
    }

    const requestId = `demo-request:${Date.now()}:${this.requestSeed}`;
    this.requestSeed += 1;
    const message: DemoBridgeClientMessage = {
      ...input,
      requestId
    };

    const response = new Promise<DemoBridgeServerMessage>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
    });

    this.emitDebug({
      type: "outbound.request",
      at: Date.now(),
      detail: message
    });
    this.socket.send(serializeDemoBridgeMessage(message));
    return response;
  }

  private attachSocket(socket: DemoWebSocketLike): void {
    socket.addEventListener("open", this.handleOpen);
    socket.addEventListener("message", this.handleMessage);
    socket.addEventListener("close", this.handleClose);
    socket.addEventListener("error", this.handleError);
  }

  private detachSocket(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeEventListener("open", this.handleOpen);
    this.socket.removeEventListener("message", this.handleMessage);
    this.socket.removeEventListener("close", this.handleClose);
    this.socket.removeEventListener("error", this.handleError);
    this.socket = null;
  }

  private rejectPendingRequests(error: Error): void {
    for (const [, pendingRequest] of this.pendingRequests) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }

  private clearConnectDeferred(): void {
    this.connectResolve = null;
    this.connectReject = null;
  }

  private emitStatus(): void {
    const snapshot = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }

  private emitDebug(event: WebSocketRuntimeBridgeTransportDebugEvent): void {
    for (const listener of this.debugListeners) {
      listener(event);
    }
  }
}

/**
 * 解析 demo 默认 WebSocket 地址。
 *
 * @returns 最终地址。
 */
export function resolveRuntimeBridgeDemoWebSocketUrl(): string {
  const envUrl = import.meta.env.VITE_RUNTIME_BRIDGE_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://127.0.0.1:7788`;
}
