import type { NodeDefinition, NodeModule } from "@leafergraph/node";
import type { LeaferGraph } from "leafergraph";
import type { RuntimeBridgeArtifactReader } from "./artifact.js";
import {
  importModuleNamespaceFromArtifact,
  resolveNodeModuleExport,
  resolveNodeTypesExport,
  resolveWidgetEntriesExport,
  resolveWidgetTypesExport
} from "./loader.js";
import type {
  RuntimeBridgeComponentCatalogEntry,
  RuntimeBridgeExtensionsSync,
  RuntimeBridgeNodeCatalogEntry
} from "./types.js";

/** browser manager 依赖的最小图壳面。 */
export type RuntimeBridgeBrowserExtensionGraphLike = Pick<
  LeaferGraph,
  | "installModule"
  | "listNodes"
  | "listWidgets"
  | "registerNode"
  | "registerWidget"
  | "unregisterNode"
  | "unregisterWidget"
>;

export interface RuntimeBridgeBrowserExtensionManagerOptions {
  graph: RuntimeBridgeBrowserExtensionGraphLike;
  artifactReader: RuntimeBridgeArtifactReader;
}

/** 单个条目当前在浏览器侧拥有的类型。 */
interface RuntimeBridgeBrowserOwnedTypes {
  nodeTypes: string[];
  widgetTypes: string[];
}

/**
 * 浏览器侧扩展 manager。
 *
 * @remarks
 * 它只负责让本地图的 registry 与 authority 会话保持一致，
 * 不直接处理 document snapshot / diff。
 */
export class RuntimeBridgeBrowserExtensionManager {
  private readonly graph: RuntimeBridgeBrowserExtensionGraphLike;
  private readonly artifactReader: RuntimeBridgeArtifactReader;
  private readonly syncListeners = new Set<
    (sync: RuntimeBridgeExtensionsSync) => void
  >();
  private readonly ownedTypesByEntryId = new Map<
    string,
    RuntimeBridgeBrowserOwnedTypes
  >();
  private currentSync: RuntimeBridgeExtensionsSync = {
    entries: [],
    activeNodeEntryIds: [],
    activeComponentEntryIds: [],
    currentBlueprintId: null,
    emittedAt: 0
  };

  constructor(options: RuntimeBridgeBrowserExtensionManagerOptions) {
    this.graph = options.graph;
    this.artifactReader = options.artifactReader;
  }

  /**
   * 读取当前扩展同步快照。
   *
   * @returns 当前快照。
   */
  getSyncState(): RuntimeBridgeExtensionsSync {
    return structuredClone(this.currentSync);
  }

