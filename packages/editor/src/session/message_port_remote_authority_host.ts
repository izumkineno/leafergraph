import authorityOpenRpcDocument from "../../../../templates/backend/shared/openrpc/authority.openrpc.json";
import type {
  EditorRemoteAuthorityProtocolAdapter,
  EditorRemoteAuthorityRequestInboundEnvelope
} from "./graph_document_authority_protocol";
import { DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER } from "./graph_document_authority_protocol";
import type {
  EditorRemoteAuthorityTransportResponse
} from "./graph_document_authority_transport";
import type { EditorRemoteAuthorityDocumentService } from "./graph_document_authority_service";

/** MessagePort authority host 的最小创建参数。 */
export interface CreateMessagePortRemoteAuthorityHostOptions {
  /** 与 editor transport 对接的 authority port。 */
  port: MessagePort;
  /** 协议对端真正实现的 authority 服务。 */
  service: EditorRemoteAuthorityDocumentService;
  /** 可选 authority 协议适配器。 */
  protocolAdapter?: EditorRemoteAuthorityProtocolAdapter;
  /** host 释放时是否关闭 port。 */
  closePortOnDispose?: boolean;
  /** host 释放时是否顺带释放 authority service。 */
  disposeServiceOnDispose?: boolean;
}

/** MessagePort authority host 的最小句柄。 */
export interface MessagePortRemoteAuthorityHost {
  dispose(): void;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "authority host 处理请求失败";
}

/**
 * 基于 MessagePort 暴露 authority 服务。
 *
 * @remarks
 * 这层补齐的是协议“服务端 / 宿主侧”适配器：
 * - editor 继续走标准 transport / client
 * - 宿主 / worker / iframe / bridge 只要实现 authority service，
 *   就能复用同一套 MessagePort 协议壳
 */
export function createMessagePortRemoteAuthorityHost(
  options: CreateMessagePortRemoteAuthorityHostOptions
): MessagePortRemoteAuthorityHost {
  const protocolAdapter =
    options.protocolAdapter ?? DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER;
  let disposed = false;

  const postMessage = (message: unknown): void => {
    if (disposed) {
      return;
    }

    options.port.postMessage(message);
  };

  const respondSuccess = (
    requestId: string | number | null,
    response: EditorRemoteAuthorityTransportResponse
  ): void => {
    postMessage(
      protocolAdapter.createSuccessEnvelope(
        requestId,
        structuredClone(response)
      )
    );
  };

  const respondFailure = (
    requestId: string | number | null,
    error: unknown
  ): void => {
    postMessage(
      protocolAdapter.createErrorEnvelope(requestId, -32603, toErrorMessage(error))
    );
  };

  const disposeRuntimeFeedbackSubscription =
    typeof options.service.subscribe === "function"
      ? options.service.subscribe((event) => {
          postMessage(
            protocolAdapter.createNotificationEnvelope({
              type: "runtimeFeedback",
              event: structuredClone(event)
            })
          );
        })
      : () => {};
  const disposeDocumentSubscription =
    typeof options.service.subscribeDocument === "function"
      ? options.service.subscribeDocument((document) => {
          postMessage(
            protocolAdapter.createNotificationEnvelope({
              type: "document",
              document: structuredClone(document)
            })
          );
        })
      : () => {};
  const disposeDocumentDiffSubscription =
    typeof options.service.subscribeDocumentDiff === "function"
      ? options.service.subscribeDocumentDiff((diff) => {
          postMessage(
            protocolAdapter.createNotificationEnvelope({
              type: "documentDiff",
              diff: structuredClone(diff)
            })
          );
        })
      : () => {};

  const handleRequestEnvelope = async (
    envelope: EditorRemoteAuthorityRequestInboundEnvelope
  ): Promise<void> => {
    const requestId = envelope.id;
    const request = envelope.request!;

    try {
      switch (request.method) {
        case "authority.getDocument": {
          const document = await options.service.getDocument();
          respondSuccess(requestId, structuredClone(document));
          return;
        }
        case "authority.submitOperation": {
          const result = await options.service.submitOperation(
            structuredClone(request.params.operation),
            structuredClone(request.params.context)
          );
          respondSuccess(requestId, structuredClone(result));
          return;
        }
        case "authority.replaceDocument": {
          const document = await options.service.replaceDocument(
            structuredClone(request.params.document),
            structuredClone(request.params.context)
          );
          respondSuccess(requestId, document ? structuredClone(document) : null);
          return;
        }
        case "authority.controlRuntime": {
          if (typeof options.service.controlRuntime !== "function") {
            respondSuccess(requestId, {
              accepted: false,
              changed: false,
              reason: "authority 不支持运行控制"
            });
            return;
          }

          const result = await options.service.controlRuntime(
            structuredClone(request.params.request)
          );
          respondSuccess(requestId, structuredClone(result));
          return;
        }
        case "rpc.discover": {
          respondSuccess(requestId, authorityOpenRpcDocument);
          return;
        }
      }
    } catch (error) {
      respondFailure(requestId, error);
    }
  };

  const handleMessage = (event: MessageEvent<unknown>): void => {
    const envelope = protocolAdapter.parseRequestEnvelope(event.data);
    if (disposed || !envelope) {
      return;
    }

    void handleRequestEnvelope(envelope as EditorRemoteAuthorityRequestInboundEnvelope);
  };

  options.port.addEventListener("message", handleMessage as EventListener);
  options.port.start();

  return {
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      options.port.removeEventListener(
        "message",
        handleMessage as EventListener
      );
      disposeRuntimeFeedbackSubscription();
      disposeDocumentSubscription();
      disposeDocumentDiffSubscription();

      if (options.disposeServiceOnDispose !== false) {
        options.service.dispose?.();
      }
      if (options.closePortOnDispose !== false) {
        options.port.close();
      }
    }
  };
}
