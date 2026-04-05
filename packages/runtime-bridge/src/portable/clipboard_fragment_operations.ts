import type {
  GraphOperation,
  GraphOperationSource
} from "@leafergraph/contracts";
import { createCreateNodeInputFromNodeSnapshot } from "@leafergraph/contracts/graph-document-diff";
import type {
  GraphLink,
  NodeSerializeResult
} from "@leafergraph/node";

export interface RuntimeBridgeClipboardFragment {
  nodes: readonly NodeSerializeResult[];
  links: readonly GraphLink[];
}

export interface CreateGraphOperationsFromClipboardFragmentContext {
  index: number;
  kind: "node" | "link";
  source: GraphOperationSource;
  timestamp: number;
}

export interface CreateGraphOperationsFromClipboardFragmentOptions {
  source?: GraphOperationSource;
  timestamp?: number;
  operationIdPrefix?: string;
  offset?: {
    x: number;
    y: number;
  };
  anchorPoint?: {
    x: number;
    y: number;
  };
  anchorToPoint?: boolean;
  createOperationId?(
    context: CreateGraphOperationsFromClipboardFragmentContext
  ): string;
  createNodeId?(snapshot: NodeSerializeResult, index: number): string;
  createLinkId?(link: GraphLink, index: number): string;
}

export interface GraphOperationsFromClipboardFragmentResult {
  operations: GraphOperation[];
  createdNodeIds: string[];
  createdLinkIds: string[];
}

const DEFAULT_OFFSET = {
  x: 24,
  y: 24
} as const;

/**
 * 把剪贴板片段翻译成正式图操作。
 *
 * @param fragment - 当前剪贴板片段。
 * @param options - 操作生成控制项。
 * @returns 待提交的正式操作和派生 ID。
 */
export function createGraphOperationsFromClipboardFragment(
  fragment: RuntimeBridgeClipboardFragment,
  options: CreateGraphOperationsFromClipboardFragmentOptions = {}
): GraphOperationsFromClipboardFragmentResult {
  if (!fragment.nodes.length) {
    return {
      operations: [],
      createdNodeIds: [],
      createdLinkIds: []
    };
  }

  const source = options.source ?? "clipboard.fragment";
  const timestamp = options.timestamp ?? Date.now();
  const operationIdPrefix =
    options.operationIdPrefix ?? `${source}:clipboard:${timestamp}`;
  const createOperationId =
    options.createOperationId ??
    ((context: CreateGraphOperationsFromClipboardFragmentContext) =>
      `${operationIdPrefix}:${context.kind}:${context.index}`);
  const createNodeId =
    options.createNodeId ??
    ((_snapshot: NodeSerializeResult, index: number) => `node:${timestamp}:${index}`);
  const createLinkId =
    options.createLinkId ??
    ((_link: GraphLink, index: number) => `link:${timestamp}:${index}`);

  const offset = options.offset ?? DEFAULT_OFFSET;
  const origin = resolveFragmentOrigin(fragment);
  const targetOrigin =
    options.anchorPoint && options.anchorToPoint !== false
      ? {
          x: options.anchorPoint.x + offset.x,
          y: options.anchorPoint.y + offset.y
        }
      : {
          x: origin.x + offset.x,
          y: origin.y + offset.y
        };
  const delta = {
    x: targetOrigin.x - origin.x,
    y: targetOrigin.y - origin.y
  };

  const operations: GraphOperation[] = [];
  const nodeIdMap = new Map<string, string>();
  const createdNodeIds: string[] = [];
  const createdLinkIds: string[] = [];

  for (const [index, snapshot] of fragment.nodes.entries()) {
    const nodeId = createNodeId(snapshot, index);
    const nextNodeInput = createCreateNodeInputFromNodeSnapshot(snapshot);
    operations.push({
      type: "node.create",
      input: {
        ...nextNodeInput,
        id: nodeId,
        x: snapshot.layout.x + delta.x,
        y: snapshot.layout.y + delta.y
      },
      operationId: createOperationId({
        index,
        kind: "node",
        source,
        timestamp
      }),
      timestamp,
      source
    });
    nodeIdMap.set(snapshot.id, nodeId);
    createdNodeIds.push(nodeId);
  }

  for (const [index, link] of fragment.links.entries()) {
    const sourceNodeId = nodeIdMap.get(link.source.nodeId);
    const targetNodeId = nodeIdMap.get(link.target.nodeId);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    const linkId = createLinkId(link, index);
    operations.push({
      type: "link.create",
      input: {
        id: linkId,
        source: {
          nodeId: sourceNodeId,
          slot: link.source.slot
        },
        target: {
          nodeId: targetNodeId,
          slot: link.target.slot
        }
      },
      operationId: createOperationId({
        index,
        kind: "link",
        source,
        timestamp
      }),
      timestamp,
      source
    });
    createdLinkIds.push(linkId);
  }

  return {
    operations,
    createdNodeIds,
    createdLinkIds
  };
}

function resolveFragmentOrigin(fragment: RuntimeBridgeClipboardFragment): {
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
