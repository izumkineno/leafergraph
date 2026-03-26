/**
 * OpenRPC outlet 模块。
 *
 * @remarks
 * 负责把当前 authority OpenRPC method / notification 映射成同步包根层语义。
 */
import { applyGraphDocumentDiffToDocument } from "leafergraph/graph-document-diff";
import {
  cloneValue,
  type ConnectionStatus,
  type DocumentSnapshot,
  type SyncAck,
  type SyncCommand,
  type SyncOutlet,
  type SyncOutletEvent
} from "../core";
import {
  createProtocolError,
  validateControlRuntimeResult,
  validateDocumentDiffNotification,
  validateDocumentNotification,
  validateFrontendBundlesNotification,
  validateGetDocumentResult,
  validateMethodParams,
  validateReplaceDocumentResult,
  validateRuntimeFeedbackNotification,
  validateSubmitOperationResult
} from "./validation";
import type {
  CreateOpenRpcOutletOptions,
  JsonRpcErrorEnvelope,
  JsonRpcRequestEnvelope,
  OpenRpcCarrier,
  OpenRpcMethodParams
} from "./types";
import { OPENRPC_METHODS, OPENRPC_NOTIFICATIONS } from "./types";

function createRequestEnvelope(
  method: string,
  params: OpenRpcMethodParams,
  requestId: string
): JsonRpcRequestEnvelope {
  return {
    jsonrpc: "2.0",
    id: requestId,
    method,
    ...(params === undefined ? {} : { params: validateMethodParams(method, params) })
  };
}

function toRequestError(response: JsonRpcErrorEnvelope): Error {
  return new Error(response.error.message);
}

class OpenRpcOutletImpl implements SyncOutlet {
  private readonly listeners = new Set<
    (event: SyncOutletEvent) => void
  >();
  private readonly pendingOperationIds = new Set<string>();
  private currentDocument?: DocumentSnapshot;
  private requestSequence = 0;
  private carrierUnsubscribe: (() => void) | null = null;
  private started = false;
  private connectionStatus: ConnectionStatus;
  private readonly carrier: OpenRpcCarrier;

  constructor(carrier: OpenRpcCarrier) {
    this.carrier = carrier;
    this.connectionStatus = carrier.getConnectionStatus();
  }

  async getSnapshot(): Promise<DocumentSnapshot> {
    this.ensureStarted();

    // `getSnapshot()` 是首连与 resync 共用的整图入口，不通过特殊 command 间接表达。
    const response = await this.carrier.request(
      createRequestEnvelope(
        OPENRPC_METHODS.getDocument,
        undefined,
        this.nextRequestId("get-document")
      )
    );

    if ("error" in response) {
      throw toRequestError(response);
    }

    try {
      const snapshot = validateGetDocumentResult(response.result);
      this.currentDocument = cloneValue(snapshot);
      return cloneValue(snapshot);
    } catch (error) {
      const outletError = createProtocolError(
        "authority.getDocument result 解码失败",
        error
      );
      this.emit({
        type: "error",
        error: outletError
      });
      throw new Error(outletError.message);
    }
  }

  async request(command: SyncCommand): Promise<SyncAck> {
    this.ensureStarted();
    switch (command.type) {
      case "document.apply-operation":
        return this.requestApplyOperation(command);
      case "document.replace":
        return this.requestReplaceDocument(command);
      case "runtime.control":
        return this.requestRuntimeControl(command);
    }
  }

