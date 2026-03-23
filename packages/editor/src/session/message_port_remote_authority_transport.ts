import {
  createTransportRemoteAuthorityClient,
  type EditorRemoteAuthorityDocumentClient,
  type EditorRemoteAuthorityTransport,
  type EditorRemoteAuthorityTransportEvent,
  type EditorRemoteAuthorityTransportRequest,
  type EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";
import type {
  EditorRemoteAuthorityInboundEnvelope,
  EditorRemoteAuthorityFailureEnvelope,
  EditorRemoteAuthorityProtocolAdapter,
  EditorRemoteAuthoritySuccessEnvelope
} from "./authority_openrpc";
import {
  DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER,
  validateMethodResult
} from "./authority_openrpc";

interface PendingRequestEntry {
  method: EditorRemoteAuthorityTransportRequest["method"];
  resolve: (response: EditorRemoteAuthorityTransportResponse) => void;
  reject: (error: Error) => void;
}

/** MessagePort transport 的最小创建参数。 */
export interface CreateMessagePortRemoteAuthorityTransportOptions {
  /** 用于和 authority 宿主通信的专用 port。 */
  port: MessagePort;
  /** 释放 transport 时是否一并关闭 port。 */
  closePortOnDispose?: boolean;
  /** 可选 authority 协议适配器。 */
  protocolAdapter?: EditorRemoteAuthorityProtocolAdapter;
}

/**
 * 基于浏览器 / Worker 原生 MessagePort 创建 authority transport。
 *
 * @remarks
 * 这层只负责：
 * 1. request-response
 * 2. authority 主动事件推送
 *
 * 不绑定具体后端实现；外层既可以把 port 接到 iframe / worker，
 * 也可以接到宿主桥或其他浏览器原生消息通道。
 */
export function createMessagePortRemoteAuthorityTransport(
  options: CreateMessagePortRemoteAuthorityTransportOptions
): EditorRemoteAuthorityTransport {
  const listeners = new Set<
    (event: EditorRemoteAuthorityTransportEvent) => void
  >();
  const pendingRequests = new Map<string, PendingRequestEntry>();
  const protocolAdapter =
    options.protocolAdapter ?? DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER;
  let requestSequence = 0;
  let disposed = false;

  const rejectPendingRequests = (reason: string): void => {
    const error = new Error(reason);
    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    pendingRequests.clear();
  };

  const handleInboundEnvelope = (
    envelope: EditorRemoteAuthorityInboundEnvelope
  ): void => {
    if ("event" in envelope && envelope.event) {
      for (const listener of listeners) {
        listener(structuredClone(envelope.event));
      }
      return;
    }

    const responseEnvelope =
      envelope as
        | EditorRemoteAuthoritySuccessEnvelope
        | EditorRemoteAuthorityFailureEnvelope;
    const pendingRequest = pendingRequests.get(String(responseEnvelope.id));
    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(String(responseEnvelope.id));
    if (responseEnvelope.ok) {
      try {
        pendingRequest.resolve(
          validateMethodResult(
            pendingRequest.method,
            responseEnvelope.result
          ) as EditorRemoteAuthorityTransportResponse
        );
        return;
      } catch (error) {
        pendingRequest.reject(
          error instanceof Error
            ? error
            : new Error("authority 返回了无效结果")
        );
        return;
      }
    }

    pendingRequest.reject(
      new Error(
        ("error" in responseEnvelope && responseEnvelope.error.message) ||
          "authority 请求失败"
      )
    );
  };

  const handleMessage = (event: MessageEvent<unknown>): void => {
    if (disposed) {
      return;
    }

    const envelope = protocolAdapter.parseInboundEnvelope(event.data);
    if (!envelope) {
      return;
    }
    handleInboundEnvelope(envelope as EditorRemoteAuthorityInboundEnvelope);
  };

  options.port.addEventListener("message", handleMessage as EventListener);
  options.port.start();

  return {
    request<TResponse extends EditorRemoteAuthorityTransportResponse>(
      request: EditorRemoteAuthorityTransportRequest
    ): Promise<TResponse> {
      if (disposed) {
        return Promise.reject(new Error("authority transport 已释放"));
      }

      const requestId = `message-port-request-${requestSequence += 1}`;
      const message = protocolAdapter.createRequestEnvelope(
        requestId,
        structuredClone(request)
      );

      return new Promise<TResponse>((resolve, reject) => {
        pendingRequests.set(requestId, {
          method: request.method,
          resolve: resolve as PendingRequestEntry["resolve"],
          reject
        });

        try {
          options.port.postMessage(message);
        } catch (error) {
          pendingRequests.delete(requestId);
          reject(
            error instanceof Error
              ? error
              : new Error("authority 请求写入失败")
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
      options.port.removeEventListener(
        "message",
        handleMessage as EventListener
      );
      listeners.clear();
      rejectPendingRequests("authority transport 已释放");

      if (options.closePortOnDispose !== false) {
        options.port.close();
      }
    }
  };
}

/** 基于 MessagePort 创建 authority client。 */
export function createMessagePortRemoteAuthorityClient(options: {
  port: MessagePort;
  closePortOnDispose?: boolean;
}): EditorRemoteAuthorityDocumentClient {
  return createTransportRemoteAuthorityClient({
    transport: createMessagePortRemoteAuthorityTransport(options)
  });
}
