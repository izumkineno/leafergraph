import type {
  GraphOperation,
  GraphOperationApplyResult
} from "@leafergraph/contracts";
import type { LeaferGraph } from "leafergraph";
import type { GraphDocument } from "@leafergraph/runtime-bridge/portable";
import type {
  RuntimeBridgeCatalogCommand,
  RuntimeBridgeCatalogCommandResult,
  RuntimeBridgeAuthorityExtensionManager
} from "@leafergraph/runtime-bridge";
import type {
  RuntimeBridgeCommand,
  RuntimeBridgeCommandResult,
  RuntimeBridgeControlCommand,
  RuntimeBridgeInboundEvent
} from "@leafergraph/runtime-bridge/transport";
import type {
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import { createRuntimeBridgeNodeDemoDocument } from "../shared/document";
import { DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID } from "../shared/catalog";
import {
  createRuntimeBridgeDemoContainer,
  ensureRuntimeBridgeDemoHeadlessDom
} from "./happy_dom";
import {
  DemoFileSystemArtifactStore
} from "./artifact_store";
import {
  DemoInMemoryCatalogStore,
  DemoInMemorySessionExtensionStore
} from "./extension_store";
import {
  createSeedCatalogEntries
} from "./seed_entries";
import {
  formatControlCommandBehavior,
  formatDocumentSummary,
  formatGraphOperationBehavior,
  formatGraphOperationResult,
  formatHistoryEventBehavior,
  formatInboundEventBehavior,
  formatRuntimeFeedbackBehavior,
  logRuntimeBridgeServer,
  logRuntimeBridgeServerError,
  setRuntimeBridgeNodeDemoLoggingMuted
} from "./logging";
import {
  RuntimeBridgeNodeDemoStreamHub,
  installRuntimeBridgeNodeDemoAuthorityStreamBridge
} from "./stream_hub";
import type { DemoStreamFrame } from "../shared/stream";

export interface RuntimeBridgeNodeAuthorityOptions {
  artifactStore?: DemoFileSystemArtifactStore;
  catalogStore?: DemoInMemoryCatalogStore;
  sessionStore?: DemoInMemorySessionExtensionStore;
  sessionId?: string;
  seedCatalog?: boolean;
}

/**
 * 单文档 Node authority。
 *
 * @remarks
 * 使用 headless `LeaferGraph` 作为唯一真源，
 * 并把 snapshot / operation / command / 扩展目录同步全部收口在这里。
 */
export class RuntimeBridgeNodeAuthority {
  private readonly graph: LeaferGraph;
  private readonly container: HTMLDivElement;
  private readonly listeners = new Set<(event: RuntimeBridgeInboundEvent) => void>();
  private readonly disposeRuntimeFeedback: () => void;
  private readonly disposeHistory: () => void;
  private readonly disposeExtensionsSync: () => void;
  private readonly extensionManager: RuntimeBridgeAuthorityExtensionManager;
  private readonly streamHub: RuntimeBridgeNodeDemoStreamHub;
  private diagnosticLogsMuted = false;
  readonly artifactStore: DemoFileSystemArtifactStore;

  private constructor(
    graph: LeaferGraph,
    container: HTMLDivElement,
    extensionManager: RuntimeBridgeAuthorityExtensionManager,
    artifactStore: DemoFileSystemArtifactStore,
    streamHub: RuntimeBridgeNodeDemoStreamHub
  ) {
    this.graph = graph;
    this.container = container;
    this.extensionManager = extensionManager;
    this.artifactStore = artifactStore;
    this.streamHub = streamHub;
    this.disposeRuntimeFeedback = this.graph.subscribeRuntimeFeedback(
      (feedback: RuntimeFeedbackEvent) => {
        if (this.diagnosticLogsMuted) {
          return;
        }

        logRuntimeBridgeServer(
          "authority",
          "runtime.feedback",
          formatRuntimeFeedbackBehavior(feedback)
        );
        this.emit({
          type: "runtime.feedback",
          feedback
        });
      }
    );
    this.disposeHistory = this.graph.subscribeHistory((event: LeaferGraphHistoryEvent) => {
      if (this.diagnosticLogsMuted) {
        return;
      }

      logRuntimeBridgeServer(
        "authority",
        "history.event",
        formatHistoryEventBehavior(event)
      );
      this.emit({
        type: "history.event",
        event
      });
    });
    this.disposeExtensionsSync = this.extensionManager.subscribeSync((sync) => {
      this.applyStressLoggingMode(sync.currentBlueprintId);
      logRuntimeBridgeServer(
        "authority",
        "extensions.sync",
        `entries=${sync.entries.length} activeNodes=${sync.activeNodeEntryIds.length} activeComponents=${sync.activeComponentEntryIds.length} blueprint=${sync.currentBlueprintId ?? "none"}`
      );
      this.emit({
        type: "extensions.sync",
        sync
      });
    });
  }

  /**
   * 创建 authority 实例。
   *
   * @param options - authority 选项。
   * @returns 初始化完成后的 authority。
   */
  static async create(
    options: RuntimeBridgeNodeAuthorityOptions = {}
  ): Promise<RuntimeBridgeNodeAuthority> {
    setRuntimeBridgeNodeDemoLoggingMuted(false);
    ensureRuntimeBridgeDemoHeadlessDom();
    const [{ createLeaferGraph, RuntimeBridgeAuthorityExtensionManager }, { leaferGraphBasicKitPlugin }] = await Promise.all([
      import("@leafergraph/runtime-bridge"),
      import("@leafergraph/basic-kit")
    ]);
    const artifactStore = options.artifactStore ?? new DemoFileSystemArtifactStore();
    const catalogStore = options.catalogStore ?? new DemoInMemoryCatalogStore();
    const sessionStore =
      options.sessionStore ?? new DemoInMemorySessionExtensionStore();
    const streamHub = new RuntimeBridgeNodeDemoStreamHub();
    installRuntimeBridgeNodeDemoAuthorityStreamBridge(streamHub);
    const container = createRuntimeBridgeDemoContainer();
    const graph = createLeaferGraph(container, {
      document: createRuntimeBridgeNodeDemoDocument(),
      plugins: [leaferGraphBasicKitPlugin],
      themeMode: "light"
    });

    await graph.ready;

    const extensionManager = new RuntimeBridgeAuthorityExtensionManager({
      graph,
      artifactReader: artifactStore,
      catalogStore,
      sessionStore,
      sessionId: options.sessionId ?? "default-session"
    });

    if (options.seedCatalog !== false) {
      const seedEntries = await createSeedCatalogEntries(artifactStore);
      for (const entry of seedEntries) {
        await extensionManager.executeCommand({
          type: "entry.register",
          entry
        });
      }
    }

    logRuntimeBridgeServer(
      "authority",
      "ready",
      formatDocumentSummary(graph.getGraphDocument())
    );
    return new RuntimeBridgeNodeAuthority(
      graph,
      container,
      extensionManager,
      artifactStore,
      streamHub
    );
  }

  /**
   * 读取当前 authority 文档快照。
   *
   * @returns 当前正式文档。
   */
  requestSnapshot(): GraphDocument {
    const snapshot = structuredClone(this.graph.getGraphDocument());
    logRuntimeBridgeServer(
      "authority",
      "snapshot.request",
      formatDocumentSummary(snapshot)
    );
    return snapshot;
  }

  /**
   * 顺序提交一批正式图操作。
   *
   * @param operations - 待提交的操作数组。
   * @returns 每条操作的应用结果。
   */
  submitOperations(
    operations: readonly GraphOperation[]
  ): readonly GraphOperationApplyResult[] {
    const beforeDocument = this.graph.getGraphDocument();
    const results: GraphOperationApplyResult[] = [];
    const changedOperations: GraphOperation[] = [];

    logRuntimeBridgeServer(
      "authority",
      "operations.submit",
      `count=${operations.length} revision=${String(beforeDocument.revision)}`
    );

    for (const [index, operation] of operations.entries()) {
      logRuntimeBridgeServer(
        "authority",
        `operation[${index}]`,
        formatGraphOperationBehavior(operation)
      );
      const result = this.graph.applyGraphOperation(structuredClone(operation));
      results.push(result);
      logRuntimeBridgeServer(
        "authority",
        `result[${index}]`,
        formatGraphOperationResult(result)
      );

      if (result.accepted && result.changed) {
        changedOperations.push(structuredClone(result.operation));
      }
    }

    if (changedOperations.length > 0) {
      const afterDocument = this.graph.getGraphDocument();
      logRuntimeBridgeServer(
        "authority",
        "operations.changed",
        `${String(beforeDocument.revision)} -> ${String(afterDocument.revision)} changed=${changedOperations.length}`
      );
      this.emit({
        type: "document.diff",
        diff: {
          documentId: afterDocument.documentId,
          baseRevision: beforeDocument.revision,
          revision: afterDocument.revision,
          emittedAt: Date.now(),
          operations: changedOperations,
          fieldChanges: []
        }
      });
    } else {
      logRuntimeBridgeServer(
        "authority",
        "operations.no-change",
        "本批操作没有形成有效文档变更"
      );
    }

    return results;
  }

  /**
   * 处理一条正式 bridge command。
   *
   * @param command - 待执行命令。
   * @returns 命令结果。
   */
  async requestCommand(
    command: RuntimeBridgeCommand
  ): Promise<RuntimeBridgeCommandResult> {
    if (isControlCommand(command)) {
      this.sendControl(command);
      return { type: "control.ok" };
    }

    const result = await this.extensionManager.executeCommand(
      command as RuntimeBridgeCatalogCommand
    );
    logRuntimeBridgeServer(
      "authority",
      "command.applied",
      formatCatalogCommandResultBehavior(result)
    );

    if (result.type === "blueprint.load.result" || result.type === "blueprint.unload.result") {
      this.streamHub.clear();
      this.emit({
        type: "document.snapshot",
        document: structuredClone(result.document)
      });
    }

    return result;
  }

  /**
   * 分发一条控制命令到 authority 图实例。
   *
   * @param command - 控制命令。
   * @returns 无返回值。
   */
  sendControl(command: RuntimeBridgeControlCommand): void {
    let handled = false;

    logRuntimeBridgeServer(
      "authority",
      "control.receive",
      formatControlCommandBehavior(command)
    );

    switch (command.type) {
      case "play":
        handled = this.graph.play();
        break;
      case "step":
        handled = this.graph.step();
        break;
      case "stop":
        handled = this.graph.stop();
        break;
      case "play-from-node":
        handled = this.graph.playFromNode(command.nodeId);
        break;
      default:
        handled = false;
        break;
    }

    if (!handled) {
      logRuntimeBridgeServerError(
        "authority",
        "control.rejected",
        formatControlCommandBehavior(command)
      );
      throw new Error(`Authority rejected control command: ${command.type}`);
    }

    logRuntimeBridgeServer(
      "authority",
      "control.applied",
      formatControlCommandBehavior(command)
    );
  }

  /**
   * 订阅 authority 发出的 bridge 事件。
   *
   * @param listener - 事件监听器。
   * @returns 取消订阅函数。
   */
  subscribe(listener: (event: RuntimeBridgeInboundEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 订阅 authority 发出的高频流帧。
   *
   * @param listener - 帧监听器。
   * @returns 取消订阅函数。
   */
  subscribeStream(listener: (frame: DemoStreamFrame) => void): () => void {
    return this.streamHub.subscribe(listener);
  }

  /**
   * 列出当前 authority 已缓存的最新流帧。
   *
   * @returns latest frame 列表。
   */
  getLatestStreamFrames(): DemoStreamFrame[] {
    return this.streamHub.listLatestFrames();
  }

  /**
   * 销毁 authority。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    logRuntimeBridgeServer("authority", "destroy");
    this.disposeRuntimeFeedback();
    this.disposeHistory();
    this.disposeExtensionsSync();
    this.applyStressLoggingMode(null);
    this.listeners.clear();
    this.streamHub.clear();
    this.graph.destroy();
    this.container.remove();
  }

  private applyStressLoggingMode(currentBlueprintId: string | null): void {
    const shouldMute =
      currentBlueprintId === DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID;
    this.diagnosticLogsMuted = shouldMute;
    setRuntimeBridgeNodeDemoLoggingMuted(shouldMute);
  }

  private emit(event: RuntimeBridgeInboundEvent): void {
    logRuntimeBridgeServer(
      "authority",
      "emit",
      formatInboundEventBehavior(event)
    );
    const snapshot = cloneBridgeEventForDelivery(event);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function cloneBridgeEventForDelivery(
  event: RuntimeBridgeInboundEvent
): RuntimeBridgeInboundEvent {
  try {
    return structuredClone(event);
  } catch {
    const seen = new WeakSet<object>();
    return JSON.parse(
      JSON.stringify(event, (_key, value) => {
        if (typeof value === "function") {
          return `[Function ${value.name || "anonymous"}]`;
        }

        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }

        return value;
      })
    ) as RuntimeBridgeInboundEvent;
  }
}

function isControlCommand(command: RuntimeBridgeCommand): command is RuntimeBridgeControlCommand {
  return (
    command.type === "play" ||
    command.type === "step" ||
    command.type === "stop" ||
    command.type === "play-from-node"
  );
}

function formatCatalogCommandResultBehavior(
  result: RuntimeBridgeCatalogCommandResult
): string {
  switch (result.type) {
    case "catalog.list.result":
      return `catalog.list entries=${result.sync.entries.length}`;
    case "entry.register.result":
      return `entry.register entry=${result.entry.entryId}`;
    case "entry.load.result":
      return `entry.load activeNodes=${result.sync.activeNodeEntryIds.length} activeComponents=${result.sync.activeComponentEntryIds.length}`;
    case "entry.unload.result":
      return `entry.unload activeNodes=${result.sync.activeNodeEntryIds.length} activeComponents=${result.sync.activeComponentEntryIds.length}`;
    case "entry.unregister.result":
      return `entry.unregister entries=${result.sync.entries.length}`;
    case "blueprint.load.result":
      return `blueprint.load blueprint=${result.sync.currentBlueprintId ?? "none"} ${formatDocumentSummary(result.document)}`;
    case "blueprint.unload.result":
      return `blueprint.unload ${formatDocumentSummary(result.document)}`;
  }
}
