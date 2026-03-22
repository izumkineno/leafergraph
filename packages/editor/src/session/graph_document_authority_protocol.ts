import type {
  GraphDocument,
  GraphDocumentDiff,
  RuntimeFeedbackEvent
} from "leafergraph";
import type {
  EditorRemoteAuthorityControlRuntimeRequest,
  EditorRemoteAuthorityFrontendBundlesSyncEvent,
  EditorRemoteAuthorityReplaceDocumentRequest,
  EditorRemoteAuthoritySubmitOperationRequest,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";

/** JSON-RPC 固定版本号。 */
export const EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION = "2.0";

/** 标准 JSON-RPC 错误码。 */
export const EDITOR_REMOTE_AUTHORITY_JSON_RPC_ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603
} as const;

/** editor 侧 authority 方法名常量。 */
export const EDITOR_REMOTE_AUTHORITY_METHODS = {
  discover: "rpc.discover",
  getDocument: "authority.getDocument",
  submitOperation: "authority.submitOperation",
  replaceDocument: "authority.replaceDocument",
  controlRuntime: "authority.controlRuntime"
} as const;

/** editor 侧 authority notification 常量。 */
export const EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS = {
  document: "authority.document",
  documentDiff: "authority.documentDiff",
  runtimeFeedback: "authority.runtimeFeedback",
  frontendBundlesSync: "authority.frontendBundlesSync"
} as const;

type EditorRemoteAuthorityTransportMethod =
  EditorRemoteAuthorityTransportRequest["method"];

/** authority 协议请求 envelope。 */
export interface EditorRemoteAuthorityRequestEnvelope {
  jsonrpc: typeof EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION;
  id: string | number;
  method: EditorRemoteAuthorityTransportMethod;
  params?: unknown;
  request?: EditorRemoteAuthorityTransportRequest;
}

/** authority 协议成功响应 envelope。 */
export interface EditorRemoteAuthoritySuccessEnvelope {
  jsonrpc: typeof EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION;
  id: string | number | null;
  ok?: true;
  result: EditorRemoteAuthorityTransportResponse;
}

/** authority 协议错误对象。 */
export interface EditorRemoteAuthorityErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

/** authority 协议失败响应 envelope。 */
export interface EditorRemoteAuthorityFailureEnvelope {
  jsonrpc: typeof EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION;
  id: string | number | null;
  ok?: false;
  error: EditorRemoteAuthorityErrorObject;
}

/** authority 协议事件 envelope。 */
export interface EditorRemoteAuthorityEventEnvelope {
  jsonrpc: typeof EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION;
  method:
    | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.document
    | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.documentDiff
    | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.runtimeFeedback
    | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.frontendBundlesSync;
  params?: unknown;
  event?: EditorRemoteAuthorityTransportEvent;
}

/** authority 协议请求入站 envelope。 */
export type EditorRemoteAuthorityRequestInboundEnvelope =
  EditorRemoteAuthorityRequestEnvelope;

/** authority 协议响应 / 事件入站 envelope。 */
export type EditorRemoteAuthorityInboundEnvelope =
  | EditorRemoteAuthoritySuccessEnvelope
  | EditorRemoteAuthorityFailureEnvelope
  | EditorRemoteAuthorityEventEnvelope;

/** authority 协议出站 envelope。 */
export type EditorRemoteAuthorityOutboundEnvelope =
  | EditorRemoteAuthorityRequestEnvelope
  | EditorRemoteAuthoritySuccessEnvelope
  | EditorRemoteAuthorityFailureEnvelope
  | EditorRemoteAuthorityEventEnvelope;

