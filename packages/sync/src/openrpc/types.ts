/**
 * OpenRPC 子出口类型模块。
 *
 * @remarks
 * 负责定义 OpenRPC/JSON-RPC 子出口内部使用的协议与 carrier 类型。
 */
import type {
  GraphOperation,
  LeaferGraphGraphExecutionState
} from "leafergraph";
import type {
  ConnectionStatus,
  DocumentRevision,
  DocumentSnapshot,
  SyncOutletError,
  SyncRuntimeControlRequest
} from "../core";

/** OpenRPC 子出口固定使用的 method 常量。 */
export const OPENRPC_METHODS = {
  discover: "rpc.discover",
  getDocument: "authority.getDocument",
  submitOperation: "authority.submitOperation",
  replaceDocument: "authority.replaceDocument",
  controlRuntime: "authority.controlRuntime"
} as const;

/** OpenRPC 子出口固定使用的 notification 常量。 */
export const OPENRPC_NOTIFICATIONS = {
  document: "authority.document",
  documentDiff: "authority.documentDiff",
  runtimeFeedback: "authority.runtimeFeedback",
  frontendBundlesSync: "authority.frontendBundlesSync"
} as const;

/** 子出口内部复用的 JSON-RPC request envelope。 */
export interface JsonRpcRequestEnvelope {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: unknown;
}

/** 子出口内部复用的 JSON-RPC 成功响应 envelope。 */
export interface JsonRpcSuccessEnvelope {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

/** 子出口内部复用的 JSON-RPC 失败响应 envelope。 */
export interface JsonRpcErrorEnvelope {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** 子出口内部复用的 JSON-RPC notification envelope。 */
export interface JsonRpcNotificationEnvelope {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

/** WebSocket carrier 与 outlet 之间共享的响应联合。 */
export type JsonRpcResponseEnvelope =
  | JsonRpcSuccessEnvelope
  | JsonRpcErrorEnvelope;

/** OpenRPC carrier 主动回推给 outlet 的事件。 */
export type OpenRpcCarrierEvent =
  | {
      type: "connection";
      status: ConnectionStatus;
    }
  | {
      type: "notification";
      notification: JsonRpcNotificationEnvelope;
    }
  | {
      type: "error";
      error: SyncOutletError;
    };

/** OpenRPC outlet 依赖的最小 carrier 合同。 */
export interface OpenRpcCarrier {
  request(envelope: JsonRpcRequestEnvelope): Promise<JsonRpcResponseEnvelope>;
  subscribe(listener: (event: OpenRpcCarrierEvent) => void): () => void;
  getConnectionStatus(): ConnectionStatus;
  dispose?(): void | Promise<void>;
}

/** 当前 authority.submitOperation 返回的最小结果结构。 */
export interface OpenRpcSubmitOperationResult {
  accepted: boolean;
  changed: boolean;
  revision: DocumentRevision;
  reason?: string;
  document?: DocumentSnapshot;
}

/** 当前 authority.controlRuntime 返回的最小结果结构。 */
export interface OpenRpcRuntimeControlResult {
  accepted: boolean;
  changed: boolean;
  reason?: string;
  state?: LeaferGraphGraphExecutionState;
}

/** 当前 authority.frontendBundlesSync 的最小事件结构。 */
export interface OpenRpcFrontendBundlesSyncEvent {
  type: "frontendBundles.sync";
  mode: "full" | "upsert" | "remove";
  packages?: Array<{
    packageId: string;
    version: string;
    nodeTypes: string[];
    bundles: Array<{
      id?: string;
      entry: string;
      format?: string;
      globalName?: string;
      cssHref?: string;
    }>;
  }>;
  removedPackageIds?: string[];
  emittedAt: number;
}

/** WebSocketLike 的最小运行时接口。 */
export interface WebSocketLike {
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

/** 自定义 WebSocket 创建器。 */
export type WebSocketFactory = (
  endpoint: string,
  protocols?: string | string[]
) => WebSocketLike;

/** 创建 WebSocket carrier 时使用的最小配置。 */
export interface CreateOpenRpcWebSocketCarrierOptions {
  endpoint: string;
  protocols?: string | string[];
  autoReconnect?: boolean;
  reconnectDelayMs?: number | ((attempt: number) => number);
  createWebSocket?: WebSocketFactory;
}

/** 创建 OpenRPC outlet 时使用的最小配置。 */
export interface CreateOpenRpcOutletOptions {
  carrier: OpenRpcCarrier;
}

/** 子出口内部复用的最小 authority 上下文。 */
export interface OpenRpcAuthorityOperationContext {
  currentDocument: DocumentSnapshot;
  pendingOperationIds: readonly string[];
}

/** 子出口内部复用的 replaceDocument 上下文。 */
export interface OpenRpcAuthorityReplaceDocumentContext {
  currentDocument: DocumentSnapshot;
}

/** 子出口内部使用的 method params 联合。 */
export type OpenRpcMethodParams =
  | undefined
  | {
      operation: GraphOperation;
      context: OpenRpcAuthorityOperationContext;
    }
  | {
      document: DocumentSnapshot;
      context: OpenRpcAuthorityReplaceDocumentContext;
    }
  | {
      request: SyncRuntimeControlRequest;
    };
