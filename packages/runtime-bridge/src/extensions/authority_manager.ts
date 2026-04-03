import type { GraphDocument, NodeDefinition, NodeModule } from "@leafergraph/node";
import type { LeaferGraphWidgetEntry } from "@leafergraph/contracts";
import type { LeaferGraph } from "leafergraph";
import type { RuntimeBridgeArtifactReader } from "./artifact.js";
import {
  importModuleNamespaceFromArtifact,
  readGraphDocumentFromArtifact,
  resolveNodeModuleExport
} from "./loader.js";
import type {
  RuntimeBridgeCatalogCommand,
  RuntimeBridgeCatalogCommandResult,
  RuntimeBridgeCatalogEntry,
  RuntimeBridgeCatalogStore,
  RuntimeBridgeComponentCatalogEntry,
  RuntimeBridgeExtensionsSync,
  RuntimeBridgeNodeCatalogEntry,
  RuntimeBridgeSessionExtensionState,
  RuntimeBridgeSessionExtensionStore
} from "./types.js";

/** authority manager 依赖的最小图壳面。 */
export type RuntimeBridgeAuthorityExtensionGraphLike = Pick<
  LeaferGraph,
  | "getGraphDocument"
  | "installModule"
  | "listNodes"
  | "listWidgets"
  | "registerNode"
  | "registerWidget"
  | "replaceGraphDocument"
  | "unregisterNode"
  | "unregisterWidget"
>;

export interface RuntimeBridgeAuthorityExtensionManagerOptions {
  graph: RuntimeBridgeAuthorityExtensionGraphLike;
  artifactReader: RuntimeBridgeArtifactReader;
  catalogStore: RuntimeBridgeCatalogStore;
  sessionStore: RuntimeBridgeSessionExtensionStore;
  sessionId: string;
}

/**
 * authority 侧扩展目录 manager。
 *
 * @remarks
 * 它维护目录 metadata、会话激活状态与 blueprint 替换流程，
 * 但不接管底层 transport。
 */
export class RuntimeBridgeAuthorityExtensionManager {
  private readonly graph: RuntimeBridgeAuthorityExtensionGraphLike;
  private readonly artifactReader: RuntimeBridgeArtifactReader;
  private readonly catalogStore: RuntimeBridgeCatalogStore;
  private readonly sessionStore: RuntimeBridgeSessionExtensionStore;
  private readonly sessionId: string;
  private readonly syncListeners = new Set<
    (sync: RuntimeBridgeExtensionsSync) => void
  >();
  private readonly loadedNodeEntryIds = new Set<string>();
  private readonly loadedComponentEntryIds = new Set<string>();
  private readonly loadedComponentWidgetTypesByEntryId = new Map<string, string[]>();

  constructor(options: RuntimeBridgeAuthorityExtensionManagerOptions) {
    this.graph = options.graph;
    this.artifactReader = options.artifactReader;
    this.catalogStore = options.catalogStore;
    this.sessionStore = options.sessionStore;
    this.sessionId = options.sessionId;
  }

