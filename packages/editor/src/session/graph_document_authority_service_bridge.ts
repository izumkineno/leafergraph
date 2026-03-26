/**
 * authority service bridge 模块。
 *
 * @remarks
 * 负责把 authority service 重新包装成 editor transport/client 可消费的协议桥，
 * 让 demo service 或外部宿主实现能复用同一套前端链路。
 */
import type {
  GraphDocument,
  GraphOperation
} from "leafergraph";
import type {
  EditorRemoteAuthorityOperationContext,
  EditorRemoteAuthorityOperationResult,
  EditorRemoteAuthorityRuntimeControlRequest,
  EditorRemoteAuthorityRuntimeControlResult,
  EditorRemoteAuthorityReplaceDocumentContext
} from "./graph_document_authority_client";
import {
  createTransportRemoteAuthorityClient,
  type EditorRemoteAuthorityDocumentClient,
  type EditorRemoteAuthorityTransport
} from "./graph_document_authority_transport";
import type { EditorRemoteAuthorityDocumentService } from "./graph_document_authority_service";

/** client-backed authority service 的最小创建参数。 */
export interface CreateClientBackedRemoteAuthorityServiceOptions {
  /** 真实对端的 authority client。 */
  client: EditorRemoteAuthorityDocumentClient;
  /** 释放 service 时是否顺带释放 client。 */
  disposeClientOnDispose?: boolean;
}

/** transport-backed authority service 的最小创建参数。 */
export interface CreateTransportBackedRemoteAuthorityServiceOptions {
  /** 真实对端的 authority transport。 */
  transport: EditorRemoteAuthorityTransport;
  /** 释放 service 时是否顺带释放 transport。 */
  disposeTransportOnDispose?: boolean;
}

function cloneDocument(document: GraphDocument): GraphDocument {
  return structuredClone(document);
}

function cloneOperation(operation: GraphOperation): GraphOperation {
  return structuredClone(operation);
}

function cloneOperationContext(
  context: EditorRemoteAuthorityOperationContext
): EditorRemoteAuthorityOperationContext {
  return structuredClone(context);
}

function cloneReplaceDocumentContext(
  context: EditorRemoteAuthorityReplaceDocumentContext
): EditorRemoteAuthorityReplaceDocumentContext {
  return structuredClone(context);
}

function cloneOperationResult(
  result: EditorRemoteAuthorityOperationResult
): EditorRemoteAuthorityOperationResult {
  return structuredClone(result);
}

function cloneRuntimeControlRequest(
  request: EditorRemoteAuthorityRuntimeControlRequest
): EditorRemoteAuthorityRuntimeControlRequest {
  return structuredClone(request);
}

function cloneRuntimeControlResult(
  result: EditorRemoteAuthorityRuntimeControlResult
): EditorRemoteAuthorityRuntimeControlResult {
  return structuredClone(result);
}

/**
 * 把 authority client 适配为 authority service。
 *
 * @remarks
 * 这层给宿主桥接场景提供统一转接点：
 * - 外部协议继续停留在 client / transport 侧
 * - 浏览器内 `MessagePort host` 继续只消费 authority service
 */
export function createClientBackedRemoteAuthorityService(
  options: CreateClientBackedRemoteAuthorityServiceOptions
): EditorRemoteAuthorityDocumentService {
  return {
    async getDocument(): Promise<GraphDocument> {
      return cloneDocument(await options.client.getDocument());
    },

    async submitOperation(
      operation: GraphOperation,
      context: EditorRemoteAuthorityOperationContext
    ): Promise<EditorRemoteAuthorityOperationResult> {
      return cloneOperationResult(
        await options.client.submitOperation(
          cloneOperation(operation),
          cloneOperationContext(context)
        )
      );
    },

    async replaceDocument(
      document: GraphDocument,
      context: EditorRemoteAuthorityReplaceDocumentContext
    ): Promise<GraphDocument | void> {
      if (typeof options.client.replaceDocument !== "function") {
        return cloneDocument(document);
      }

      const replacedDocument = await options.client.replaceDocument(
        cloneDocument(document),
        cloneReplaceDocumentContext(context)
      );

      return replacedDocument ? cloneDocument(replacedDocument) : undefined;
    },

    async controlRuntime(
      request: EditorRemoteAuthorityRuntimeControlRequest
    ): Promise<EditorRemoteAuthorityRuntimeControlResult> {
      if (typeof options.client.controlRuntime !== "function") {
        return {
          accepted: false,
          changed: false,
          reason: "authority 不支持运行控制"
        };
      }

      return cloneRuntimeControlResult(
        await options.client.controlRuntime(
          cloneRuntimeControlRequest(request)
        )
      );
    },

    subscribe(listener) {
      if (typeof options.client.subscribe !== "function") {
        return () => {};
      }

      return options.client.subscribe(listener);
    },

    subscribeDocument(listener) {
      if (typeof options.client.subscribeDocument !== "function") {
        return () => {};
      }

      return options.client.subscribeDocument(listener);
    },

    subscribeDocumentDiff(listener) {
      if (typeof options.client.subscribeDocumentDiff !== "function") {
        return () => {};
      }

      return options.client.subscribeDocumentDiff(listener);
    },

    dispose(): void {
      if (options.disposeClientOnDispose !== false) {
        options.client.dispose?.();
      }
    }
  };
}

/**
 * 把 authority transport 适配为 authority service。
 *
 * @remarks
 * 这层优先复用标准 transport client，再继续收口到 service；
 * 这样宿主侧不需要分别维护 transport / service 两套业务逻辑。
 */
export function createTransportBackedRemoteAuthorityService(
  options: CreateTransportBackedRemoteAuthorityServiceOptions
): EditorRemoteAuthorityDocumentService {
  const client = createTransportRemoteAuthorityClient({
    transport: options.transport
  });

  return createClientBackedRemoteAuthorityService({
    client,
    disposeClientOnDispose: options.disposeTransportOnDispose ?? true
  });
}
