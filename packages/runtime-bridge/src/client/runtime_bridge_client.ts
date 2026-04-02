import type { GraphDocument } from "@leafergraph/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent
} from "@leafergraph/contracts";
import type {
  ApplyGraphDocumentDiffResult,
  GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import { applyGraphDocumentDiffToDocument } from "@leafergraph/contracts/graph-document-diff";
import type { LeaferGraph } from "leafergraph";
import type {
  LeaferGraphRuntimeBridgeTransport,
  RuntimeBridgeControlCommand,
  RuntimeBridgeInboundEvent
} from "../transport/index.js";

export type LeaferGraphRuntimeBridgeClientGraphLike = Pick<
  LeaferGraph,
  | "applyGraphDocumentDiff"
  | "getGraphDocument"
  | "projectRuntimeFeedback"
  | "replaceGraphDocument"
>;

export interface LeaferGraphRuntimeBridgeClientOptions {
  graph: LeaferGraphRuntimeBridgeClientGraphLike;
  transport: LeaferGraphRuntimeBridgeTransport;
}

/**
 * 浏览器侧 runtime bridge 控制器。
 *
 * @remarks
 * 负责把 transport 收到的 snapshot / diff / feedback / history
 * 映射到 `LeaferGraph` 实例，但不接管交互上传时机。
 */
export class LeaferGraphRuntimeBridgeClient {
  private readonly graph: LeaferGraphRuntimeBridgeClientGraphLike;
  private readonly transport: LeaferGraphRuntimeBridgeTransport;
  private readonly historyListeners = new Set<
    (event: LeaferGraphHistoryEvent) => void
  >();
  private transportUnsubscribe: (() => void) | null = null;
  private inboundQueue: Promise<void> = Promise.resolve();
  private connected = false;

  constructor(options: LeaferGraphRuntimeBridgeClientOptions) {
    this.graph = options.graph;
    this.transport = options.transport;
  }

  /**
   * 建立 transport 连接，并先用 snapshot 恢复当前图。
   *
   * @returns 当前连接过程的异步结果。
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.transport.connect?.();
    const bootstrapSnapshot = this.requestSnapshot();
    this.inboundQueue = bootstrapSnapshot.then(() => undefined);
    this.transportUnsubscribe = this.transport.subscribe((event) => {
      this.inboundQueue = this.inboundQueue
        .catch(() => undefined)
        .then(() => this.handleInboundEvent(event));
    });

    try {
      await bootstrapSnapshot;
      this.connected = true;
    } catch (error) {
      this.transportUnsubscribe?.();
      this.transportUnsubscribe = null;
      await this.transport.disconnect?.();
      throw error;
    }
  }

  /**
   * 断开当前 transport 连接。
   *
   * @returns 当前断开流程的异步结果。
   */
  async disconnect(): Promise<void> {
    const unsubscribe = this.transportUnsubscribe;
    this.transportUnsubscribe = null;
    unsubscribe?.();
    this.connected = false;
    await this.transport.disconnect?.();
  }

  /**
   * 当前是否已建立 transport 订阅。
   *
   * @returns 当前连接状态。
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 主动请求一次整图 snapshot 并替换当前图。
   *
   * @returns 最新正式图文档。
   */
  async requestSnapshot(): Promise<GraphDocument> {
    const snapshot = await this.transport.requestSnapshot();
    this.graph.replaceGraphDocument(snapshot);
    return snapshot;
  }

  /**
   * 订阅 bridge 层转发的 history event。
   *
   * @param listener - 监听器。
   * @returns 取消订阅函数。
   */
  subscribeHistory(
    listener: (event: LeaferGraphHistoryEvent) => void
  ): () => void {
    this.historyListeners.add(listener);
    return () => {
      this.historyListeners.delete(listener);
    };
  }

  /**
   * 提交单条正式图操作。
   *
   * @param operation - 待提交操作。
   * @returns transport 返回的应用结果。
   */
  async submitOperation(
    operation: GraphOperation
  ): Promise<GraphOperationApplyResult | undefined> {
    const [result] = await this.submitOperations([operation]);
    return result;
  }

  /**
   * 提交多条正式图操作。
   *
   * @param operations - 待提交操作集合。
   * @returns transport 返回的应用结果列表。
   */
  async submitOperations(
    operations: readonly GraphOperation[]
  ): Promise<readonly GraphOperationApplyResult[]> {
    return this.transport.submitOperations(operations);
  }

  /**
   * 发送一条底层 control command。
   *
   * @param command - 控制命令。
   * @returns 无返回值。
   */
  async sendControl(command: RuntimeBridgeControlCommand): Promise<void> {
    await this.transport.sendControl(command);
  }

  /**
   * 启动整图执行。
   *
   * @returns 无返回值。
   */
  async play(): Promise<void> {
    await this.sendControl({ type: "play" });
  }

  /**
   * 单步推进一次执行。
   *
   * @returns 无返回值。
   */
  async step(): Promise<void> {
    await this.sendControl({ type: "step" });
  }

  /**
   * 停止当前执行。
   *
   * @returns 无返回值。
   */
  async stop(): Promise<void> {
    await this.sendControl({ type: "stop" });
  }

  /**
   * 从指定节点开始执行。
   *
   * @param nodeId - 节点 ID。
   * @returns 无返回值。
   */
  async playFromNode(nodeId: string): Promise<void> {
    await this.sendControl({ type: "play-from-node", nodeId });
  }

  private async handleInboundEvent(event: RuntimeBridgeInboundEvent): Promise<void> {
    switch (event.type) {
      case "document.snapshot":
        this.graph.replaceGraphDocument(event.document);
        return;
      case "document.diff":
        await this.handleDocumentDiff(event.diff);
        return;
      case "runtime.feedback":
        this.graph.projectRuntimeFeedback(event.feedback);
        return;
      case "history.event":
        this.emitHistoryEvent(event.event);
        return;
      default:
        return;
    }
  }

  private async handleDocumentDiff(diff: GraphDocumentDiff): Promise<void> {
    const currentDocument = this.graph.getGraphDocument();
    const mergedResult = applyGraphDocumentDiffToDocument(currentDocument, diff);

    if (!mergedResult.success || mergedResult.requiresFullReplace) {
      await this.requestSnapshot();
      return;
    }

    const projectionResult = this.graph.applyGraphDocumentDiff(
      diff,
      mergedResult.document
    );
    if (requiresSnapshotFallback(projectionResult)) {
      await this.requestSnapshot();
    }
  }

  private emitHistoryEvent(event: LeaferGraphHistoryEvent): void {
    for (const listener of this.historyListeners) {
      listener(event);
    }
  }
}

function requiresSnapshotFallback(result: ApplyGraphDocumentDiffResult): boolean {
  return !result.success || result.requiresFullReplace;
}
