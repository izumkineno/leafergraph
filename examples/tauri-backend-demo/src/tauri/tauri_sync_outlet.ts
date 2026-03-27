/**
 * Tauri 专用 SyncOutlet 模块。
 *
 * @remarks
 * 负责在 demo 内把 Tauri `invoke + listen` 桥接成 `@leafergraph/sync`
 * 可直接消费的 `SyncOutlet`，但不反向写回 sync 包公共 API。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  cloneValue,
  isGraphDocument,
  isRecord,
  isRuntimeFeedbackEvent,
  type ConnectionStatus,
  type DocumentSnapshot,
  type SyncAck,
  type SyncCommand,
  type SyncOutlet,
  type SyncOutletError,
  type SyncOutletEvent
} from "@leafergraph/sync";

class OutletDecodeError extends Error {}

function isAckStatus(value: unknown): value is SyncAck["status"] {
  return (
    value === "accepted" ||
    value === "rejected" ||
    value === "resync-required"
  );
}

function isSyncAck(value: unknown): value is SyncAck {
  return (
    isRecord(value) &&
    typeof value.commandId === "string" &&
    typeof value.type === "string" &&
    isAckStatus(value.status)
  );
}

/**
 * Tauri 专用 SyncOutlet。
 *
 * @remarks
 * 这层职责只有两件事：
 * - 把后端 command 调用映射成 `getSnapshot/request`
 * - 把后端事件流映射成 `snapshot/feedback/connection/error`
 *
 * 它不负责 session、storage 或恢复裁决。
 */
class TauriSyncOutlet implements SyncOutlet {
  private readonly listeners = new Set<(event: SyncOutletEvent) => void>();
  private readonly unlistenCallbacks: Array<() => void> = [];
  private bridgeReadyPromise: Promise<void> | null = null;
  private connectionStatus: ConnectionStatus = "idle";
  private disposed = false;

  async getSnapshot(): Promise<DocumentSnapshot> {
    await this.ensureBridgeReady();

    try {
      const snapshot = await invoke<unknown>("sync_get_document");
      if (!isGraphDocument(snapshot)) {
        const error = this.createOutletError(
          "decode",
          "sync_get_document 返回的快照结构无效"
        );
        this.emit({ type: "error", error });
        throw new OutletDecodeError(error.message);
      }

      this.setConnectionStatus("connected");
      return cloneValue(snapshot);
    } catch (error) {
      if (error instanceof OutletDecodeError) {
        throw error;
      }
      this.reportInvokeFailure("拉取 authority 快照失败", error);
      throw error;
    }
  }

  async request(command: SyncCommand): Promise<SyncAck> {
    await this.ensureBridgeReady();

    try {
      const ack = await invoke<unknown>("sync_submit_command", {
        command: cloneValue(command)
      });
      if (!isSyncAck(ack)) {
        const error = this.createOutletError(
          "decode",
          "sync_submit_command 返回的 ack 结构无效"
        );
        this.emit({ type: "error", error });
        throw new OutletDecodeError(error.message);
      }

      this.setConnectionStatus("connected");
      return cloneValue(ack);
    } catch (error) {
      if (error instanceof OutletDecodeError) {
        throw error;
      }
      this.reportInvokeFailure("提交同步命令失败", error);
      throw error;
    }
  }

  subscribe(listener: (event: SyncOutletEvent) => void): () => void {
    this.listeners.add(listener);
    void this.ensureBridgeReady();

    return () => {
      this.listeners.delete(listener);
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    await this.bridgeReadyPromise?.catch(() => undefined);

    for (const unlisten of this.unlistenCallbacks.splice(0)) {
      try {
        unlisten();
      } catch {
        // demo 的事件解绑失败不应阻断整体卸载。
      }
    }

    this.listeners.clear();
    this.connectionStatus = "idle";
  }

  /**
   * 统一处理 Tauri 事件桥的懒注册。
   *
   * @remarks
   * `SyncOutlet.subscribe(...)` 是同步接口，但 Tauri `listen(...)` 返回 Promise。
   * 这里把它们收口成一条惰性初始化链，避免调用方自己感知异步事件桥细节。
   */
  private async ensureBridgeReady(): Promise<void> {
    if (this.disposed) {
      throw new Error("TauriSyncOutlet 已释放");
    }

    if (this.bridgeReadyPromise) {
      return this.bridgeReadyPromise;
    }

    this.setConnectionStatus("connecting");
    this.bridgeReadyPromise = (async () => {
      const unlistenSnapshot = await listen<unknown>(
        "sync:snapshot",
        (event) => {
          this.handleSnapshotPayload(event.payload);
        }
      );
      const unlistenFeedback = await listen<unknown>(
        "sync:feedback",
        (event) => {
          this.handleFeedbackPayload(event.payload);
        }
      );

      if (this.disposed) {
        unlistenSnapshot();
        unlistenFeedback();
        return;
      }

      this.unlistenCallbacks.push(unlistenSnapshot, unlistenFeedback);
      this.setConnectionStatus("connected");
    })().catch((error) => {
      this.bridgeReadyPromise = null;
      this.reportInvokeFailure("注册 Tauri 同步事件失败", error);
      throw error;
    });

    return this.bridgeReadyPromise;
  }

  /**
   * 把后端推送的 snapshot 事件映射成 sync 根层事件。
   *
   * @remarks
   * 这里会先校验 payload，再把坏数据转成 `error` 事件，
   * 避免 session 直接消费未验证载荷。
   */
  private handleSnapshotPayload(payload: unknown): void {
    if (
      !isRecord(payload) ||
      !("snapshot" in payload) ||
      !isGraphDocument(payload.snapshot)
    ) {
      this.emit({
        type: "error",
        error: this.createOutletError(
          "decode",
          "收到的 sync:snapshot 事件结构无效"
        )
      });
      return;
    }

    this.setConnectionStatus("connected");
    this.emit({
      type: "snapshot",
      snapshot: cloneValue(payload.snapshot)
    });
  }

  /**
   * 把后端推送的 runtime feedback 事件映射成 sync 根层事件。
   *
   * @remarks
   * v1 demo 只推 `feedback`，不引入 patch 或协议专属额外事件。
   */
  private handleFeedbackPayload(payload: unknown): void {
    if (
      !isRecord(payload) ||
      !("feedback" in payload) ||
      !isRuntimeFeedbackEvent(payload.feedback)
    ) {
      this.emit({
        type: "error",
        error: this.createOutletError(
          "decode",
          "收到的 sync:feedback 事件结构无效"
        )
      });
      return;
    }

    this.setConnectionStatus("connected");
    this.emit({
      type: "feedback",
      feedback: cloneValue(payload.feedback)
    });
  }

  private reportInvokeFailure(message: string, cause: unknown): void {
    this.setConnectionStatus("disconnected");
    this.emit({
      type: "error",
      error: this.createOutletError("transport", message, cause)
    });
  }

  private createOutletError(
    kind: SyncOutletError["kind"],
    message: string,
    cause?: unknown
  ): SyncOutletError {
    return {
      kind,
      message,
      cause
    };
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus === status) {
      return;
    }

    this.connectionStatus = status;
    this.emit({
      type: "connection",
      status
    });
  }

  private emit(event: SyncOutletEvent): void {
    if (this.disposed) {
      return;
    }

    const clonedEvent = cloneValue(event);
    for (const listener of this.listeners) {
      listener(cloneValue(clonedEvent));
    }
  }
}

/** 创建 demo 内部使用的 Tauri 专用同步出口。 */
export function createTauriSyncOutlet(): SyncOutlet {
  return new TauriSyncOutlet();
}
