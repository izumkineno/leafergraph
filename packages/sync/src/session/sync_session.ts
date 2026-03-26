/**
 * authority-first session 模块。
 *
 * @remarks
 * 负责把 outlet、storage 和恢复策略编排成可复用的同步会话。
 */
import { applyGraphDocumentDiffToDocument } from "leafergraph/graph-document-diff";
import {
  cloneValue,
  DEFAULT_RESYNC_POLICY,
  type ConnectionStatus,
  type CreateSyncSessionOptions,
  type DocumentSnapshot,
  type ResyncPolicy,
  type RuntimeFeedback,
  type SyncAck,
  type SyncOutletEvent,
  type SyncSession,
  type SyncStorage,
  type SyncStorageScope,
  type SyncStoredState
} from "../core";
import { resolveSyncStorage } from "../storage";

type SnapshotSource =
  | "storage-recovery"
  | "authority-event"
  | "resync"
  | "ack-snapshot";

/**
 * 合并调用方覆盖的恢复策略。
 *
 * @remarks
 * v1 固定采用 authority-first + resync-only，只允许覆写触发整图重拉的时机。
 */
function mergeResyncPolicy(
  policy?: Partial<ResyncPolicy>
): ResyncPolicy {
  return {
    ...DEFAULT_RESYNC_POLICY,
    ...policy
  };
}

async function saveAuthoritativeSnapshot(options: {
  storage?: SyncStorage;
  scope?: SyncStorageScope;
  snapshot: DocumentSnapshot;
}): Promise<void> {
  if (!options.storage || !options.scope) {
    return;
  }

  const state: SyncStoredState = {
    snapshot: cloneValue(options.snapshot),
    recoveryMeta: {
      revision: options.snapshot.revision,
      savedAt: Date.now()
    }
  };
  await options.storage.save(options.scope, state);
}

class SyncSessionImpl implements SyncSession {
  private readonly documentListeners = new Set<
    (snapshot: DocumentSnapshot) => void
  >();
  private readonly feedbackListeners = new Set<
    (feedback: RuntimeFeedback) => void
  >();
  private readonly connectionListeners = new Set<
    (status: ConnectionStatus) => void
  >();
  private readonly resyncPolicy: ResyncPolicy;
  private readonly options: CreateSyncSessionOptions;
  private readonly outlet;
  private currentSnapshot?: DocumentSnapshot;
  private connectionStatus: ConnectionStatus;
  private connectPromise: Promise<void> | null = null;
  private resyncPromise: Promise<DocumentSnapshot> | null = null;
  private outletUnsubscribe: (() => void) | null = null;
  private resolvedStorage?: SyncStorage;
  private resolvedStorageScope?: SyncStorageScope;
  private ownsResolvedStorage = false;
  private attemptedStorageRecovery = false;
  private hasEstablishedAuthorityFact = false;
  private sawReconnectGap = false;
  private disposed = false;

