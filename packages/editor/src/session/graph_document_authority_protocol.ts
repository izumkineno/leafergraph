import type {
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";

/** authority 协议请求 envelope。 */
export interface EditorRemoteAuthorityRequestEnvelope {
  channel: "authority.request";
  requestId: string;
  request: EditorRemoteAuthorityTransportRequest;
}

/** authority 协议成功响应 envelope。 */
export interface EditorRemoteAuthoritySuccessEnvelope {
  channel: "authority.response";
  requestId: string;
  ok: true;
  response: EditorRemoteAuthorityTransportResponse;
}

/** authority 协议失败响应 envelope。 */
export interface EditorRemoteAuthorityFailureEnvelope {
  channel: "authority.response";
  requestId: string;
  ok: false;
  error: string;
}

/** authority 协议事件 envelope。 */
export interface EditorRemoteAuthorityEventEnvelope {
  channel: "authority.event";
  event: EditorRemoteAuthorityTransportEvent;
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
    requestId: string,
    response: EditorRemoteAuthorityTransportResponse
  ): EditorRemoteAuthoritySuccessEnvelope;
  /** 构造一条 authority 失败响应 envelope。 */
  createFailureEnvelope(
    requestId: string,
    error: string
  ): EditorRemoteAuthorityFailureEnvelope;
  /** 构造一条 authority 事件 envelope。 */
  createEventEnvelope(
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

function isRequestEnvelope(
  value: unknown
): value is EditorRemoteAuthorityRequestInboundEnvelope {
  return (
    isRecord(value) &&
    value.channel === "authority.request" &&
    typeof value.requestId === "string" &&
    isRecord(value.request) &&
    typeof value.request.action === "string"
  );
}

function isInboundEnvelope(
  value: unknown
): value is EditorRemoteAuthorityInboundEnvelope {
  if (!isRecord(value) || typeof value.channel !== "string") {
    return false;
  }

  switch (value.channel) {
    case "authority.event":
      return isRecord(value.event) && typeof value.event.type === "string";
    case "authority.response":
      if (typeof value.requestId !== "string" || typeof value.ok !== "boolean") {
        return false;
      }

      return value.ok
        ? isRecord(value.response) && typeof value.response.action === "string"
        : typeof value.error === "string";
    default:
      return false;
  }
}

/** 当前默认 authority envelope 协议适配器。 */
export function createDefaultEditorRemoteAuthorityProtocolAdapter(): EditorRemoteAuthorityProtocolAdapter {
  return {
    createRequestEnvelope(requestId, request) {
      return {
        channel: "authority.request",
        requestId,
        request
      };
    },

    createSuccessEnvelope(requestId, response) {
      return {
        channel: "authority.response",
        requestId,
        ok: true,
        response
      };
    },

    createFailureEnvelope(requestId, error) {
      return {
        channel: "authority.response",
        requestId,
        ok: false,
        error
      };
    },

    createEventEnvelope(event) {
      return {
        channel: "authority.event",
        event
      };
    },

    parseRequestEnvelope(value) {
      return isRequestEnvelope(value) ? value : null;
    },

    parseInboundEnvelope(value) {
      return isInboundEnvelope(value) ? value : null;
    }
  };
}

/** editor 当前默认复用的 authority 协议适配器实例。 */
export const DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER =
  createDefaultEditorRemoteAuthorityProtocolAdapter();
