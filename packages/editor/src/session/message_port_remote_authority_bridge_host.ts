/**
 * MessagePort bridge 握手模块。
 *
 * @remarks
 * 负责定义 editor 与外部 bridge/iframe/worker 之间共享的 authority 握手消息格式。
 */
import type { EditorRemoteAuthorityDocumentService } from "./graph_document_authority_service";
import {
  createMessagePortRemoteAuthorityHost,
  type CreateMessagePortRemoteAuthorityHostOptions,
  type MessagePortRemoteAuthorityHost
} from "./message_port_remote_authority_host";

/** bridge authority 握手消息类型默认值。 */
export const DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE =
  "leafergraph.authority.connect";

/** bridge / worker / iframe 接收端的最小能力约束。 */
export interface MessagePortRemoteAuthorityBridgeHostReceiver {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void;
}

/** bridge authority host 的最小创建参数。 */
export interface AttachMessagePortRemoteAuthorityBridgeHostOptions {
  /** bridge / worker / iframe 侧消息接收对象。 */
  receiver: MessagePortRemoteAuthorityBridgeHostReceiver;
  /** 协议对端真正实现的 authority 服务。 */
  service: EditorRemoteAuthorityDocumentService;
  /** 握手消息类型。 */
  handshakeType?: string;
  /**
   * 是否接受这次连接事件。
   *
   * @remarks
   * iframe / window bridge 可用它过滤 `origin`、`source` 或其他上下文。
   */
  acceptConnection?(event: MessageEvent<unknown>): boolean;
  /** 每个连接释放时是否关闭传入的 MessagePort。 */
  closePortOnDispose?: boolean;
  /** 释放整个 bridge host 时是否顺带释放 authority service。 */
  disposeServiceOnDispose?: boolean;
}

/** bridge authority host 句柄。 */
export interface MessagePortRemoteAuthorityBridgeHostHandle {
  dispose(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessagePort(value: unknown): value is MessagePort {
  return (
    isRecord(value) &&
    typeof value.postMessage === "function" &&
    typeof value.addEventListener === "function" &&
    typeof value.start === "function" &&
    typeof value.close === "function"
  );
}

function resolveAuthorityPort(
  event: MessageEvent<unknown>,
  handshakeType: string
): MessagePort | null {
  if (!isRecord(event.data) || event.data.type !== handshakeType) {
    return null;
  }

  const [port] = event.ports ?? [];
  return isMessagePort(port) ? port : null;
}

/**
 * 把 authority service 挂到 bridge / worker / iframe 消息接收端上。
 *
 * @remarks
 * 这层定义的是浏览器内通用宿主接法：
 * - 主线程通过握手消息 + `MessagePort` 发起 authority 连接
 * - 远端宿主收到 port 后，直接复用 `createMessagePortRemoteAuthorityHost(...)`
 */
export function attachMessagePortRemoteAuthorityBridgeHost(
  options: AttachMessagePortRemoteAuthorityBridgeHostOptions
): MessagePortRemoteAuthorityBridgeHostHandle {
  const connectionHosts = new Set<MessagePortRemoteAuthorityHost>();
  const handshakeType =
    options.handshakeType ?? DEFAULT_REMOTE_AUTHORITY_BRIDGE_HANDSHAKE_TYPE;
  let disposed = false;

  const handleMessage = (event: MessageEvent<unknown>): void => {
    if (disposed) {
      return;
    }

    if (options.acceptConnection && !options.acceptConnection(event)) {
      return;
    }

    const port = resolveAuthorityPort(event, handshakeType);
    if (!port) {
      return;
    }

    const host = createMessagePortRemoteAuthorityHost({
      port,
      service: options.service,
      closePortOnDispose: options.closePortOnDispose,
      disposeServiceOnDispose: false
    } satisfies CreateMessagePortRemoteAuthorityHostOptions);
    connectionHosts.add(host);
  };

  options.receiver.addEventListener("message", handleMessage);

  return {
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      options.receiver.removeEventListener("message", handleMessage);
      for (const host of connectionHosts) {
        host.dispose();
      }
      connectionHosts.clear();

      if (options.disposeServiceOnDispose !== false) {
        options.service.dispose?.();
      }
    }
  };
}
