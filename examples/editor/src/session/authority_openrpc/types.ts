/**
 * 类型定义模块。
 *
 * @remarks
 * 负责集中声明当前区域或当前子系统对外复用的 props、状态和辅助类型。
 */
import type {
  AuthorityOpenRpcMethodName,
  AuthorityOpenRpcNotificationName
} from "./_generated";
import type {
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./_generated/transport_types";

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

/** authority 协议请求方法名。 */
export type EditorRemoteAuthorityTransportMethod =
  EditorRemoteAuthorityTransportRequest["method"];

/** authority 协议请求 envelope。 */
export interface EditorRemoteAuthorityRequestEnvelope {
  jsonrpc: typeof EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION;
  id: string | number;
  method: AuthorityOpenRpcMethodName;
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
  method: AuthorityOpenRpcNotificationName;
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
