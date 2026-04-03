import type { GraphDocument } from "@leafergraph/node";
import type { RuntimeBridgeArtifactRef } from "./artifact.js";

/** 扩展目录里三类一级条目。 */
export type RuntimeBridgeCatalogEntryKind =
  | "node-entry"
  | "component-entry"
  | "blueprint-entry";

/** 目录条目公共字段。 */
export interface RuntimeBridgeCatalogEntryBase {
  entryId: string;
  entryKind: RuntimeBridgeCatalogEntryKind;
  name: string;
  description?: string;
}

/** 节点条目 metadata。 */
export interface RuntimeBridgeNodeCatalogEntry
  extends RuntimeBridgeCatalogEntryBase {
  entryKind: "node-entry";
  nodeTypes: string[];
  componentEntryIds: string[];
  authorityArtifactRef: RuntimeBridgeArtifactRef;
  browserArtifactRef: RuntimeBridgeArtifactRef;
}

/** 组件条目 metadata。 */
export interface RuntimeBridgeComponentCatalogEntry
  extends RuntimeBridgeCatalogEntryBase {
  entryKind: "component-entry";
  widgetTypes: string[];
  browserArtifactRef: RuntimeBridgeArtifactRef;
}

/** 蓝图条目 metadata。 */
export interface RuntimeBridgeBlueprintCatalogEntry
  extends RuntimeBridgeCatalogEntryBase {
  entryKind: "blueprint-entry";
  nodeEntryIds: string[];
  componentEntryIds: string[];
  documentArtifactRef: RuntimeBridgeArtifactRef;
}

/** 扩展目录条目联合类型。 */
export type RuntimeBridgeCatalogEntry =
  | RuntimeBridgeNodeCatalogEntry
  | RuntimeBridgeComponentCatalogEntry
  | RuntimeBridgeBlueprintCatalogEntry;

/** 会话级扩展同步快照。 */
export interface RuntimeBridgeExtensionsSync {
  entries: RuntimeBridgeCatalogEntry[];
  activeNodeEntryIds: string[];
  activeComponentEntryIds: string[];
  currentBlueprintId: string | null;
  emittedAt: number;
}

/** 扩展目录命令。 */
export type RuntimeBridgeCatalogCommand =
  | {
      type: "catalog.list";
    }
  | {
      type: "entry.register";
      entry: RuntimeBridgeCatalogEntry;
    }
  | {
      type: "entry.load";
      entryId: string;
    }
  | {
      type: "entry.unload";
      entryId: string;
    }
  | {
      type: "entry.unregister";
      entryId: string;
    }
  | {
      type: "blueprint.load";
      entryId: string;
    }
  | {
      type: "blueprint.unload";
    };

/** 扩展目录命令结果。 */
export type RuntimeBridgeCatalogCommandResult =
  | {
      type: "catalog.list.result";
      sync: RuntimeBridgeExtensionsSync;
    }
  | {
      type: "entry.register.result";
      entry: RuntimeBridgeCatalogEntry;
      sync: RuntimeBridgeExtensionsSync;
    }
  | {
      type: "entry.load.result";
      sync: RuntimeBridgeExtensionsSync;
    }
  | {
      type: "entry.unload.result";
      sync: RuntimeBridgeExtensionsSync;
    }
  | {
      type: "entry.unregister.result";
      sync: RuntimeBridgeExtensionsSync;
    }
  | {
      type: "blueprint.load.result";
      document: GraphDocument;
      sync: RuntimeBridgeExtensionsSync;
    }
  | {
      type: "blueprint.unload.result";
      document: GraphDocument;
      sync: RuntimeBridgeExtensionsSync;
    };

/** authority 端目录 store。 */
export interface RuntimeBridgeCatalogStore {
  listEntries(): Promise<readonly RuntimeBridgeCatalogEntry[]>;
  getEntry(entryId: string): Promise<RuntimeBridgeCatalogEntry | undefined>;
  putEntry(entry: RuntimeBridgeCatalogEntry): Promise<void>;
  deleteEntry(entryId: string): Promise<void>;
}

/** 会话级扩展状态。 */
export interface RuntimeBridgeSessionExtensionState {
  activeNodeEntryIds: string[];
  activeComponentEntryIds: string[];
  currentBlueprintId: string | null;
}

/** authority 端会话扩展 store。 */
export interface RuntimeBridgeSessionExtensionStore {
  getSessionState(sessionId: string): Promise<RuntimeBridgeSessionExtensionState>;
  setSessionState(
    sessionId: string,
    state: RuntimeBridgeSessionExtensionState
  ): Promise<void>;
}

