import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import { createCreateNodeInputFromNodeSnapshot } from "@leafergraph/contracts/graph-document-diff";
import type { LeaferContextMenuContext } from "@leafergraph/context-menu";
import type { GraphLink, NodeRuntimeState, NodeSerializeResult } from "@leafergraph/node";
import type {
  LeaferGraphContextMenuBuiltinsHost,
  LeaferGraphContextMenuClipboardFragment,
  LeaferGraphContextMenuClipboardState
} from "./types";

const DEFAULT_PASTE_OFFSET = {
  x: 24,
  y: 24
} as const;

type LeaferGraphEditingPoint = {
  x: number;
  y: number;
};

/**
 * 编辑控制器读取图数据时依赖的最小宿主能力。
 */
export interface LeaferGraphEditingReadHost {
  /** 列出当前选区节点 ID。 */
  listSelectedNodeIds(): readonly string[];
  /** 按模式更新选区。 */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): readonly string[];
  /** 读取指定节点快照。 */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  /** 按节点查找相关连线。 */
  findLinksByNode(nodeId: string): readonly GraphLink[];
}

/**
 * 编辑控制器执行写操作时依赖的最小适配器。
 */
export interface LeaferGraphEditingMutationAdapters {
  /** 创建节点。 */
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState;
  /** 创建连线。 */
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  /** 删除单个节点。 */
  removeNode(nodeId: string): void;
  /** 批量删除节点。 */
  removeNodes?(nodeIds: readonly string[]): void;
}

/**
 * 编辑控制器构造选项。
 */
export interface LeaferGraphEditingControllerOptions {
  /** 图读取宿主。 */
  host: LeaferGraphEditingReadHost;
  /** 剪贴板状态。 */
  clipboard: LeaferGraphContextMenuClipboardState;
  /** 默认粘贴偏移。 */
  pasteOffset?: LeaferGraphEditingPoint;
  /** 默认锚点解析器。 */
  resolveAnchorPoint?(): LeaferGraphEditingPoint | null | undefined;
  /** 默认 mutation adapters。 */
  mutationAdapters?: Partial<LeaferGraphEditingMutationAdapters>;
}

/**
 * 图编辑控制器。
 */
export interface LeaferGraphEditingController {
  /** 复制显式节点列表到剪贴板。 */
  copyNodeIds(nodeIds: readonly string[]): LeaferGraphContextMenuClipboardFragment | null;
  /** 复制当前选区到剪贴板。 */
  copySelection(): LeaferGraphContextMenuClipboardFragment | null;
  /** 剪切显式节点列表。 */
  cutNodeIds(
    nodeIds: readonly string[],
    options?: {
      mutationAdapters?: Pick<
        LeaferGraphEditingMutationAdapters,
        "removeNode" | "removeNodes"
      >;
    }
  ): LeaferGraphContextMenuClipboardFragment | null;
  /** 剪切当前选区。 */
  cutSelection(
    options?: {
      mutationAdapters?: Pick<
        LeaferGraphEditingMutationAdapters,
        "removeNode" | "removeNodes"
      >;
    }
  ): LeaferGraphContextMenuClipboardFragment | null;
  /** 粘贴当前剪贴板内容。 */
  pasteClipboard(
    options?: {
      anchorPoint?: LeaferGraphEditingPoint;
      anchorToPoint?: boolean;
      mutationAdapters?: Pick<
        LeaferGraphEditingMutationAdapters,
        "createNode" | "createLink"
      >;
    }
  ): string[];
  /** 基于显式节点列表创建副本。 */
  duplicateNodeIds(
    nodeIds: readonly string[],
    options?: {
      anchorPoint?: LeaferGraphEditingPoint;
      anchorToPoint?: boolean;
      mutationAdapters?: Pick<
        LeaferGraphEditingMutationAdapters,
        "createNode" | "createLink"
      >;
    }
  ): string[];
  /** 基于当前选区创建副本。 */
  duplicateSelection(
    options?: {
      anchorPoint?: LeaferGraphEditingPoint;
      anchorToPoint?: boolean;
      mutationAdapters?: Pick<
        LeaferGraphEditingMutationAdapters,
        "createNode" | "createLink"
      >;
    }
  ): string[];
  /** 当前是否允许复制。 */
  canCopySelection(): boolean;
  /** 当前是否允许剪切。 */
  canCutSelection(): boolean;
  /** 当前是否允许粘贴。 */
  canPasteClipboard(): boolean;
  /** 当前是否允许复制副本。 */
  canDuplicateSelection(): boolean;
}