/** editor authority 协议适配器。 */
export interface EditorRemoteAuthorityProtocolAdapter {
  /** 构造一条 authority request envelope。 */
  createRequestEnvelope(
    requestId: string,
    request: EditorRemoteAuthorityTransportRequest
  ): EditorRemoteAuthorityRequestEnvelope;
  /** 构造一条 authority 成功响应 envelope。 */
  createSuccessEnvelope(
    requestId: string | number | null,
    response: EditorRemoteAuthorityTransportResponse
  ): EditorRemoteAuthoritySuccessEnvelope;
  /** 构造一条 authority 失败响应 envelope。 */
  createErrorEnvelope(
    requestId: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): EditorRemoteAuthorityFailureEnvelope;
  /** 构造一条 authority 事件 envelope。 */
  createNotificationEnvelope(
    event: EditorRemoteAuthorityTransportEvent
  ): EditorRemoteAuthorityEventEnvelope;
  /** 从未知消息中解析 request envelope。 */
  parseRequestEnvelope(
    value: unknown
  ): EditorRemoteAuthorityRequestInboundEnvelope | null;
  /** 从未知消息中解析 response / event envelope。 */
  parseInboundEnvelope(value: unknown): EditorRemoteAuthorityInboundEnvelope | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJsonRpcRequestId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function createRequestFromRawEnvelope(
  value: Record<string, unknown>
): EditorRemoteAuthorityTransportRequest | null {
  const method = value.method;
  const params = value.params;

  switch (method) {
    case EDITOR_REMOTE_AUTHORITY_METHODS.discover:
      return {
        method
      };
    case EDITOR_REMOTE_AUTHORITY_METHODS.getDocument:
      return {
        method
      };
    case EDITOR_REMOTE_AUTHORITY_METHODS.submitOperation:
      if (
        !isRecord(params) ||
        !("operation" in params) ||
        !("context" in params)
      ) {
        return null;
      }
      return {
        method,
        params: {
          operation: structuredClone(
            params.operation
          ) as EditorRemoteAuthoritySubmitOperationRequest["params"]["operation"],
          context: structuredClone(
            params.context
          ) as EditorRemoteAuthoritySubmitOperationRequest["params"]["context"]
        }
      };
    case EDITOR_REMOTE_AUTHORITY_METHODS.replaceDocument:
      if (
        !isRecord(params) ||
        !("document" in params) ||
        !("context" in params)
      ) {
        return null;
      }
      return {
        method,
        params: {
          document: structuredClone(
            params.document
          ) as EditorRemoteAuthorityReplaceDocumentRequest["params"]["document"],
          context: structuredClone(
            params.context
          ) as EditorRemoteAuthorityReplaceDocumentRequest["params"]["context"]
        }
      };
    case EDITOR_REMOTE_AUTHORITY_METHODS.controlRuntime:
      if (!isRecord(params) || !("request" in params)) {
        return null;
      }
      return {
        method,
        params: {
          request: structuredClone(
            params.request
          ) as EditorRemoteAuthorityControlRuntimeRequest["params"]["request"]
        }
      };
    default:
      return null;
  }
}

function isRequestEnvelope(
  value: unknown
): value is EditorRemoteAuthorityRequestInboundEnvelope {
  if (
    !isRecord(value) ||
    value.jsonrpc !== EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION ||
    !isJsonRpcRequestId(value.id) ||
    typeof value.method !== "string"
  ) {
    return false;
  }

  return createRequestFromRawEnvelope(value) !== null;
}

function createNotificationEvent(
  value: Record<string, unknown>
): EditorRemoteAuthorityEventEnvelope | null {
  if (
    value.jsonrpc !== EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION ||
    typeof value.method !== "string"
  ) {
    return null;
  }

  switch (value.method) {
    case EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.document:
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        method: value.method,
        event: {
          type: "document",
          document: structuredClone(value.params) as GraphDocument
        }
      };
    case EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.documentDiff:
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        method: value.method,
        event: {
          type: "documentDiff",
          diff: structuredClone(value.params) as GraphDocumentDiff
        }
      };
    case EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.runtimeFeedback:
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        method: value.method,
        event: {
          type: "runtimeFeedback",
          event: structuredClone(value.params) as RuntimeFeedbackEvent
        }
      };
    case EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.frontendBundlesSync:
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        method: value.method,
        event: {
          type: "frontendBundles.sync",
          event: structuredClone(
            value.params
          ) as EditorRemoteAuthorityFrontendBundlesSyncEvent
        }
      };
    default:
      return null;
  }
}

function isInboundEnvelope(
  value: unknown
): value is EditorRemoteAuthorityInboundEnvelope {
  if (!isRecord(value) || value.jsonrpc !== EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION) {
    return false;
  }

  if ("method" in value) {
    return createNotificationEvent(value) !== null;
  }

  if ("error" in value) {
    return (
      ("id" in value ? value.id === null || isJsonRpcRequestId(value.id) : false) &&
      isRecord(value.error) &&
      typeof value.error.code === "number" &&
      typeof value.error.message === "string"
    );
  }

  return (
    ("id" in value ? value.id === null || isJsonRpcRequestId(value.id) : false) &&
    "result" in value
  );
}

function toNotificationMethod(
  event: EditorRemoteAuthorityTransportEvent
):
  | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.document
  | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.documentDiff
  | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.runtimeFeedback
  | typeof EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.frontendBundlesSync {
  switch (event.type) {
    case "document":
      return EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.document;
    case "documentDiff":
      return EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.documentDiff;
    case "runtimeFeedback":
      return EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.runtimeFeedback;
    case "frontendBundles.sync":
      return EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS.frontendBundlesSync;
  }
}

function toNotificationParams(
  event: EditorRemoteAuthorityTransportEvent
): unknown {
  switch (event.type) {
    case "document":
      return event.document;
    case "documentDiff":
      return event.diff;
    case "runtimeFeedback":
      return event.event;
    case "frontendBundles.sync":
      return event.event;
  }
}

/** 当前默认 authority JSON-RPC 协议适配器。 */
export function createDefaultEditorRemoteAuthorityProtocolAdapter(): EditorRemoteAuthorityProtocolAdapter {
  return {
    createRequestEnvelope(requestId, request) {
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: requestId,
        method: request.method,
        params:
          "params" in request && request.params !== undefined
            ? structuredClone(request.params)
            : undefined
      };
    },

    createSuccessEnvelope(requestId, response) {
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: requestId,
        result: structuredClone(response)
      };
    },

    createErrorEnvelope(requestId, code, message, data) {
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: requestId,
        error: {
          code,
          message,
          data: data === undefined ? undefined : structuredClone(data)
        }
      };
    },

    createNotificationEnvelope(event) {
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        method: toNotificationMethod(event),
        params: structuredClone(toNotificationParams(event))
      };
    },

    parseRequestEnvelope(value) {
      if (!isRequestEnvelope(value)) {
        return null;
      }

      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: value.id,
        method: value.method as EditorRemoteAuthorityTransportMethod,
        request: createRequestFromRawEnvelope(
          value as unknown as Record<string, unknown>
        )!
      };
    },

    parseInboundEnvelope(value) {
      if (!isInboundEnvelope(value)) {
        return null;
      }

      if ("method" in value) {
        return createNotificationEvent(value as unknown as Record<string, unknown>);
      }

      if ("error" in value) {
        return {
          jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
          id: value.id,
          ok: false,
          error: structuredClone(value.error as EditorRemoteAuthorityErrorObject)
        };
      }

      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: value.id,
        ok: true,
        result: structuredClone(value.result as EditorRemoteAuthorityTransportResponse)
      };
    }
  };
}

/** editor 当前默认复用的 authority 协议适配器实例。 */
export const DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER =
  createDefaultEditorRemoteAuthorityProtocolAdapter();
