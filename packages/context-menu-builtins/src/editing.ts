import { createCreateNodeInputFromNodeSnapshot } from "@leafergraph/contracts/graph-document-diff";
import type { LeaferContextMenuContext } from "@leafergraph/context-menu";
import type {
  LeaferGraphContextMenuBuiltinFeatureRegistrationContext,
  LeaferGraphContextMenuBuiltinsHost,
  LeaferGraphContextMenuClipboardFragment,
  LeaferGraphContextMenuClipboardState
} from "./types";

const DEFAULT_PASTE_OFFSET = {
  x: 24,
  y: 24
} as const;

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
  host: Pick<
    LeaferGraphContextMenuBuiltinsHost,
    "findLinksByNode" | "getNodeSnapshot"
  >;
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
  host: Pick<
    LeaferGraphContextMenuBuiltinsHost,
    "findLinksByNode" | "getNodeSnapshot"
  >;
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
 * @returns 粘贴剪贴板片段的结果。
 */
export function pasteClipboardFragment(input: {
  fragment: LeaferGraphContextMenuClipboardFragment;
  host: Pick<LeaferGraphContextMenuBuiltinsHost, "setSelectedNodeIds">;
  createNode: LeaferGraphContextMenuBuiltinFeatureRegistrationContext["createNode"];
  createLink: LeaferGraphContextMenuBuiltinFeatureRegistrationContext["createLink"];
  context: Pick<LeaferContextMenuContext, "pagePoint" | "worldPoint">;
  offset?: {
    x: number;
    y: number;
  };
  anchorToContextWorldPoint?: boolean;
}): string[] {
  // 先整理当前阶段需要的输入、状态与依赖。
  const offset = input.offset ?? DEFAULT_PASTE_OFFSET;
  const origin = resolveFragmentOrigin(input.fragment);
  const anchorPoint =
    (Number.isFinite(input.context.pagePoint.x) &&
      Number.isFinite(input.context.pagePoint.y))
      ? input.context.pagePoint
      : input.context.worldPoint;
  const targetOrigin =
    input.anchorToContextWorldPoint !== false && anchorPoint
      ? {
          x: anchorPoint.x + offset.x,
          y: anchorPoint.y + offset.y
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
    const createdNode = input.createNode(
      {
        ...nextNodeInput,
        id: undefined,
        x: snapshot.layout.x + delta.x,
        y: snapshot.layout.y + delta.y
      },
      input.context as LeaferContextMenuContext
    );
    // 再执行核心逻辑，并把结果或副作用统一收口。
    nodeIdMap.set(snapshot.id, createdNode.id);
    createdNodeIds.push(createdNode.id);
  }

  for (const link of input.fragment.links) {
    const sourceNodeId = nodeIdMap.get(link.source.nodeId);
    const targetNodeId = nodeIdMap.get(link.target.nodeId);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    input.createLink(
      {
        source: {
          nodeId: sourceNodeId,
          slot: link.source.slot
        },
        target: {
          nodeId: targetNodeId,
          slot: link.target.slot
        }
      },
      input.context as LeaferContextMenuContext
    );
  }

  input.host.setSelectedNodeIds(createdNodeIds, "replace");
  return createdNodeIds;
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