/**
 * 创建图编辑控制器。
 *
 * @param options - 控制器构造选项。
 * @returns 可复用的编辑控制器实例。
 */
export function createLeaferGraphEditingController(
  options: LeaferGraphEditingControllerOptions
): LeaferGraphEditingController {
  const defaultPasteOffset = normalizeEditingPoint(options.pasteOffset) ?? DEFAULT_PASTE_OFFSET;

  return {
    copyNodeIds(nodeIds) {
      if (!nodeIds.length) {
        return null;
      }

      return writeClipboardFragment({
        clipboard: options.clipboard,
        host: options.host,
        nodeIds
      });
    },
    copySelection() {
      const nodeIds = [...options.host.listSelectedNodeIds()];
      if (!nodeIds.length) {
        return null;
      }

      return this.copyNodeIds(nodeIds);
    },
    cutNodeIds(nodeIds, cutOptions) {
      if (!nodeIds.length) {
        return null;
      }

      const fragment = writeClipboardFragment({
        clipboard: options.clipboard,
        host: options.host,
        nodeIds
      });
      if (!fragment) {
        return null;
      }

      removeNodeIds(nodeIds, cutOptions?.mutationAdapters);
      options.host.setSelectedNodeIds([], "replace");
      return fragment;
    },
    cutSelection(cutOptions) {
      const nodeIds = [...options.host.listSelectedNodeIds()];
      if (!nodeIds.length) {
        return null;
      }

      return this.cutNodeIds(nodeIds, cutOptions);
    },
    pasteClipboard(pasteOptions) {
      const fragment = options.clipboard.getFragment();
      if (!fragment?.nodes.length) {
        return [];
      }

      const mutationAdapters = resolvePasteMutationAdapters(pasteOptions?.mutationAdapters);
      return pasteClipboardFragment({
        fragment,
        host: options.host,
        createNode: mutationAdapters.createNode,
        createLink: mutationAdapters.createLink,
        anchorPoint: resolveAnchorPoint(pasteOptions?.anchorPoint),
        offset: defaultPasteOffset,
        anchorToPoint: pasteOptions?.anchorToPoint !== false
      });
    },
    duplicateNodeIds(nodeIds, duplicateOptions) {
      if (!nodeIds.length) {
        return [];
      }

      const fragment = createClipboardFragment({
        host: options.host,
        nodeIds
      });
      if (!fragment) {
        return [];
      }

      const mutationAdapters = resolvePasteMutationAdapters(
        duplicateOptions?.mutationAdapters
      );
      return pasteClipboardFragment({
        fragment,
        host: options.host,
        createNode: mutationAdapters.createNode,
        createLink: mutationAdapters.createLink,
        anchorPoint: resolveAnchorPoint(duplicateOptions?.anchorPoint),
        offset: defaultPasteOffset,
        anchorToPoint: duplicateOptions?.anchorToPoint ?? false
      });
    },
    duplicateSelection(duplicateOptions) {
      const nodeIds = [...options.host.listSelectedNodeIds()];
      if (!nodeIds.length) {
        return [];
      }

      return this.duplicateNodeIds(nodeIds, duplicateOptions);
    },
    canCopySelection() {
      return options.host.listSelectedNodeIds().length > 0;
    },
    canCutSelection() {
      return options.host.listSelectedNodeIds().length > 0;
    },
    canPasteClipboard() {
      return options.clipboard.hasFragment();
    },
    canDuplicateSelection() {
      return options.host.listSelectedNodeIds().length > 0;
    }
  };

  /**
   * 解析最终锚点。
   *
   * @param explicitAnchorPoint - 调用级显式锚点。
   * @returns 最终使用的锚点。
   */
  function resolveAnchorPoint(
    explicitAnchorPoint: LeaferGraphEditingPoint | undefined
  ): LeaferGraphEditingPoint | undefined {
    return (
      normalizeEditingPoint(explicitAnchorPoint) ??
      normalizeEditingPoint(options.resolveAnchorPoint?.()) ??
      undefined
    );
  }

  /**
   * 解析粘贴所需的 mutation adapters。
   *
   * @param override - 调用级覆盖项。
   * @returns 已补齐的 adapters。
   */
  function resolvePasteMutationAdapters(
    override:
      | Pick<LeaferGraphEditingMutationAdapters, "createNode" | "createLink">
      | undefined
  ): Pick<LeaferGraphEditingMutationAdapters, "createNode" | "createLink"> {
    const createNode = override?.createNode ?? options.mutationAdapters?.createNode;
    const createLink = override?.createLink ?? options.mutationAdapters?.createLink;

    if (!createNode || !createLink) {
      throw new Error(
        "LeaferGraphEditingController 缺少 createNode / createLink mutation adapters"
      );
    }

    return {
      createNode,
      createLink
    };
  }

  /**
   * 删除指定节点列表。
   *
   * @param nodeIds - 目标节点 ID 列表。
   * @param override - 调用级覆盖项。
   * @returns 无返回值。
   */
  function removeNodeIds(
    nodeIds: readonly string[],
    override:
      | Pick<LeaferGraphEditingMutationAdapters, "removeNode" | "removeNodes">
      | undefined
  ): void {
    const removeNode = override?.removeNode ?? options.mutationAdapters?.removeNode;
    const removeNodes = override?.removeNodes ?? options.mutationAdapters?.removeNodes;

    if (nodeIds.length > 1 && removeNodes) {
      removeNodes(nodeIds);
      return;
    }

    if (nodeIds.length === 1 && removeNode) {
      removeNode(nodeIds[0]);
      return;
    }

    if (removeNodes) {
      removeNodes(nodeIds);
      return;
    }

    if (removeNode) {
      for (const nodeId of nodeIds) {
        removeNode(nodeId);
      }
      return;
    }

    throw new Error(
      "LeaferGraphEditingController 缺少 removeNode / removeNodes mutation adapters"
    );
  }
}

