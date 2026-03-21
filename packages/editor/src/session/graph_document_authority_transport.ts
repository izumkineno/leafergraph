import type {
  GraphDocument,
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

/** authority transport 当前支持的最小动作集合。 */
export type EditorRemoteAuthorityTransportAction =
  | "getDocument"
  | "submitOperation"
  | "replaceDocument"
  | "controlRuntime";

/** transport 层获取整图快照请求。 */
export interface EditorRemoteAuthorityGetDocumentRequest {
  action: "getDocument";
}

/** transport 层提交操作请求。 */
export interface EditorRemoteAuthoritySubmitOperationRequest {
  action: "submitOperation";
  operation: GraphOperation;
  context: EditorRemoteAuthorityOperationContext;
}

/** transport 层整图替换请求。 */
export interface EditorRemoteAuthorityReplaceDocumentRequest {
  action: "replaceDocument";
  document: GraphDocument;
  context: EditorRemoteAuthorityReplaceDocumentContext;
}

/** transport 层运行控制请求。 */
export interface EditorRemoteAuthorityControlRuntimeRequest {
  action: "controlRuntime";
  request: EditorRemoteAuthorityRuntimeControlRequest;
}

/** transport 层最小请求联合。 */
export type EditorRemoteAuthorityTransportRequest =
  | EditorRemoteAuthorityGetDocumentRequest
  | EditorRemoteAuthoritySubmitOperationRequest
  | EditorRemoteAuthorityReplaceDocumentRequest
  | EditorRemoteAuthorityControlRuntimeRequest;

/** transport 层获取整图快照响应。 */
export interface EditorRemoteAuthorityGetDocumentResponse {
  action: "getDocument";
  document: GraphDocument;
}

/** transport 层提交操作响应。 */
export interface EditorRemoteAuthoritySubmitOperationResponse {
  action: "submitOperation";
  result: EditorRemoteAuthorityOperationResult;
}

/** transport 层整图替换响应。 */
export interface EditorRemoteAuthorityReplaceDocumentResponse {
  action: "replaceDocument";
  document?: GraphDocument;
}

/** transport 层运行控制响应。 */
export interface EditorRemoteAuthorityControlRuntimeResponse {
  action: "controlRuntime";
  result: EditorRemoteAuthorityRuntimeControlResult;
}

/** transport 层最小响应联合。 */
export type EditorRemoteAuthorityTransportResponse =
  | EditorRemoteAuthorityGetDocumentResponse
  | EditorRemoteAuthoritySubmitOperationResponse
  | EditorRemoteAuthorityReplaceDocumentResponse
  | EditorRemoteAuthorityControlRuntimeResponse;

/** transport 层运行反馈事件。 */
export interface EditorRemoteAuthorityRuntimeFeedbackTransportEvent {
  type: "runtimeFeedback";
  event: RuntimeFeedbackEvent;
}

/** authority 推送前端 bundle 源码时，单个 bundle 的最小描述。 */
export interface EditorRemoteAuthorityFrontendBundleSource {
  bundleId: string;
  slot: "demo" | "node" | "widget";
  fileName: string;
  sourceCode: string;
  enabled: boolean;
  requires?: string[];
  sha256: string;
}

/** authority 推送前端 bundle 源码时，单个节点包的最小描述。 */
export interface EditorRemoteAuthorityFrontendBundlePackage {
  packageId: string;
  version: string;
  nodeTypes: string[];
  bundles: EditorRemoteAuthorityFrontendBundleSource[];
}

/** authority 推送前端 bundle 的同步事件。 */
export interface EditorRemoteAuthorityFrontendBundlesSyncEvent {
  type: "frontendBundles.sync";
  mode: "full" | "upsert" | "remove";
  packages?: EditorRemoteAuthorityFrontendBundlePackage[];
  removedPackageIds?: string[];
  emittedAt: number;
}

/** transport 层前端 bundle 同步事件。 */
export interface EditorRemoteAuthorityFrontendBundlesSyncTransportEvent {
  type: "frontendBundles.sync";
  event: EditorRemoteAuthorityFrontendBundlesSyncEvent;
}

/** transport 层 authority 主动回推的整图快照事件。 */
export interface EditorRemoteAuthorityDocumentTransportEvent {
  type: "document";
  document: GraphDocument;
}

/** transport 当前允许上抛的最小事件集合。 */
export type EditorRemoteAuthorityTransportEvent =
  | EditorRemoteAuthorityRuntimeFeedbackTransportEvent
  | EditorRemoteAuthorityDocumentTransportEvent
  | EditorRemoteAuthorityFrontendBundlesSyncTransportEvent;

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
  extends Omit<EditorRemoteAuthorityClient, "subscribeDocument"> {
  getDocument(): Promise<GraphDocument>;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  subscribeFrontendBundles?(
    listener: (event: EditorRemoteAuthorityFrontendBundlesSyncEvent) => void
  ): () => void;
}

function cloneGraphDocument(document: GraphDocument): GraphDocument {
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
      const response =
        await options.transport.request<EditorRemoteAuthorityGetDocumentResponse>({
          action: "getDocument"
        });
      return cloneGraphDocument(response.document);
    },

    async submitOperation(
      operation: GraphOperation,
      context: EditorRemoteAuthorityOperationContext
    ): Promise<EditorRemoteAuthorityOperationResult> {
      const response =
        await options.transport.request<EditorRemoteAuthoritySubmitOperationResponse>({
          action: "submitOperation",
          operation: cloneOperation(operation),
          context: cloneOperationContext(context)
        });
      return cloneOperationResult(response.result);
    },

    async replaceDocument(
      document: GraphDocument,
      context: EditorRemoteAuthorityReplaceDocumentContext
    ): Promise<GraphDocument | void> {
      const response =
        await options.transport.request<EditorRemoteAuthorityReplaceDocumentResponse>(
          {
            action: "replaceDocument",
            document: cloneGraphDocument(document),
            context: cloneReplaceDocumentContext(context)
          }
        );
      return response.document
        ? cloneGraphDocument(response.document)
        : undefined;
    },

    async controlRuntime(
      request: EditorRemoteAuthorityRuntimeControlRequest
    ): Promise<EditorRemoteAuthorityRuntimeControlResult> {
      const response =
        await options.transport.request<EditorRemoteAuthorityControlRuntimeResponse>(
          {
            action: "controlRuntime",
            request: cloneRuntimeControlRequest(request)
          }
        );
      return cloneRuntimeControlResult(response.result);
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
      frontendBundleListeners.clear();
      frontendBundleCatalog.clear();
      options.transport.dispose?.();
    }
  };
}
