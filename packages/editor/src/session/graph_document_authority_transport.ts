/**
 * authority transport 与标准 client 模块。
 *
 * @remarks
 * 负责定义 editor 侧统一 transport 抽象，并把底层 transport 封装成标准 authority client。
 */
import type {
  GraphDocument,
  GraphDocumentDiff,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import type {
  EditorRemoteAuthorityClient,
  EditorRemoteAuthorityConnectionStatus,
  EditorRemoteAuthorityOperationContext,
  EditorRemoteAuthorityOperationResult,
  EditorRemoteAuthorityRuntimeControlRequest,
  EditorRemoteAuthorityRuntimeControlResult,
  EditorRemoteAuthorityReplaceDocumentContext
} from "./graph_document_authority_client";
import type {
  EditorRemoteAuthorityFrontendBundlePackage,
  EditorRemoteAuthorityFrontendBundlesSyncEvent,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./authority_openrpc/_generated/transport_types";
export type {
  EditorRemoteAuthorityControlRuntimeRequest,
  EditorRemoteAuthorityDiscoverRequest,
  EditorRemoteAuthorityDocumentDiffTransportEvent,
  EditorRemoteAuthorityDocumentTransportEvent,
  EditorRemoteAuthorityFrontendBundlePackage,
  EditorRemoteAuthorityFrontendBundleSource,
  EditorRemoteAuthorityFrontendBundlesSyncEvent,
  EditorRemoteAuthorityFrontendBundlesSyncTransportEvent,
  EditorRemoteAuthorityGetDocumentRequest,
  EditorRemoteAuthorityOpenRpcDocument,
  EditorRemoteAuthorityReplaceDocumentRequest,
  EditorRemoteAuthorityRuntimeFeedbackTransportEvent,
  EditorRemoteAuthoritySubmitOperationRequest,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./authority_openrpc/_generated/transport_types";

/**
 * editor authority transport 抽象。
 *
 * @remarks
 * 这一层只负责：
 * 1. 请求 / 响应
 * 2. authority 主动上抛事件
 *
 * 不在这里固化具体传输协议实现细节。
 */
export interface EditorRemoteAuthorityTransport {
  request<TResponse extends EditorRemoteAuthorityTransportResponse>(
    request: EditorRemoteAuthorityTransportRequest
  ): Promise<TResponse>;
  subscribe(
    listener: (event: EditorRemoteAuthorityTransportEvent) => void
  ): () => void;
  getConnectionStatus?(): EditorRemoteAuthorityConnectionStatus;
  subscribeConnectionStatus?(
    listener: (status: EditorRemoteAuthorityConnectionStatus) => void
  ): () => void;
  dispose?(): void;
}

/** 带整图拉取能力的 authority client。 */
export interface EditorRemoteAuthorityDocumentClient
  extends Omit<
    EditorRemoteAuthorityClient,
    "subscribeDocument" | "subscribeDocumentDiff"
  > {
  getDocument(): Promise<GraphDocument>;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  subscribeDocumentDiff(listener: (diff: GraphDocumentDiff) => void): () => void;
  subscribeFrontendBundles?(
    listener: (event: EditorRemoteAuthorityFrontendBundlesSyncEvent) => void
  ): () => void;
}

function cloneGraphDocument(document: GraphDocument): GraphDocument {
  return structuredClone(document);
}

function cloneGraphDocumentDiff(diff: GraphDocumentDiff): GraphDocumentDiff {
  return structuredClone(diff);
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

function cloneRuntimeFeedbackEvent(
  event: RuntimeFeedbackEvent
): RuntimeFeedbackEvent {
  return structuredClone(event);
}

function cloneFrontendBundlesSyncEvent(
  event: EditorRemoteAuthorityFrontendBundlesSyncEvent
): EditorRemoteAuthorityFrontendBundlesSyncEvent {
  return structuredClone(event);
}

function cloneFrontendBundlePackage(
  bundlePackage: EditorRemoteAuthorityFrontendBundlePackage
): EditorRemoteAuthorityFrontendBundlePackage {
  return structuredClone(bundlePackage);
}

function applyFrontendBundlesSyncEventToCatalog(
  catalog: Map<string, EditorRemoteAuthorityFrontendBundlePackage>,
  event: EditorRemoteAuthorityFrontendBundlesSyncEvent
): void {
  switch (event.mode) {
    case "full": {
      catalog.clear();
      for (const bundlePackage of event.packages ?? []) {
        catalog.set(
          bundlePackage.packageId,
          cloneFrontendBundlePackage(bundlePackage)
        );
      }
      return;
    }
    case "upsert": {
      for (const bundlePackage of event.packages ?? []) {
        catalog.set(
          bundlePackage.packageId,
          cloneFrontendBundlePackage(bundlePackage)
        );
      }
      return;
    }
    case "remove": {
      for (const packageId of event.removedPackageIds ?? []) {
        catalog.delete(packageId);
      }
      return;
    }
  }
}

function createFrontendBundlesSnapshotEvent(options: {
  catalog: ReadonlyMap<string, EditorRemoteAuthorityFrontendBundlePackage>;
  emittedAt: number;
}): EditorRemoteAuthorityFrontendBundlesSyncEvent {
  return {
    type: "frontendBundles.sync",
    mode: "full",
    packages: [...options.catalog.values()].map(cloneFrontendBundlePackage),
    emittedAt: options.emittedAt
  };
}

function hasConnectionStatusSource(
  transport: EditorRemoteAuthorityTransport
): transport is EditorRemoteAuthorityTransport & {
  getConnectionStatus(): EditorRemoteAuthorityConnectionStatus;
  subscribeConnectionStatus(
    listener: (status: EditorRemoteAuthorityConnectionStatus) => void
  ): () => void;
} {
  return (
    typeof transport.getConnectionStatus === "function" &&
    typeof transport.subscribeConnectionStatus === "function"
  );
}

/**
 * 基于通用 transport 创建 authority client。
 *
 * @remarks
 * session 仍然只依赖 `EditorRemoteAuthorityClient`；
 * 只有需要主动拉取整图初始快照时，才使用这里补的 `getDocument()`。
 */
export function createTransportRemoteAuthorityClient(options: {
  transport: EditorRemoteAuthorityTransport;
}): EditorRemoteAuthorityDocumentClient {
  const runtimeFeedbackListeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();
  const documentListeners = new Set<(document: GraphDocument) => void>();
  const documentDiffListeners = new Set<(diff: GraphDocumentDiff) => void>();
  const frontendBundleListeners = new Set<
    (event: EditorRemoteAuthorityFrontendBundlesSyncEvent) => void
  >();
  const frontendBundleCatalog = new Map<
    string,
    EditorRemoteAuthorityFrontendBundlePackage
  >();
  let hasFrontendBundleSnapshot = false;
  let frontendBundleSnapshotEmittedAt = 0;
  const disposeTransportSubscription = options.transport.subscribe((event) => {
    if (event.type === "runtimeFeedback") {
      const feedback = cloneRuntimeFeedbackEvent(event.event);
      for (const listener of runtimeFeedbackListeners) {
        listener(feedback);
      }
      return;
    }

    if (event.type === "document") {
      const document = cloneGraphDocument(event.document);
      for (const listener of documentListeners) {
        listener(document);
      }
      return;
    }

    if (event.type === "documentDiff") {
      const diff = cloneGraphDocumentDiff(event.diff);
      for (const listener of documentDiffListeners) {
        listener(diff);
      }
      return;
    }

    if (event.type === "frontendBundles.sync") {
      applyFrontendBundlesSyncEventToCatalog(frontendBundleCatalog, event.event);
      hasFrontendBundleSnapshot = true;
      frontendBundleSnapshotEmittedAt = event.event.emittedAt;
      const snapshot = cloneFrontendBundlesSyncEvent(event.event);
      for (const listener of frontendBundleListeners) {
        listener(snapshot);
      }
    }
  });

  return {
    async getDocument(): Promise<GraphDocument> {
      const response = await options.transport.request<GraphDocument>({
        method: "authority.getDocument"
      });
      return cloneGraphDocument(response);
    },

    async submitOperation(
      operation: GraphOperation,
      context: EditorRemoteAuthorityOperationContext
    ): Promise<EditorRemoteAuthorityOperationResult> {
      const response =
        await options.transport.request<EditorRemoteAuthorityOperationResult>({
          method: "authority.submitOperation",
          params: {
            operation: cloneOperation(operation),
            context: cloneOperationContext(context)
          }
        });
      return cloneOperationResult(response);
    },

    async replaceDocument(
      document: GraphDocument,
      context: EditorRemoteAuthorityReplaceDocumentContext
    ): Promise<GraphDocument | void> {
      const response =
        await options.transport.request<GraphDocument | null>({
          method: "authority.replaceDocument",
          params: {
            document: cloneGraphDocument(document),
            context: cloneReplaceDocumentContext(context)
          }
        });
      return response ? cloneGraphDocument(response) : undefined;
    },

    async controlRuntime(
      request: EditorRemoteAuthorityRuntimeControlRequest
    ): Promise<EditorRemoteAuthorityRuntimeControlResult> {
      const response =
        await options.transport.request<EditorRemoteAuthorityRuntimeControlResult>(
          {
            method: "authority.controlRuntime",
            params: {
              request: cloneRuntimeControlRequest(request)
            }
          }
        );
      return cloneRuntimeControlResult(response);
    },

    subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
      runtimeFeedbackListeners.add(listener);

      return () => {
        runtimeFeedbackListeners.delete(listener);
      };
    },

    subscribeDocument(
      listener: (document: GraphDocument) => void
    ): () => void {
      documentListeners.add(listener);

      return () => {
        documentListeners.delete(listener);
      };
    },

    subscribeDocumentDiff(
      listener: (diff: GraphDocumentDiff) => void
    ): () => void {
      documentDiffListeners.add(listener);

      return () => {
        documentDiffListeners.delete(listener);
      };
    },

    subscribeFrontendBundles(
      listener: (event: EditorRemoteAuthorityFrontendBundlesSyncEvent) => void
    ): () => void {
      frontendBundleListeners.add(listener);
      if (hasFrontendBundleSnapshot) {
        listener(
          createFrontendBundlesSnapshotEvent({
            catalog: frontendBundleCatalog,
            emittedAt: frontendBundleSnapshotEmittedAt
          })
        );
      }
      return () => {
        frontendBundleListeners.delete(listener);
      };
    },

    getConnectionStatus(): EditorRemoteAuthorityConnectionStatus {
      return hasConnectionStatusSource(options.transport)
        ? options.transport.getConnectionStatus()
        : "disconnected";
    },

    subscribeConnectionStatus(
      listener: (status: EditorRemoteAuthorityConnectionStatus) => void
    ): () => void {
      if (!hasConnectionStatusSource(options.transport)) {
        listener("disconnected");
        return () => {};
      }

      return options.transport.subscribeConnectionStatus(listener);
    },

    dispose(): void {
      disposeTransportSubscription();
      runtimeFeedbackListeners.clear();
      documentListeners.clear();
      documentDiffListeners.clear();
      frontendBundleListeners.clear();
      frontendBundleCatalog.clear();
      options.transport.dispose?.();
    }
  };
}
