import type {
  EditorRemoteAuthorityProtocolAdapter,
  EditorRemoteAuthorityRequestInboundEnvelope
} from "./graph_document_authority_protocol";
import { DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER } from "./graph_document_authority_protocol";
import type {
  EditorRemoteAuthorityGetDocumentResponse,
  EditorRemoteAuthorityReplaceDocumentResponse,
  EditorRemoteAuthoritySubmitOperationResponse
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
    requestId: string,
    response:
      | EditorRemoteAuthorityGetDocumentResponse
      | EditorRemoteAuthoritySubmitOperationResponse
      | EditorRemoteAuthorityReplaceDocumentResponse
  ): void => {
    postMessage(
      protocolAdapter.createSuccessEnvelope(
        requestId,
        structuredClone(response)
      )
    );
  };

  const respondFailure = (requestId: string, error: unknown): void => {
    postMessage(
      protocolAdapter.createFailureEnvelope(requestId, toErrorMessage(error))
    );
  };

  const disposeRuntimeFeedbackSubscription =
    typeof options.service.subscribe === "function"
      ? options.service.subscribe((event) => {
          postMessage(
            protocolAdapter.createEventEnvelope({
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
            protocolAdapter.createEventEnvelope({
              type: "document",
              document: structuredClone(document)
            })
          );
        })
      : () => {};

  const handleRequestEnvelope = async (
    envelope: EditorRemoteAuthorityRequestInboundEnvelope
  ): Promise<void> => {
    const { requestId, request } = envelope;

    try {
      switch (request.action) {
        case "getDocument": {
          const document = await options.service.getDocument();
          respondSuccess(requestId, {
            action: "getDocument",
            document: structuredClone(document)
          });
          return;
        }
        case "submitOperation": {
          const result = await options.service.submitOperation(
            structuredClone(request.operation),
            structuredClone(request.context)
          );
          respondSuccess(requestId, {
            action: "submitOperation",
            result: structuredClone(result)
          });
          return;
        }
        case "replaceDocument": {
          const document = await options.service.replaceDocument(
            structuredClone(request.document),
            structuredClone(request.context)
          );
          respondSuccess(requestId, {
            action: "replaceDocument",
            document: document ? structuredClone(document) : undefined
          });
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

      if (options.disposeServiceOnDispose !== false) {
        options.service.dispose?.();
      }
      if (options.closePortOnDispose !== false) {
        options.port.close();
      }
    }
  };
}