  subscribe(listener: (event: SyncOutletEvent) => void): () => void {
    this.ensureStarted();
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  async dispose(): Promise<void> {
    this.listeners.clear();
    this.pendingOperationIds.clear();
    this.carrierUnsubscribe?.();
    this.carrierUnsubscribe = null;
    await this.carrier.dispose?.();
  }

  private ensureStarted(): void {
    if (this.started) {
      return;
    }

    // outlet 只负责把 carrier 事件映射成根层事件面；
    // pending、resync、storage 恢复等更高层编排仍然留在 session。
    this.started = true;
    this.connectionStatus = this.carrier.getConnectionStatus();
    this.carrierUnsubscribe = this.carrier.subscribe((event) => {
      switch (event.type) {
        case "connection":
          this.connectionStatus = event.status;
          this.emit({
            type: "connection",
            status: event.status
          });
          return;
        case "error":
          this.emit({
            type: "error",
            error: event.error
          });
          return;
        case "notification":
          this.handleNotification(event.notification.method, event.notification.params);
          return;
      }
    });
  }

  private async requestApplyOperation(
    command: Extract<SyncCommand, { type: "document.apply-operation" }>
  ): Promise<SyncAck> {
    const currentDocument = this.requireCurrentDocument(command.type);
    this.pendingOperationIds.add(command.operation.operationId);
    try {
      // operation 提交时会把当前 authority 文档与待确认 operation id 一起带上，
      // 帮助 authority 做版本与因果校验。
      const response = await this.carrier.request(
        createRequestEnvelope(
          OPENRPC_METHODS.submitOperation,
          {
            operation: cloneValue(command.operation),
            context: {
              currentDocument: cloneValue(currentDocument),
              pendingOperationIds: [...this.pendingOperationIds]
            }
          },
          this.nextRequestId("submit-operation")
        )
      );

      if ("error" in response) {
        throw toRequestError(response);
      }

      const result = validateSubmitOperationResult(response.result);
      if (result.document) {
        this.currentDocument = cloneValue(result.document);
      }

      return {
        commandId: command.commandId,
        type: command.type,
        status: result.accepted ? "accepted" : "rejected",
        changed: result.changed,
        reason: result.reason,
        documentRevision: result.document?.revision ?? result.revision,
        ...(result.document ? { snapshot: cloneValue(result.document) } : {})
      };
    } catch (error) {
      const outletError = createProtocolError(
        "authority.submitOperation result 解码失败",
        error
      );
      if (!(error instanceof Error) || error.message !== outletError.message) {
        this.emit({
          type: "error",
          error: outletError
        });
      }
      throw error instanceof Error ? error : new Error(outletError.message);
    } finally {
      this.pendingOperationIds.delete(command.operation.operationId);
    }
  }

  private async requestReplaceDocument(
    command: Extract<SyncCommand, { type: "document.replace" }>
  ): Promise<SyncAck> {
    const currentDocument = this.requireCurrentDocument(command.type);
    const response = await this.carrier.request(
      createRequestEnvelope(
        OPENRPC_METHODS.replaceDocument,
        {
          document: cloneValue(command.snapshot),
          context: {
            currentDocument: cloneValue(currentDocument)
          }
        },
        this.nextRequestId("replace-document")
      )
    );

    if ("error" in response) {
      throw toRequestError(response);
    }

    try {
      const snapshot =
        validateReplaceDocumentResult(response.result) ?? cloneValue(command.snapshot);
      this.currentDocument = cloneValue(snapshot);
      return {
        commandId: command.commandId,
        type: command.type,
        status: "accepted",
        changed: true,
        documentRevision: snapshot.revision,
        snapshot
      };
    } catch (error) {
      const outletError = createProtocolError(
        "authority.replaceDocument result 解码失败",
        error
      );
      this.emit({
        type: "error",
        error: outletError
      });
      throw new Error(outletError.message);
    }
  }

  private async requestRuntimeControl(
    command: Extract<SyncCommand, { type: "runtime.control" }>
  ): Promise<SyncAck> {
    const response = await this.carrier.request(
      createRequestEnvelope(
        OPENRPC_METHODS.controlRuntime,
        {
          request: cloneValue(command.request)
        },
        this.nextRequestId("control-runtime")
      )
    );

    if ("error" in response) {
      throw toRequestError(response);
    }

    try {
      const result = validateControlRuntimeResult(response.result);
      return {
        commandId: command.commandId,
        type: command.type,
        status: result.accepted ? "accepted" : "rejected",
        changed: result.changed,
        reason: result.reason,
        ...(result.state ? { runtimeState: cloneValue(result.state) } : {})
      };
    } catch (error) {
      const outletError = createProtocolError(
        "authority.controlRuntime result 解码失败",
        error
      );
      this.emit({
        type: "error",
        error: outletError
      });
      throw new Error(outletError.message);
    }
  }

  private handleNotification(method: string, params: unknown): void {
    try {
      switch (method) {
        case OPENRPC_NOTIFICATIONS.document: {
          // authority.document 是新的整图事实，优先级高于当前本地缓存的任何上下文。
          const snapshot = validateDocumentNotification(params);
          this.currentDocument = cloneValue(snapshot);
          this.emit({
            type: "snapshot",
            snapshot
          });
          return;
        }
        case OPENRPC_NOTIFICATIONS.documentDiff: {
          // outlet 先尝试用 patch 前推自己的 currentDocument，确保后续 command context
          // 仍然能引用到最新 authority 基线；一旦失败，就清空 currentDocument，
          // 让上层 session 在下一步走 resync-only。
          const patch = validateDocumentDiffNotification(params);
          if (!this.currentDocument) {
            this.emit({
              type: "error",
              error: createProtocolError(
                "authority.documentDiff 到达时 OpenRPC outlet 尚无当前快照"
              )
            });
            return;
          }

          const applyResult = applyGraphDocumentDiffToDocument(
            cloneValue(this.currentDocument),
            cloneValue(patch)
          );
          if (!applyResult.success) {
            this.currentDocument = undefined;
            this.emit({
              type: "error",
              error: createProtocolError(
                "authority.documentDiff 无法安全前推 OpenRPC outlet 的当前快照",
                applyResult.reason
              )
            });
          } else {
            this.currentDocument = cloneValue(applyResult.document);
          }

          this.emit({
            type: "patch",
            patch
          });
          return;
        }
        case OPENRPC_NOTIFICATIONS.runtimeFeedback: {
          const feedback = validateRuntimeFeedbackNotification(params);
          this.emit({
            type: "feedback",
            feedback
          });
          return;
        }
        case OPENRPC_NOTIFICATIONS.frontendBundlesSync:
          // 这类事件属于协议专属 bundle 同步语义，不进入 sync 根层事件面。
          // 这里仍然做结构校验，避免把坏 notification 静默吞掉。
          validateFrontendBundlesNotification(params);
          return;
        default:
          return;
      }
    } catch (error) {
      this.emit({
        type: "error",
        error: createProtocolError(
          `OpenRPC notification ${method} 解码失败`,
          error
        )
      });
    }
  }

  private emit(event: SyncOutletEvent): void {
    const clonedEvent = cloneValue(event);
    for (const listener of this.listeners) {
      listener(cloneValue(clonedEvent));
    }
  }

  private nextRequestId(label: string): string {
    this.requestSequence += 1;
    return `openrpc-${label}-${this.requestSequence}`;
  }

  private requireCurrentDocument(commandType: SyncCommand["type"]): DocumentSnapshot {
    if (!this.currentDocument) {
      throw new Error(`${commandType} 之前必须先建立 authority 文档基线`);
    }
    return cloneValue(this.currentDocument);
  }
}

/**
 * 创建协议无关 `SyncOutlet` 的 OpenRPC 子出口实现。
 *
 * @remarks
 * 当前实现把 OpenRPC method / notification 映射到根层同步语义，但不把 OpenRPC 字段抬到根出口。
 */
export function createOpenRpcOutlet(
  options: CreateOpenRpcOutletOptions
): SyncOutlet {
  return new OpenRpcOutletImpl(options.carrier);
}