/**
 * 解析当前 context 最适合用作节点布局写回的锚点。
 *
 * @param context - 当前菜单上下文。
 * @returns 可复用的锚点；拿不到时返回 `null`。
 */
export function resolveContextAnchorPoint(
  context: Pick<LeaferContextMenuContext, "pagePoint" | "worldPoint">
): LeaferGraphEditingPoint | null {
  const pagePoint = normalizeEditingPoint(context.pagePoint);
  if (pagePoint) {
    return pagePoint;
  }

  return normalizeEditingPoint(context.worldPoint);
}

/**
 * 解析`Editing` 节点 ID 列表。
 *
 * @param host - 当前宿主实现。
 * @param nodeId - 目标节点 ID。
 * @returns 处理后的结果。
 */
export function resolveEditingNodeIds(
  host: Pick<
    LeaferGraphContextMenuBuiltinsHost,
    "isNodeSelected" | "listSelectedNodeIds"
  >,
  nodeId: string
): string[] {
  if (!host.isNodeSelected(nodeId)) {
    return [nodeId];
  }

  const selectedNodeIds = host.listSelectedNodeIds();
  return selectedNodeIds.length ? selectedNodeIds : [nodeId];
}

/**
 * 创建剪贴板片段。
 *
 * @param input - 输入参数。
 * @returns 创建后的结果对象。
 */
