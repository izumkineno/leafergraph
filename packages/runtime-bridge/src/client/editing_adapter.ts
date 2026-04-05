import type {
  GraphLink,
  NodeDefinition,
  NodeSerializeResult
} from "@leafergraph/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  GraphOperationSource,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphInteractionCommitEvent,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import {
  createGraphOperationsFromClipboardFragment,
  createGraphOperationsFromInteractionCommit,
  type CreateGraphOperationsFromClipboardFragmentOptions,
  type RuntimeBridgeClipboardFragment
} from "../portable/index.js";
import type { LeaferGraphRuntimeBridgeClient } from "./runtime_bridge_client.js";

export interface LeaferGraphRuntimeBridgeEditingAdapterGraphLike {
  listNodes(): NodeDefinition[];
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  findLinksByNode(nodeId: string): readonly GraphLink[];
  isNodeSelected(nodeId: string): boolean;
  listSelectedNodeIds(): string[];
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  clearSelectedNodes(): string[];
}

export interface LeaferGraphRuntimeBridgeEditingAdapterOptions {
  graph: LeaferGraphRuntimeBridgeEditingAdapterGraphLike;
  bridgeClient: LeaferGraphRuntimeBridgeClient;
  source?: GraphOperationSource;
  pasteOffset?: {
    x: number;
    y: number;
  };
  createNodeId?(snapshot: NodeSerializeResult, index: number): string;
  createLinkId?(link: GraphLink, index: number): string;
}

export interface RuntimeBridgeClipboardPlacementOptions {
  anchorPoint?: {
    x: number;
    y: number;
  };
  anchorToPoint?: boolean;
  offset?: {
    x: number;
    y: number;
  };
}

export interface LeaferGraphRuntimeBridgeEditingAdapter {
  listNodes(): NodeDefinition[];
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  findLinksByNode(nodeId: string): readonly GraphLink[];
  isNodeSelected(nodeId: string): boolean;
  listSelectedNodeIds(): string[];
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  clearSelectedNodes(): string[];
  submitInteractionCommit(
    event: LeaferGraphInteractionCommitEvent
  ): Promise<readonly GraphOperationApplyResult[]>;
  createNode(input: LeaferGraphCreateNodeInput): Promise<{ nodeId: string }>;
  createLink(input: LeaferGraphCreateLinkInput): Promise<{ linkId: string }>;
  removeNode(nodeId: string): Promise<void>;
  removeNodes(nodeIds: readonly string[]): Promise<void>;
  removeLink(linkId: string): Promise<void>;
  createClipboardFragment(nodeIds: readonly string[]): RuntimeBridgeClipboardFragment | null;
  copyNodes(nodeIds: readonly string[]): RuntimeBridgeClipboardFragment | null;
  copySelection(): RuntimeBridgeClipboardFragment | null;
  cutNodes(nodeIds: readonly string[]): Promise<RuntimeBridgeClipboardFragment | null>;
  cutSelection(): Promise<RuntimeBridgeClipboardFragment | null>;
  pasteFragment(
    fragment: RuntimeBridgeClipboardFragment,
    options?: RuntimeBridgeClipboardPlacementOptions
  ): Promise<string[]>;
  duplicateNodes(
    nodeIds: readonly string[],
    options?: RuntimeBridgeClipboardPlacementOptions
  ): Promise<string[]>;
  duplicateSelection(
    options?: RuntimeBridgeClipboardPlacementOptions
  ): Promise<string[]>;
}

const DEFAULT_PASTE_OFFSET = {
  x: 24,
  y: 24
} as const;

/**
 * 创建 authority-first 的浏览器侧编辑适配器。
 *
 * @param options - 初始化选项。
 * @returns 编辑适配器。
 */