  /**
   * 订阅扩展同步快照。
   *
   * @param listener - 监听器。
   * @returns 取消订阅函数。
   */
  subscribeSync(listener: (sync: RuntimeBridgeExtensionsSync) => void): () => void {
    this.syncListeners.add(listener);
    void this.getSyncState().then((sync) => listener(sync));
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * 读取当前同步快照。
   *
   * @returns 最新快照。
   */
  async getSyncState(): Promise<RuntimeBridgeExtensionsSync> {
    const [entries, sessionState] = await Promise.all([
      this.catalogStore.listEntries(),
      this.getSessionState()
    ]);

    return {
      entries: entries.map((entry) => structuredClone(entry)),
      activeNodeEntryIds: [...sessionState.activeNodeEntryIds],
      activeComponentEntryIds: [...sessionState.activeComponentEntryIds],
      currentBlueprintId: sessionState.currentBlueprintId,
      emittedAt: Date.now()
    };
  }

  /**
   * 处理一条目录命令。
   *
   * @param command - 目录命令。
   * @returns 对应结果。
   */
  async executeCommand(
    command: RuntimeBridgeCatalogCommand
  ): Promise<RuntimeBridgeCatalogCommandResult> {
    switch (command.type) {
      case "catalog.list":
        return {
          type: "catalog.list.result",
          sync: await this.getSyncState()
        };
      case "entry.register":
        return this.registerEntry(command.entry);
      case "entry.load":
        return this.loadEntry(command.entryId);
      case "entry.unload":
        return this.unloadEntry(command.entryId);
      case "entry.unregister":
        return this.unregisterEntry(command.entryId);
      case "blueprint.load":
        return this.loadBlueprint(command.entryId);
      case "blueprint.unload":
        return this.unloadBlueprint();
      default:
        throw new Error(`Unsupported catalog command: ${String(command)}`);
    }
  }

  private async registerEntry(
    entry: RuntimeBridgeCatalogEntry
  ): Promise<RuntimeBridgeCatalogCommandResult> {
    validateEntryId(entry.entryId);
    const currentEntry = await this.catalogStore.getEntry(entry.entryId);
    if (currentEntry) {
      throw new Error(`目录条目已存在: ${entry.entryId}`);
    }

    await this.validateCatalogEntry(entry);
    await this.catalogStore.putEntry(structuredClone(entry));
    return {
      type: "entry.register.result",
      entry: structuredClone(entry),
      sync: await this.emitSync()
    };
  }

  private async loadEntry(entryId: string): Promise<RuntimeBridgeCatalogCommandResult> {
    const entry = await this.requireEntry(entryId);
    const sessionState = await this.getSessionState();

    if (entry.entryKind === "component-entry") {
      await this.activateComponentEntry(entry, sessionState);
      await this.sessionStore.setSessionState(this.sessionId, sessionState);
      return {
        type: "entry.load.result",
        sync: await this.emitSync()
      };
    }

    if (entry.entryKind === "node-entry") {
      for (const componentEntryId of entry.componentEntryIds) {
        const componentEntry = await this.requireEntry(componentEntryId);
        if (componentEntry.entryKind !== "component-entry") {
          throw new Error(
            `节点条目 ${entryId} 依赖了非组件条目: ${componentEntryId}`
          );
        }

        await this.activateComponentEntry(componentEntry, sessionState);
      }

      if (!this.loadedNodeEntryIds.has(entryId)) {
        await this.installNodeEntry(entry);
      }

      sessionState.activeNodeEntryIds = addUnique(
        sessionState.activeNodeEntryIds,
        entryId
      );
      await this.sessionStore.setSessionState(this.sessionId, sessionState);
      return {
        type: "entry.load.result",
        sync: await this.emitSync()
      };
    }

    throw new Error(`blueprint 条目不能通过 entry.load 激活: ${entryId}`);
  }

  private async unloadEntry(
    entryId: string
  ): Promise<RuntimeBridgeCatalogCommandResult> {
    const entry = await this.requireEntry(entryId);
    const sessionState = await this.getSessionState();

    if (entry.entryKind === "component-entry") {
      await this.ensureComponentEntryCanUnload(entry, sessionState);
      this.uninstallComponentEntry(entry);
      sessionState.activeComponentEntryIds = sessionState.activeComponentEntryIds.filter(
        (id) => id !== entryId
      );
      await this.sessionStore.setSessionState(this.sessionId, sessionState);
      return {
        type: "entry.unload.result",
        sync: await this.emitSync()
      };
    }

    if (entry.entryKind === "node-entry") {
      this.ensureNodeEntryCanUnload(entry);
      for (const nodeType of entry.nodeTypes) {
        this.graph.unregisterNode(nodeType);
      }
      this.loadedNodeEntryIds.delete(entryId);
      sessionState.activeNodeEntryIds = sessionState.activeNodeEntryIds.filter(
        (id) => id !== entryId
      );
      await this.sessionStore.setSessionState(this.sessionId, sessionState);
      return {
        type: "entry.unload.result",
        sync: await this.emitSync()
      };
    }

    throw new Error(`blueprint 条目不能通过 entry.unload 卸载: ${entryId}`);
  }

  private async unregisterEntry(
    entryId: string
  ): Promise<RuntimeBridgeCatalogCommandResult> {
    const entry = await this.requireEntry(entryId);
    const sessionState = await this.getSessionState();

    if (entry.entryKind === "blueprint-entry") {
      if (sessionState.currentBlueprintId === entryId) {
        throw new Error(`当前蓝图仍在使用中，不能注销: ${entryId}`);
      }
    } else if (entry.entryKind === "component-entry") {
      await this.ensureComponentEntryCanUnload(entry, sessionState);
      if (sessionState.activeComponentEntryIds.includes(entryId)) {
        throw new Error(`组件条目仍处于激活状态，不能注销: ${entryId}`);
      }
    } else {
      this.ensureNodeEntryCanUnload(entry);
      if (sessionState.activeNodeEntryIds.includes(entryId)) {
        throw new Error(`节点条目仍处于激活状态，不能注销: ${entryId}`);
      }
    }

    await this.catalogStore.deleteEntry(entryId);
    return {
      type: "entry.unregister.result",
      sync: await this.emitSync()
    };
  }

  private async loadBlueprint(
    entryId: string
  ): Promise<RuntimeBridgeCatalogCommandResult> {
    const entry = await this.requireEntry(entryId);
    if (entry.entryKind !== "blueprint-entry") {
      throw new Error(`条目不是 blueprint-entry: ${entryId}`);
    }

    for (const componentEntryId of entry.componentEntryIds) {
      await this.loadEntry(componentEntryId);
    }

    for (const nodeEntryId of entry.nodeEntryIds) {
      await this.loadEntry(nodeEntryId);
    }

    const artifact = await this.artifactReader.readArtifact(entry.documentArtifactRef);
    const document = await readGraphDocumentFromArtifact(artifact);
    this.graph.replaceGraphDocument(structuredClone(document));

    const sessionState = await this.getSessionState();
    sessionState.currentBlueprintId = entry.entryId;
    await this.sessionStore.setSessionState(this.sessionId, sessionState);

    return {
      type: "blueprint.load.result",
      document: structuredClone(document),
      sync: await this.emitSync()
    };
  }

  private async unloadBlueprint(): Promise<RuntimeBridgeCatalogCommandResult> {
    const currentDocument = this.graph.getGraphDocument();
    const emptyDocument = createEmptyGraphDocument(currentDocument);
    this.graph.replaceGraphDocument(structuredClone(emptyDocument));

    const sessionState = await this.getSessionState();
    sessionState.currentBlueprintId = null;
    await this.sessionStore.setSessionState(this.sessionId, sessionState);

    return {
      type: "blueprint.unload.result",
      document: structuredClone(emptyDocument),
      sync: await this.emitSync()
    };
  }

  private async validateCatalogEntry(entry: RuntimeBridgeCatalogEntry): Promise<void> {
    const entries = await this.catalogStore.listEntries();

    if (entry.entryKind === "node-entry") {
      for (const currentEntry of entries) {
        if (currentEntry.entryKind !== "node-entry") {
          continue;
        }

        for (const nodeType of entry.nodeTypes) {
          if (currentEntry.nodeTypes.includes(nodeType)) {
            throw new Error(`目录中已存在同名节点类型: ${nodeType}`);
          }
        }
      }

      for (const componentEntryId of entry.componentEntryIds) {
        const dependency = entries.find((item) => item.entryId === componentEntryId);
        if (!dependency || dependency.entryKind !== "component-entry") {
          throw new Error(`缺少组件依赖条目: ${componentEntryId}`);
        }
      }

      return;
    }

    if (entry.entryKind === "component-entry") {
      for (const currentEntry of entries) {
        if (currentEntry.entryKind !== "component-entry") {
          continue;
        }

        for (const widgetType of entry.widgetTypes) {
          if (currentEntry.widgetTypes.includes(widgetType)) {
            throw new Error(`目录中已存在同名组件类型: ${widgetType}`);
          }
        }
      }

      return;
    }

    for (const componentEntryId of entry.componentEntryIds) {
      const dependency = entries.find((item) => item.entryId === componentEntryId);
      if (!dependency || dependency.entryKind !== "component-entry") {
        throw new Error(`缺少蓝图组件依赖条目: ${componentEntryId}`);
      }
    }

    for (const nodeEntryId of entry.nodeEntryIds) {
      const dependency = entries.find((item) => item.entryId === nodeEntryId);
      if (!dependency || dependency.entryKind !== "node-entry") {
        throw new Error(`缺少蓝图节点依赖条目: ${nodeEntryId}`);
      }
    }
  }

  private async installNodeEntry(entry: RuntimeBridgeNodeCatalogEntry): Promise<void> {
    this.ensureNodeEntryCanLoad(entry);
    const artifact = await this.artifactReader.readArtifact(entry.authorityArtifactRef);
    const namespace = await importModuleNamespaceFromArtifact(artifact);
    const resolved = resolveNodeModuleExport(namespace);

    if (isNodeModule(resolved)) {
      this.graph.installModule(resolved);
    } else {
      for (const definition of resolved) {
        this.graph.registerNode(definition);
      }
    }

    this.loadedNodeEntryIds.add(entry.entryId);
  }

  private async activateComponentEntry(
    entry: RuntimeBridgeComponentCatalogEntry,
    sessionState: RuntimeBridgeSessionExtensionState
  ): Promise<void> {
    if (!this.loadedComponentEntryIds.has(entry.entryId)) {
      this.installComponentEntry(entry);
    }

    sessionState.activeComponentEntryIds = addUnique(
      sessionState.activeComponentEntryIds,
      entry.entryId
    );
  }

  private installComponentEntry(entry: RuntimeBridgeComponentCatalogEntry): void {
    this.ensureComponentEntryCanLoad(entry);

    for (const widgetType of entry.widgetTypes) {
      this.graph.registerWidget(createAuthorityPlaceholderWidgetEntry(widgetType, entry));
    }

    this.loadedComponentEntryIds.add(entry.entryId);
    this.loadedComponentWidgetTypesByEntryId.set(entry.entryId, [...entry.widgetTypes]);
  }

  private uninstallComponentEntry(entry: RuntimeBridgeComponentCatalogEntry): void {
    if (!this.loadedComponentEntryIds.has(entry.entryId)) {
      return;
    }

    for (const widgetType of entry.widgetTypes) {
      this.graph.unregisterWidget(widgetType);
    }

    this.loadedComponentEntryIds.delete(entry.entryId);
    this.loadedComponentWidgetTypesByEntryId.delete(entry.entryId);
  }

  private ensureNodeEntryCanLoad(entry: RuntimeBridgeNodeCatalogEntry): void {
    const currentNodeTypes = new Set(this.graph.listNodes().map((node) => node.type));

    for (const nodeType of entry.nodeTypes) {
      if (currentNodeTypes.has(nodeType) && !this.loadedNodeEntryIds.has(entry.entryId)) {
        throw new Error(`节点类型已存在于 authority 图注册表: ${nodeType}`);
      }
    }
  }

  private ensureComponentEntryCanLoad(entry: RuntimeBridgeComponentCatalogEntry): void {
    if (entry.widgetTypes.length === 0) {
      throw new Error(`组件条目缺少 widgetTypes: ${entry.entryId}`);
    }

    const activeWidgetOwners = this.collectLoadedWidgetTypeOwners();
    const currentWidgetTypes = new Set(
      this.graph.listWidgets().map((widget) => widget.type)
    );

    for (const widgetType of entry.widgetTypes) {
      const owner = activeWidgetOwners.get(widgetType);
      if (owner && owner !== entry.entryId) {
        throw new Error(`组件类型冲突: ${widgetType} 已由 ${owner} 持有`);
      }

      if (currentWidgetTypes.has(widgetType) && owner !== entry.entryId) {
        throw new Error(`组件类型已存在于 authority 图注册表: ${widgetType}`);
      }
    }
  }

  private ensureNodeEntryCanUnload(entry: RuntimeBridgeNodeCatalogEntry): void {
    const usedNodeTypes = new Set(this.graph.getGraphDocument().nodes.map((node) => node.type));

    for (const nodeType of entry.nodeTypes) {
      if (usedNodeTypes.has(nodeType)) {
        throw new Error(`节点类型仍在当前文档中使用，不能卸载: ${nodeType}`);
      }
    }
  }

  private async ensureComponentEntryCanUnload(
    entry: RuntimeBridgeComponentCatalogEntry,
    sessionState: RuntimeBridgeSessionExtensionState
  ): Promise<void> {
    for (const activeNodeEntryId of sessionState.activeNodeEntryIds) {
      const activeNodeEntry = await this.catalogStore.getEntry(activeNodeEntryId);
      if (
        activeNodeEntry?.entryKind === "node-entry" &&
        activeNodeEntry.componentEntryIds.includes(entry.entryId)
      ) {
        throw new Error(
          `组件条目仍被激活节点条目依赖，不能卸载: ${entry.entryId}`
        );
      }
    }

    if (sessionState.currentBlueprintId) {
      const currentBlueprintEntry = await this.catalogStore.getEntry(
        sessionState.currentBlueprintId
      );
      if (
        currentBlueprintEntry?.entryKind === "blueprint-entry" &&
        currentBlueprintEntry.componentEntryIds.includes(entry.entryId)
      ) {
        throw new Error(`组件条目仍被当前蓝图依赖，不能卸载: ${entry.entryId}`);
      }
    }
  }

  private async requireEntry(entryId: string): Promise<RuntimeBridgeCatalogEntry> {
    const entry = await this.catalogStore.getEntry(entryId);
    if (!entry) {
      throw new Error(`目录条目不存在: ${entryId}`);
    }
    return entry;
  }

  private async getSessionState(): Promise<RuntimeBridgeSessionExtensionState> {
    return this.sessionStore.getSessionState(this.sessionId);
  }

  private async emitSync(): Promise<RuntimeBridgeExtensionsSync> {
    const snapshot = await this.getSyncState();
    for (const listener of this.syncListeners) {
      listener(snapshot);
    }
    return snapshot;
  }

  private collectLoadedWidgetTypeOwners(): Map<string, string> {
    const ownerMap = new Map<string, string>();

    for (const [entryId, widgetTypes] of this.loadedComponentWidgetTypesByEntryId) {
      for (const widgetType of widgetTypes) {
        ownerMap.set(widgetType, entryId);
      }
    }

    return ownerMap;
  }
}

function addUnique(list: string[], value: string): string[] {
  return list.includes(value) ? [...list] : [...list, value];
}

function createEmptyGraphDocument(currentDocument: GraphDocument): GraphDocument {
  return {
    ...structuredClone(currentDocument),
    nodes: [],
    links: []
  };
}

function validateEntryId(entryId: string): void {
  const normalized = entryId.trim();
  if (!normalized) {
    throw new Error("目录条目 ID 不能为空");
  }
}

function isNodeModule(value: NodeModule | NodeDefinition[]): value is NodeModule {
  return !Array.isArray(value);
}

function createAuthorityPlaceholderWidgetEntry(
  widgetType: string,
  entry: RuntimeBridgeComponentCatalogEntry
): LeaferGraphWidgetEntry {
  return {
    type: widgetType,
    title: `${entry.name} Placeholder`,
    description: `Authority 占位 Widget: ${widgetType}`,
    renderer() {
      return {};
    }
  };
}