  constructor(options: CreateSyncSessionOptions) {
    this.options = options;
    this.outlet = options.outlet;
    this.resyncPolicy = mergeResyncPolicy(options.resyncPolicy);
    this.connectionStatus = options.outlet.getConnectionStatus?.() ?? "idle";
  }

  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error("sync session 已释放");
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.doConnect().catch((error) => {
      this.connectPromise = null;
      throw error;
    });
    return this.connectPromise;
  }

  async resync(): Promise<DocumentSnapshot> {
    if (this.disposed) {
      throw new Error("sync session 已释放");
    }

    this.ensureInfrastructure();
    if (this.resyncPromise) {
      return this.resyncPromise;
    }

    this.resyncPromise = this.fetchAndApplySnapshot("resync").finally(() => {
      this.resyncPromise = null;
    });
    return this.resyncPromise;
  }

  async submitCommand(command: Parameters<SyncSession["submitCommand"]>[0]): Promise<SyncAck> {
    await this.connect();
    const ack = await this.outlet.request(cloneValue(command));

    // authority 在 ack 里直接给出正式快照时，session 立即整体替换当前文档基线。
    if ("snapshot" in ack && ack.snapshot) {
      await this.applySnapshot(ack.snapshot, "ack-snapshot");
    }

    // v1 不做本地补救或 pending replay，只要 authority 拒绝或要求重同步，
    // 就直接按策略重拉整图。
    if (
      (ack.status === "rejected" || ack.status === "resync-required") &&
      this.resyncPolicy.onAckRejected === "refetch"
    ) {
      await this.resync();
    }

    return cloneValue(ack);
  }

  getDocumentSnapshot(): DocumentSnapshot | undefined {
    return this.currentSnapshot ? cloneValue(this.currentSnapshot) : undefined;
  }

  subscribeDocument(
    listener: (snapshot: DocumentSnapshot) => void
  ): () => void {
    this.documentListeners.add(listener);
    if (this.currentSnapshot) {
      listener(cloneValue(this.currentSnapshot));
    }

    return () => {
      this.documentListeners.delete(listener);
    };
  }

  subscribeRuntimeFeedback(
    listener: (feedback: RuntimeFeedback) => void
  ): () => void {
    this.feedbackListeners.add(listener);
    return () => {
      this.feedbackListeners.delete(listener);
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  subscribeConnectionStatus(
    listener: (status: ConnectionStatus) => void
  ): () => void {
    this.connectionListeners.add(listener);
    listener(this.connectionStatus);

    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.outletUnsubscribe?.();
    this.outletUnsubscribe = null;
    this.documentListeners.clear();
    this.feedbackListeners.clear();
    this.connectionListeners.clear();

    await this.outlet.dispose?.();

    if (this.ownsResolvedStorage) {
      await this.resolvedStorage?.dispose?.();
    }
  }

  private async doConnect(): Promise<void> {
    // 首连时序固定为：
    // 1. 建立 outlet 订阅与 storage 解析
    // 2. 如有 recovery snapshot，先把它投影成临时启动基线
    // 3. 拉取 authority 首快照，并整体替换临时基线
    this.ensureInfrastructure();
    await this.restoreStorageRecovery();
    await this.fetchAndApplySnapshot("authority-event");
  }

  private ensureInfrastructure(): void {
    if (!this.outletUnsubscribe) {
      this.outletUnsubscribe = this.outlet.subscribe((event) => {
        void this.handleOutletEvent(event);
      });
      this.setConnectionStatus(this.outlet.getConnectionStatus?.() ?? this.connectionStatus);
    }

    if (!this.resolvedStorageScope) {
      // storage 三态入口的裁决统一收敛在这里，避免 session 其它位置重新发明规则。
      const resolvedStorage = resolveSyncStorage({
        documentId: this.options.documentId,
        storage: this.options.storage,
        storageScope: this.options.storageScope
      });
      this.resolvedStorage = resolvedStorage.storage;
      this.resolvedStorageScope = resolvedStorage.scope;
      this.ownsResolvedStorage = resolvedStorage.ownsStorage;
    }
  }

  private async restoreStorageRecovery(): Promise<void> {
    if (this.attemptedStorageRecovery) {
      return;
    }

    this.attemptedStorageRecovery = true;
    if (!this.resolvedStorage || !this.resolvedStorageScope) {
      return;
    }

    try {
      const storedState = await this.resolvedStorage.load(this.resolvedStorageScope);
      if (!storedState?.snapshot) {
        return;
      }

      // recovery snapshot 只用于减少空白态，不会提升为 authority 真源。
      await this.applySnapshot(storedState.snapshot, "storage-recovery");
    } catch {
      // storage 只负责加速恢复，恢复失败时直接回退到 authority 对齐。
    }
  }

  private async fetchAndApplySnapshot(
    source: SnapshotSource
  ): Promise<DocumentSnapshot> {
    // 首连与 resync 共用同一条“整图拉取 -> 整体替换”链路。
    // v1 不定义 recovery snapshot 与 authority snapshot 的 merge 语义。
    const snapshot = await this.outlet.getSnapshot();
    await this.applySnapshot(snapshot, source);
    this.hasEstablishedAuthorityFact = true;
    this.sawReconnectGap = false;
    return cloneValue(snapshot);
  }

  private async applySnapshot(
    snapshot: DocumentSnapshot,
    source: SnapshotSource
  ): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.currentSnapshot = cloneValue(snapshot);
    this.emitDocumentSnapshot(this.currentSnapshot);

    // 只有 authority 已确认的快照才会落盘；storage-recovery 是读出来的临时基线，
    // 不应在这里反向覆盖缓存。
    if (source !== "storage-recovery") {
      await saveAuthoritativeSnapshot({
        storage: this.resolvedStorage,
        scope: this.resolvedStorageScope,
        snapshot: this.currentSnapshot
      }).catch(() => undefined);
    }
  }

  private async handleOutletEvent(event: SyncOutletEvent): Promise<void> {
    if (this.disposed) {
      return;
    }

    switch (event.type) {
      case "snapshot":
        await this.applySnapshot(event.snapshot, "authority-event");
        this.hasEstablishedAuthorityFact = true;
        this.sawReconnectGap = false;
        return;
      case "patch":
        await this.handlePatchEvent(event);
        return;
      case "feedback":
        this.emitRuntimeFeedback(event.feedback);
        return;
      case "connection":
        this.handleConnectionEvent(event.status);
        return;
      case "error":
        this.handleErrorEvent(event);
        return;
    }
  }

  private async handlePatchEvent(
    event: Extract<SyncOutletEvent, { type: "patch" }>
  ): Promise<void> {
    // patch 必须建立在一份可信的 authority 基线上；如果当前没有基线，直接重拉整图。
    if (!this.currentSnapshot) {
      if (this.resyncPolicy.onPatchFailure === "refetch") {
        void this.resync().catch(() => undefined);
      }
      return;
    }

    const applyResult = applyGraphDocumentDiffToDocument(
      cloneValue(this.currentSnapshot),
      cloneValue(event.patch)
    );

    // diff 无法安全应用时统一走 resync-only：
    // documentId 不匹配、baseRevision 不匹配或 patch 本身损坏，都不做局部 merge。
    if (!applyResult.success) {
      if (this.resyncPolicy.onPatchFailure === "refetch") {
        void this.resync().catch(() => undefined);
      }
      return;
    }

    await this.applySnapshot(applyResult.document, "authority-event");
    this.hasEstablishedAuthorityFact = true;
  }

  private handleConnectionEvent(status: ConnectionStatus): void {
    const previousStatus = this.connectionStatus;
    this.setConnectionStatus(status);

    // 只有 authority 事实链已经建立后，断线才会被视为“需要补一次重同步”的缺口。
    if (
      this.hasEstablishedAuthorityFact &&
      (status === "reconnecting" || status === "disconnected")
    ) {
      this.sawReconnectGap = true;
      return;
    }

    if (
      this.hasEstablishedAuthorityFact &&
      this.sawReconnectGap &&
      status === "connected" &&
      previousStatus !== "connected" &&
      this.resyncPolicy.onReconnect === "refetch"
    ) {
      // reconnect 只说明链路恢复，不说明本地事实仍然可信。
      void this.resync().catch(() => undefined);
    }
  }

  private handleErrorEvent(
    event: Extract<SyncOutletEvent, { type: "error" }>
  ): void {
    // decode / protocol 错误意味着当前同步链的事实可靠性已经无法确认，
    // 默认直接回到 authority 首快照链；transport 错误只交给连接状态处理。
    if (
      (event.error.kind === "decode" || event.error.kind === "protocol") &&
      this.resyncPolicy.onDecodeError === "fail-and-refetch"
    ) {
      void this.resync().catch(() => undefined);
    }
  }

  private emitDocumentSnapshot(snapshot: DocumentSnapshot): void {
    const clonedSnapshot = cloneValue(snapshot);
    for (const listener of this.documentListeners) {
      listener(cloneValue(clonedSnapshot));
    }
  }

  private emitRuntimeFeedback(feedback: RuntimeFeedback): void {
    const clonedFeedback = cloneValue(feedback);
    for (const listener of this.feedbackListeners) {
      listener(cloneValue(clonedFeedback));
    }
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus === status) {
      return;
    }

    this.connectionStatus = status;
    for (const listener of this.connectionListeners) {
      listener(status);
    }
  }
}

/**
 * 创建 authority-first 的同步 session。
 *
 * @remarks
 * 当前实现固定采用“一次 session 对应一份逻辑文档”的边界。
 */
export function createSyncSession(
  options: CreateSyncSessionOptions
): SyncSession {
  return new SyncSessionImpl(options);
}