  /**
   * 订阅扩展同步快照。
   *
   * @param listener - 监听器。
   * @returns 取消订阅函数。
   */
  subscribeSync(listener: (sync: RuntimeBridgeExtensionsSync) => void): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncState());
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * 应用一份 authority 扩展快照。
   *
   * @param nextSync - 最新快照。
   * @returns 安装/卸载完成后的异步结果。
   */
  async sync(nextSync: RuntimeBridgeExtensionsSync): Promise<void> {
    const entryMap = new Map(nextSync.entries.map((entry) => [entry.entryId, entry]));
    const nextActiveNodeEntryIds = new Set(nextSync.activeNodeEntryIds);
    const nextActiveComponentEntryIds = new Set(nextSync.activeComponentEntryIds);

    for (const entryId of [...this.ownedTypesByEntryId.keys()]) {
      const owned = this.ownedTypesByEntryId.get(entryId);
      if (!owned) {
        continue;
      }

      if (owned.nodeTypes.length > 0 && !nextActiveNodeEntryIds.has(entryId)) {
        this.uninstallOwnedTypes(entryId);
      }
    }

    for (const entryId of nextSync.activeComponentEntryIds) {
      const entry = entryMap.get(entryId);
      if (!entry || entry.entryKind !== "component-entry") {
        throw new Error(`缺少激活组件条目: ${entryId}`);
      }

      if (!this.ownedTypesByEntryId.has(entryId)) {
        await this.installComponentEntry(entry);
      }
    }

    for (const entryId of nextSync.activeNodeEntryIds) {
      const entry = entryMap.get(entryId);
      if (!entry || entry.entryKind !== "node-entry") {
        throw new Error(`缺少激活节点条目: ${entryId}`);
      }

      for (const componentEntryId of entry.componentEntryIds) {
        if (!nextActiveComponentEntryIds.has(componentEntryId)) {
          throw new Error(
            `节点条目 ${entryId} 缺少激活的组件依赖: ${componentEntryId}`
          );
        }
      }

      if (!this.ownedTypesByEntryId.has(entryId)) {
        await this.installNodeEntry(entry);
      }
    }

    for (const entryId of [...this.ownedTypesByEntryId.keys()]) {
      const owned = this.ownedTypesByEntryId.get(entryId);
      if (!owned) {
        continue;
      }

      if (owned.widgetTypes.length > 0 && !nextActiveComponentEntryIds.has(entryId)) {
        this.uninstallOwnedTypes(entryId);
      }
    }

    this.currentSync = structuredClone(nextSync);
    this.emitSync();
  }

  private async installComponentEntry(
    entry: RuntimeBridgeComponentCatalogEntry
  ): Promise<void> {
    this.ensureWidgetTypesAvailable(entry);
    const artifact = await this.artifactReader.readArtifact(entry.browserArtifactRef);
    const namespace = await importModuleNamespaceFromArtifact(artifact);
    const widgetEntries = resolveWidgetEntriesExport(namespace);
    const widgetTypes = resolveWidgetTypesExport(namespace);

    assertExactTypeList(
      `组件条目 ${entry.entryId} 的 browser artifact`,
      entry.widgetTypes,
      widgetTypes
    );

    for (const widgetEntry of widgetEntries) {
      this.graph.registerWidget(widgetEntry);
    }

    this.ownedTypesByEntryId.set(entry.entryId, {
      nodeTypes: [],
      widgetTypes
    });
  }

  private async installNodeEntry(entry: RuntimeBridgeNodeCatalogEntry): Promise<void> {
    this.ensureNodeTypesAvailable(entry);
    const artifact = await this.artifactReader.readArtifact(entry.browserArtifactRef);
    const namespace = await importModuleNamespaceFromArtifact(artifact);
    const resolved = resolveNodeModuleExport(namespace);
    const nodeTypes = resolveNodeTypesExport(namespace);

    assertExactTypeList(
      `节点条目 ${entry.entryId} 的 browser artifact`,
      entry.nodeTypes,
      nodeTypes
    );

    if (isNodeModule(resolved)) {
      this.graph.installModule(resolved);
    } else {
      for (const definition of resolved) {
        this.graph.registerNode(definition);
      }
    }

    this.ownedTypesByEntryId.set(entry.entryId, {
      nodeTypes,
      widgetTypes: []
    });
  }

  private uninstallOwnedTypes(entryId: string): void {
    const owned = this.ownedTypesByEntryId.get(entryId);
    if (!owned) {
      return;
    }

    for (const nodeType of owned.nodeTypes) {
      this.graph.unregisterNode(nodeType);
    }

    for (const widgetType of owned.widgetTypes) {
      this.graph.unregisterWidget(widgetType);
    }

    this.ownedTypesByEntryId.delete(entryId);
  }

  private ensureNodeTypesAvailable(entry: RuntimeBridgeNodeCatalogEntry): void {
    const activeNodeOwners = this.collectOwnedNodeTypeOwners();
    const currentNodeTypes = new Set(this.graph.listNodes().map((node) => node.type));

    for (const nodeType of entry.nodeTypes) {
      const owner = activeNodeOwners.get(nodeType);
      if (owner && owner !== entry.entryId) {
        throw new Error(`节点类型冲突: ${nodeType} 已由 ${owner} 持有`);
      }

      if (currentNodeTypes.has(nodeType) && owner !== entry.entryId) {
        throw new Error(`节点类型已存在于当前图注册表: ${nodeType}`);
      }
    }
  }

  private ensureWidgetTypesAvailable(entry: RuntimeBridgeComponentCatalogEntry): void {
    const activeWidgetOwners = this.collectOwnedWidgetTypeOwners();
    const currentWidgetTypes = new Set(
      this.graph.listWidgets().map((widget) => widget.type)
    );

    for (const widgetType of entry.widgetTypes) {
      const owner = activeWidgetOwners.get(widgetType);
      if (owner && owner !== entry.entryId) {
        throw new Error(`组件类型冲突: ${widgetType} 已由 ${owner} 持有`);
      }

      if (currentWidgetTypes.has(widgetType) && owner !== entry.entryId) {
        throw new Error(`组件类型已存在于当前图注册表: ${widgetType}`);
      }
    }
  }

  private collectOwnedNodeTypeOwners(): Map<string, string> {
    const ownerMap = new Map<string, string>();

    for (const [entryId, owned] of this.ownedTypesByEntryId) {
      for (const nodeType of owned.nodeTypes) {
        ownerMap.set(nodeType, entryId);
      }
    }

    return ownerMap;
  }

  private collectOwnedWidgetTypeOwners(): Map<string, string> {
    const ownerMap = new Map<string, string>();

    for (const [entryId, owned] of this.ownedTypesByEntryId) {
      for (const widgetType of owned.widgetTypes) {
        ownerMap.set(widgetType, entryId);
      }
    }

    return ownerMap;
  }

  private emitSync(): void {
    const snapshot = this.getSyncState();
    for (const listener of this.syncListeners) {
      listener(snapshot);
    }
  }
}

function isNodeModule(value: NodeModule | NodeDefinition[]): value is NodeModule {
  return !Array.isArray(value);
}

function assertExactTypeList(
  label: string,
  expectedTypes: readonly string[],
  actualTypes: readonly string[]
): void {
  const expected = normalizeTypeList(expectedTypes);
  const actual = normalizeTypeList(actualTypes);

  if (expected.length !== actual.length || expected.some((type, index) => type !== actual[index])) {
    throw new Error(
      `${label} 的 metadata 与 artifact 导出不一致。metadata=${expected.join(", ")} actual=${actual.join(", ")}`
    );
  }
}

function normalizeTypeList(types: readonly string[]): string[] {
  return [...new Set(types.map((type) => type.trim()).filter(Boolean))].sort();
}