export function createClipboardFragment(input: {
  host: Pick<LeaferGraphEditingReadHost, "findLinksByNode" | "getNodeSnapshot">;
  nodeIds: readonly string[];
}): LeaferGraphContextMenuClipboardFragment | null {
  const snapshots = input.nodeIds
    .map((nodeId) => input.host.getNodeSnapshot(nodeId))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (!snapshots.length) {
    return null;
  }

  const copiedNodeIds = new Set(snapshots.map((entry) => entry.id));
  const linksById = new Map<string, ReturnType<typeof input.host.findLinksByNode>[number]>();

  for (const nodeId of copiedNodeIds) {
    for (const link of input.host.findLinksByNode(nodeId)) {
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
}

/**
 * 写入剪贴板片段。
 *
 * @param input - 输入参数。
 * @returns 写入剪贴板片段的结果。
 */
export function writeClipboardFragment(input: {
  clipboard: LeaferGraphContextMenuClipboardState;
  host: Pick<LeaferGraphEditingReadHost, "findLinksByNode" | "getNodeSnapshot">;
  nodeIds: readonly string[];
}): LeaferGraphContextMenuClipboardFragment | null {
  const fragment = createClipboardFragment({
    host: input.host,
    nodeIds: input.nodeIds
  });
  if (!fragment) {
    input.clipboard.clear();
    return null;
  }

  input.clipboard.setFragment(fragment);
  return fragment;
}

/**
 * 粘贴剪贴板片段。
 *
 * @param input - 输入参数。
 * @returns 新创建的节点 ID 列表。
 */
export function pasteClipboardFragment(input: {
  fragment: LeaferGraphContextMenuClipboardFragment;
  host: Pick<LeaferGraphEditingReadHost, "setSelectedNodeIds">;
  createNode: (input: LeaferGraphCreateNodeInput) => NodeRuntimeState;
  createLink: (input: LeaferGraphCreateLinkInput) => GraphLink;
  anchorPoint?: LeaferGraphEditingPoint;
  offset?: LeaferGraphEditingPoint;
  anchorToPoint?: boolean;
}): string[] {
  const offset = normalizeEditingPoint(input.offset) ?? DEFAULT_PASTE_OFFSET;
  const origin = resolveFragmentOrigin(input.fragment);
  const targetOrigin =
    input.anchorToPoint !== false && input.anchorPoint
      ? {
          x: input.anchorPoint.x + offset.x,
          y: input.anchorPoint.y + offset.y
        }
      : {
          x: origin.x + offset.x,
          y: origin.y + offset.y
        };
  const delta = {
    x: targetOrigin.x - origin.x,
    y: targetOrigin.y - origin.y
  };
  const nodeIdMap = new Map<string, string>();
  const createdNodeIds: string[] = [];

  for (const snapshot of input.fragment.nodes) {
    const nextNodeInput = createCreateNodeInputFromNodeSnapshot(snapshot);
    const createdNode = input.createNode({
      ...nextNodeInput,
      id: undefined,
      x: snapshot.layout.x + delta.x,
      y: snapshot.layout.y + delta.y
    });
    nodeIdMap.set(snapshot.id, createdNode.id);
    createdNodeIds.push(createdNode.id);
  }

  for (const link of input.fragment.links) {
    const sourceNodeId = nodeIdMap.get(link.source.nodeId);
    const targetNodeId = nodeIdMap.get(link.target.nodeId);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    input.createLink({
      source: {
        nodeId: sourceNodeId,
        slot: link.source.slot
      },
      target: {
        nodeId: targetNodeId,
        slot: link.target.slot
      }
    });
  }

  input.host.setSelectedNodeIds(createdNodeIds, "replace");
  return createdNodeIds;
}

/**
 * 归一化编辑点位。
 *
 * @param point - 原始点位。
 * @returns 可复用点位；非法时返回 `null`。
 */
function normalizeEditingPoint(
  point: LeaferGraphEditingPoint | null | undefined
): LeaferGraphEditingPoint | null {
  if (!point) {
    return null;
  }

  return Number.isFinite(point.x) && Number.isFinite(point.y)
    ? {
        x: point.x,
        y: point.y
      }
    : null;
}

/**
 * 解析片段原点。
 *
 * @param fragment - 片段。
 * @returns 处理后的结果。
 */
function resolveFragmentOrigin(fragment: LeaferGraphContextMenuClipboardFragment): {
  x: number;
  y: number;
} {
  const [firstNode] = fragment.nodes;
  if (!firstNode) {
    return { x: 0, y: 0 };
  }

  return fragment.nodes.reduce(
    (current, node) => ({
      x: Math.min(current.x, node.layout.x),
      y: Math.min(current.y, node.layout.y)
    }),
    {
      x: firstNode.layout.x,
      y: firstNode.layout.y
    }
  );
}