export function createLeaferGraphRuntimeBridgeEditingAdapter(
  options: LeaferGraphRuntimeBridgeEditingAdapterOptions
): LeaferGraphRuntimeBridgeEditingAdapter {
  const source = options.source ?? "bridge.editing";

  const submitOperationsAndRecover = async (
    operations: readonly GraphOperation[]
  ): Promise<readonly GraphOperationApplyResult[]> => {
    ensureConnected(options.bridgeClient);
    try {
      const results = await options.bridgeClient.submitOperations(operations);
      if (results.some((result) => !result.accepted)) {
        await options.bridgeClient.requestSnapshot();
        throw new Error("authority rejected one or more operations");
      }

      await options.bridgeClient.waitForIdle();
      return results;
    } catch (error) {
      try {
        await options.bridgeClient.requestSnapshot();
      } catch {
        // 保持原始错误语义；snapshot 恢复失败时由外层自行记录。
      }
      throw error;
    }
  };

  const createClipboardFragment = (
    nodeIds: readonly string[]
  ): RuntimeBridgeClipboardFragment | null => {
    const snapshots = nodeIds
      .map((nodeId) => options.graph.getNodeSnapshot(nodeId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (!snapshots.length) {
      return null;
    }

    const copiedNodeIds = new Set(snapshots.map((entry) => entry.id));
    const linksById = new Map<string, GraphLink>();
    for (const nodeId of copiedNodeIds) {
      for (const link of options.graph.findLinksByNode(nodeId)) {
        if (
          copiedNodeIds.has(link.source.nodeId) &&
          copiedNodeIds.has(link.target.nodeId)
        ) {
          linksById.set(link.id, link);
        }
      }
    }

    return {
      nodes: snapshots,
      links: [...linksById.values()]
    };
  };

  return {
    listNodes() {
      return options.graph.listNodes();
    },
    getNodeSnapshot(nodeId) {
      return options.graph.getNodeSnapshot(nodeId);
    },
    findLinksByNode(nodeId) {
      return options.graph.findLinksByNode(nodeId);
    },
    isNodeSelected(nodeId) {
      return options.graph.isNodeSelected(nodeId);
    },
    listSelectedNodeIds() {
      return options.graph.listSelectedNodeIds();
    },
    setSelectedNodeIds(nodeIds, mode) {
      return options.graph.setSelectedNodeIds(nodeIds, mode);
    },
    clearSelectedNodes() {
      return options.graph.clearSelectedNodes();
    },
    async submitInteractionCommit(event) {
      const operations = createGraphOperationsFromInteractionCommit(event, {
        source
      });
      if (!operations.length) {
        return [];
      }

      return submitOperationsAndRecover(operations);
    },
    async createNode(input) {
      const nodeId = input.id?.trim() || createRandomId("node");
      await submitOperationsAndRecover([
        {
          type: "node.create",
          input: {
            ...input,
            id: nodeId
          },
          ...createOperationMetadata(source)
        }
      ]);
      return { nodeId };
    },
    async createLink(input) {
      const linkId = input.id?.trim() || createRandomId("link");
      await submitOperationsAndRecover([
        {
          type: "link.create",
          input: {
            ...input,
            id: linkId
          },
          ...createOperationMetadata(source)
        }
      ]);
      return { linkId };
    },
    async removeNode(nodeId) {
      await submitOperationsAndRecover([
        {
          type: "node.remove",
          nodeId,
          ...createOperationMetadata(source)
        }
      ]);
      syncSelectionAfterRemoval(options.graph, [nodeId]);
    },
    async removeNodes(nodeIds) {
      if (!nodeIds.length) {
        return;
      }

      await submitOperationsAndRecover(
        nodeIds.map((nodeId) => ({
          type: "node.remove" as const,
          nodeId,
          ...createOperationMetadata(source)
        }))
      );
      syncSelectionAfterRemoval(options.graph, nodeIds);
    },
    async removeLink(linkId) {
      await submitOperationsAndRecover([
        {
          type: "link.remove",
          linkId,
          ...createOperationMetadata(source)
        }
      ]);
    },
    createClipboardFragment,
    copyNodes(nodeIds) {
      return createClipboardFragment(nodeIds);
    },
    copySelection() {
      return createClipboardFragment(options.graph.listSelectedNodeIds());
    },
    async cutNodes(nodeIds) {
      const fragment = createClipboardFragment(nodeIds);
      if (!fragment) {
        return null;
      }

      await this.removeNodes(nodeIds);
      return fragment;
    },
    async cutSelection() {
      return this.cutNodes(options.graph.listSelectedNodeIds());
    },
    async pasteFragment(fragment, placementOptions = {}) {
      const result = createGraphOperationsFromClipboardFragment(
        fragment,
        resolveClipboardOperationOptions({
          source,
          pasteOffset: options.pasteOffset,
          placementOptions,
          createNodeId: options.createNodeId,
          createLinkId: options.createLinkId
        })
      );
      if (!result.operations.length) {
        return [];
      }

      await submitOperationsAndRecover(result.operations);
      options.graph.setSelectedNodeIds(result.createdNodeIds, "replace");
      return result.createdNodeIds;
    },
    async duplicateNodes(nodeIds, placementOptions = {}) {
      const fragment = createClipboardFragment(nodeIds);
      if (!fragment) {
        return [];
      }

      return this.pasteFragment(fragment, {
        ...placementOptions,
        anchorToPoint: false
      });
    },
    async duplicateSelection(placementOptions = {}) {
      return this.duplicateNodes(
        options.graph.listSelectedNodeIds(),
        placementOptions
      );
    }
  };
}

function resolveClipboardOperationOptions(input: {
  source: GraphOperationSource;
  pasteOffset: {
    x: number;
    y: number;
  } | undefined;
  placementOptions: RuntimeBridgeClipboardPlacementOptions;
  createNodeId: LeaferGraphRuntimeBridgeEditingAdapterOptions["createNodeId"];
  createLinkId: LeaferGraphRuntimeBridgeEditingAdapterOptions["createLinkId"];
}): CreateGraphOperationsFromClipboardFragmentOptions {
  return {
    source: input.source,
    offset: input.placementOptions.offset ?? input.pasteOffset ?? DEFAULT_PASTE_OFFSET,
    anchorPoint: input.placementOptions.anchorPoint,
    anchorToPoint: input.placementOptions.anchorToPoint,
    createNodeId: input.createNodeId,
    createLinkId: input.createLinkId
  };
}

function syncSelectionAfterRemoval(
  graph: LeaferGraphRuntimeBridgeEditingAdapterGraphLike,
  removedNodeIds: readonly string[]
): void {
  const removedIdSet = new Set(removedNodeIds);
  const nextSelectedNodeIds = graph
    .listSelectedNodeIds()
    .filter((nodeId) => !removedIdSet.has(nodeId));
  graph.setSelectedNodeIds(nextSelectedNodeIds, "replace");
}

function ensureConnected(bridgeClient: LeaferGraphRuntimeBridgeClient): void {
  if (!bridgeClient.isConnected()) {
    throw new Error("Runtime bridge is not connected.");
  }
}

function createOperationMetadata(source: GraphOperationSource): Pick<
  GraphOperation,
  "operationId" | "timestamp" | "source"
> {
  return {
    operationId: createRandomId("operation"),
    timestamp: Date.now(),
    source
  };
}

function createRandomId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}:${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
}
