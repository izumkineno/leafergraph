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
