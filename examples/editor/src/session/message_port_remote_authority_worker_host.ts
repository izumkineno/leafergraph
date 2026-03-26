/**
 * Worker authority host 握手模块。
 *
 * @remarks
 * 负责在 Worker 场景下监听主线程握手消息，并把收到的 MessagePort 挂到 authority host。
 */
import type { EditorRemoteAuthorityDocumentService } from "./graph_document_authority_service";
import {
  attachMessagePortRemoteAuthorityBridgeHost,
  DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE,
  type AttachMessagePortRemoteAuthorityBridgeHostOptions,
  type MessagePortRemoteAuthorityBridgeHostHandle,
  type MessagePortRemoteAuthorityBridgeHostReceiver
} from "./message_port_remote_authority_bridge_host";

/** worker authority 握手消息类型默认值。 */
export const DEFAULT_REMOTE_AUTHORITY_WORKER_HANDSHAKE_TYPE =
  DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE;

/** worker / bridge 接收端的最小能力约束。 */
export type MessagePortRemoteAuthorityWorkerHostReceiver =
  MessagePortRemoteAuthorityBridgeHostReceiver;

/** worker authority host 的最小创建参数。 */
export interface AttachMessagePortRemoteAuthorityWorkerHostOptions
  extends Omit<
    AttachMessagePortRemoteAuthorityBridgeHostOptions,
    "acceptConnection"
  > {
  /** worker / bridge 侧消息接收对象。 */
  receiver: MessagePortRemoteAuthorityWorkerHostReceiver;
  /** 协议对端真正实现的 authority 服务。 */
  service: EditorRemoteAuthorityDocumentService;
}

/** worker authority host 句柄。 */
export type MessagePortRemoteAuthorityWorkerHostHandle =
  MessagePortRemoteAuthorityBridgeHostHandle;

/**
 * 把 authority service 挂到 worker / bridge 消息接收端上。
 *
 * @remarks
 * 这层定义的是浏览器内标准宿主接法：
 * - 主线程通过握手消息 + `MessagePort` 发起 authority 连接
 * - worker / bridge 收到 port 后，直接复用 `createMessagePortRemoteAuthorityHost(...)`
 */
export function attachMessagePortRemoteAuthorityWorkerHost(
  options: AttachMessagePortRemoteAuthorityWorkerHostOptions
): MessagePortRemoteAuthorityWorkerHostHandle {
  return attachMessagePortRemoteAuthorityBridgeHost({
    receiver: options.receiver,
    service: options.service,
    handshakeType:
      options.handshakeType ?? DEFAULT_REMOTE_AUTHORITY_WORKER_HANDSHAKE_TYPE,
    closePortOnDispose: options.closePortOnDispose,
    disposeServiceOnDispose: options.disposeServiceOnDispose
  });
}
