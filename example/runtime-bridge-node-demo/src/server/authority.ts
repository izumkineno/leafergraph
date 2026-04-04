import type {
  GraphOperation,
  GraphOperationApplyResult
} from "@leafergraph/contracts";
import {
  applyGraphDocumentDiffToDocument,
  type GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import { DiffEngine } from "@leafergraph/diff";
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
  RuntimeBridgeDiffMode,
  RuntimeBridgeInboundEvent
} from "@leafergraph/runtime-bridge/transport";
import type {
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import { createRuntimeBridgeNodeDemoDocument } from "../shared/document";
import {
  DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID,
  DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID
} from "../shared/catalog";
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
  diffMode?: RuntimeBridgeDiffMode;
}

type DiffComputationStrategy = "fast-path" | "partial" | "full";

interface DiffComputationScope {
  nodeIds: Set<string>;
  linkIds: Set<string>;
}

interface DiffComputationPlan {
  strategy: DiffComputationStrategy;
  diff: GraphDocumentDiff;
  scope: DiffComputationScope | null;
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
  private readonly diffEngine = new DiffEngine();
  private diffMode: RuntimeBridgeDiffMode;
  private diagnosticLogsMuted = false;
  readonly artifactStore: DemoFileSystemArtifactStore;

  private constructor(
    graph: LeaferGraph,
    container: HTMLDivElement,
    extensionManager: RuntimeBridgeAuthorityExtensionManager,
    artifactStore: DemoFileSystemArtifactStore,
    streamHub: RuntimeBridgeNodeDemoStreamHub,
    diffMode: RuntimeBridgeDiffMode
  ) {
    this.graph = graph;
    this.container = container;
    this.extensionManager = extensionManager;
    this.artifactStore = artifactStore;
    this.streamHub = streamHub;
    this.diffMode = diffMode;
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
      streamHub,
      options.diffMode ?? "diff"
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
    let changedCount = 0;
    const changedOperations: GraphOperation[] = [];
    const affectedNodeIds = new Set<string>();
    const affectedLinkIds = new Set<string>();

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
        changedCount += 1;
        changedOperations.push(structuredClone(result.operation));
        for (const nodeId of result.affectedNodeIds) {
          affectedNodeIds.add(nodeId);
        }
        for (const linkId of result.affectedLinkIds) {
          affectedLinkIds.add(linkId);
        }
      }
    }

    if (changedCount > 0) {
      const afterDocument = this.graph.getGraphDocument();
      logRuntimeBridgeServer(
        "authority",
        "operations.changed",
        `${String(beforeDocument.revision)} -> ${String(afterDocument.revision)} changed=${changedCount}`
      );

      if (this.diffMode === "legacy") {
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
        return results;
      }

      const diffPlan = computeAuthorityDiffPlan({
        diffEngine: this.diffEngine,
        beforeDocument,
        afterDocument,
        changedOperations,
        affectedNodeIds,
        affectedLinkIds
      });
      const normalizedDiff = normalizeAuthorityDocumentDiff(diffPlan.diff);
      logRuntimeBridgeServer(
        "authority",
        "document.diff.plan",
        `strategy=${diffPlan.strategy} ops=${normalizedDiff.operations.length} fieldChanges=${normalizedDiff.fieldChanges.length}`
      );
      const replayResult = applyGraphDocumentDiffToDocument(
        beforeDocument,
        normalizedDiff
      );
      const replayDriftDiff =
        replayResult.success && !replayResult.requiresFullReplace
          ? computeReplayDriftDiff(
              this.diffEngine,
              replayResult.document,
              afterDocument,
              diffPlan.scope
            )
          : null;
      const replayMatchesTarget =
        replayDriftDiff !== null && isGraphDocumentDiffEmpty(replayDriftDiff);

      if (!replayMatchesTarget) {
        const replayReason =
          replayResult.reason ??
          (replayDriftDiff
            ? `replay drift operations=${replayDriftDiff.operations.length} fieldChanges=${replayDriftDiff.fieldChanges.length}`
            : "replay result mismatch");
        logRuntimeBridgeServerError(
          "authority",
          "document.diff.validation-failed",
          replayReason
        );
        this.emit({
          type: "document.snapshot",
          document: structuredClone(afterDocument)
        });
        throw new Error(`authority.diff.validation.failed: ${replayReason}`);
      }

      if (
        normalizedDiff.operations.length > 0 ||
        normalizedDiff.fieldChanges.length > 0
      ) {
        this.emit({
          type: "document.diff",
          diff: normalizedDiff
        });
      } else {
        logRuntimeBridgeServer(
          "authority",
          "document.diff.empty",
          "Diff 引擎未产出增量，跳过 document.diff 广播"
        );
      }
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

    if (isDiffModeCommand(command)) {
      if (command.type === "diff.mode.set") {
        this.diffMode = command.mode;
        logRuntimeBridgeServer(
          "authority",
          "diff.mode.set",
          `mode=${this.diffMode}`
        );
      } else {
        logRuntimeBridgeServer(
          "authority",
          "diff.mode.get",
          `mode=${this.diffMode}`
        );
      }

      return {
        type: "diff.mode.result",
        mode: this.diffMode
      };
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
      currentBlueprintId === DEMO_FREQUENCY_STRESS_BLUEPRINT_ENTRY_ID ||
      currentBlueprintId === DEMO_FREQUENCY_EXTREME_BLUEPRINT_ENTRY_ID;
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

function normalizeAuthorityDocumentDiff(diff: GraphDocumentDiff): GraphDocumentDiff {
  const emittedAt = Number.isFinite(diff.emittedAt) ? diff.emittedAt : Date.now();
  const operationIdPrefix = `authority.diff:${String(diff.baseRevision)}:${String(diff.revision)}`;
  return {
    ...diff,
    emittedAt,
    operations: diff.operations.map((operation, index) => ({
      ...structuredClone(operation),
      source: "authority.documentDiff",
      timestamp: emittedAt,
      operationId: `${operationIdPrefix}:${index}`
    })),
    fieldChanges: structuredClone(diff.fieldChanges)
  };
}

function isGraphDocumentDiffEmpty(diff: GraphDocumentDiff): boolean {
  return diff.operations.length === 0 && diff.fieldChanges.length === 0;
}

function computeAuthorityDiffPlan(params: {
  diffEngine: DiffEngine;
  beforeDocument: GraphDocument;
  afterDocument: GraphDocument;
  changedOperations: readonly GraphOperation[];
  affectedNodeIds: ReadonlySet<string>;
  affectedLinkIds: ReadonlySet<string>;
}): DiffComputationPlan {
  const fastPathOperations = buildFastPathOperations(params.changedOperations);
  if (fastPathOperations) {
    return {
      strategy: "fast-path",
      diff: createDiffFromOperations(
        params.beforeDocument,
        params.afterDocument,
        fastPathOperations
      ),
      scope: createDiffComputationScope(
        params.affectedNodeIds,
        params.affectedLinkIds
      )
    };
  }

  const scope = createDiffComputationScope(
    params.affectedNodeIds,
    params.affectedLinkIds
  );
  if (
    scope &&
    canUseScopedDiffComputation(params.changedOperations, scope)
  ) {
    const scopedBeforeDocument = createScopedDocumentForDiff(
      params.beforeDocument,
      scope
    );
    const scopedAfterDocument = createScopedDocumentForDiff(
      params.afterDocument,
      scope
    );
    return {
      strategy: "partial",
      diff: params.diffEngine.computeDiff(scopedBeforeDocument, scopedAfterDocument),
      scope
    };
  }

  return {
    strategy: "full",
    diff: params.diffEngine.computeDiff(
      params.beforeDocument,
      params.afterDocument
    ),
    scope: null
  };
}

function createDiffFromOperations(
  beforeDocument: GraphDocument,
  afterDocument: GraphDocument,
  operations: readonly GraphOperation[]
): GraphDocumentDiff {
  return {
    documentId: afterDocument.documentId,
    baseRevision: beforeDocument.revision,
    revision: afterDocument.revision,
    emittedAt: Date.now(),
    operations: operations.map((operation) => structuredClone(operation)),
    fieldChanges: []
  };
}

function buildFastPathOperations(
  operations: readonly GraphOperation[]
): GraphOperation[] | null {
  if (!operations.length) {
    return null;
  }
  if (!operations.every(isFastPathOperation)) {
    return null;
  }

  const mergedOperations = new Map<string, GraphOperation>();
  for (const operation of operations) {
    mergedOperations.set(getFastPathOperationKey(operation), structuredClone(operation));
  }
  return [...mergedOperations.values()];
}

function isFastPathOperation(operation: GraphOperation): boolean {
  return (
    operation.type === "node.move" ||
    operation.type === "node.resize" ||
    operation.type === "node.collapse" ||
    operation.type === "node.widget.value.set"
  );
}

function getFastPathOperationKey(operation: GraphOperation): string {
  switch (operation.type) {
    case "node.move":
    case "node.resize":
    case "node.collapse":
      return `${operation.type}:${operation.nodeId}`;
    case "node.widget.value.set":
      return `${operation.type}:${operation.nodeId}:${String(operation.widgetIndex)}`;
    default:
      return `${operation.type}:${operation.operationId}`;
  }
}

function createDiffComputationScope(
  affectedNodeIds: ReadonlySet<string>,
  affectedLinkIds: ReadonlySet<string>
): DiffComputationScope | null {
  if (affectedNodeIds.size === 0 && affectedLinkIds.size === 0) {
    return null;
  }
  return {
    nodeIds: new Set(affectedNodeIds),
    linkIds: new Set(affectedLinkIds)
  };
}

function canUseScopedDiffComputation(
  operations: readonly GraphOperation[],
  scope: DiffComputationScope
): boolean {
  if (scope.nodeIds.size === 0 && scope.linkIds.size === 0) {
    return false;
  }
  return !operations.some((operation) => operation.type === "document.update");
}

function createScopedDocumentForDiff(
  document: GraphDocument,
  scope: DiffComputationScope
): GraphDocument {
  const scopedLinks = document.links.filter(
    (link) =>
      scope.linkIds.has(link.id) ||
      scope.nodeIds.has(link.source.nodeId) ||
      scope.nodeIds.has(link.target.nodeId)
  );
  const scopedNodeIds = new Set(scope.nodeIds);
  for (const link of scopedLinks) {
    scopedNodeIds.add(link.source.nodeId);
    scopedNodeIds.add(link.target.nodeId);
  }
  const scopedNodes = document.nodes.filter((node) => scopedNodeIds.has(node.id));

  return {
    ...document,
    nodes: structuredClone(scopedNodes),
    links: structuredClone(scopedLinks)
  };
}

function computeReplayDriftDiff(
  diffEngine: DiffEngine,
  replayedDocument: GraphDocument,
  afterDocument: GraphDocument,
  scope: DiffComputationScope | null
): GraphDocumentDiff {
  if (!scope) {
    return diffEngine.computeDiff(replayedDocument, afterDocument);
  }
  const replayScopedDocument = createScopedDocumentForDiff(replayedDocument, scope);
  const afterScopedDocument = createScopedDocumentForDiff(afterDocument, scope);
  return diffEngine.computeDiff(replayScopedDocument, afterScopedDocument);
}

function isControlCommand(command: RuntimeBridgeCommand): command is RuntimeBridgeControlCommand {
  return (
    command.type === "play" ||
    command.type === "step" ||
    command.type === "stop" ||
    command.type === "play-from-node"
  );
}

function isDiffModeCommand(
  command: RuntimeBridgeCommand
): command is
  | {
      type: "diff.mode.get";
    }
  | {
      type: "diff.mode.set";
      mode: RuntimeBridgeDiffMode;
    } {
  return command.type === "diff.mode.get" || command.type === "diff.mode.set";
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
