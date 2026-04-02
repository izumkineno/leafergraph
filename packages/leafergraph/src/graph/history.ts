import { serializeNode, type GraphDocument, type GraphLink, type NodeRegistry, type NodeSerializeResult } from "@leafergraph/node";
import type {
  GraphOperation,
  LeaferGraphHistoryEvent,
  LeaferGraphHistoryRecord,
  LeaferGraphHistoryResetEvent,
  LeaferGraphHistoryResetReason,
  LeaferGraphNodeMoveCommitEntry,
  LeaferGraphOperationHistoryRecord,
  LeaferGraphSnapshotHistoryRecord
} from "@leafergraph/contracts";
import { createCreateNodeInputFromNodeSnapshot } from "@leafergraph/contracts/graph-document-diff";
import type {
  GraphDocumentRootState,
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "./types";

let historyRecordSeed = 1;

export interface LeaferGraphHistorySource {
  emit(event: LeaferGraphHistoryEvent): void;
  subscribe(listener: (event: LeaferGraphHistoryEvent) => void): () => void;
  destroy(): void;
}

/**
 * 创建LeaferGraph 历史来源。
 *
 * @returns 创建后的结果对象。
 */
export function createLeaferGraphHistorySource(): LeaferGraphHistorySource {
  const listeners = new Set<(event: LeaferGraphHistoryEvent) => void>();

  return {
    emit(event) {
      if (!listeners.size) {
        return;
      }

      const snapshot = structuredClone(event);
      for (const listener of listeners) {
        listener(snapshot);
      }
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      listeners.clear();
    }
  };
}

/**
 * 处理 `serializeRuntimeGraphDocument` 相关逻辑。
 *
 * @param nodeRegistry - 节点注册表。
 * @param graphState - 当前状态。
 * @returns 处理后的结果。
 */
export function serializeRuntimeGraphDocument<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  nodeRegistry: NodeRegistry,
  graphState: GraphRuntimeState<TNodeState>
): GraphDocument {
  return {
    ...cloneGraphDocumentRootState(graphState.document),
    nodes: [...graphState.nodes.values()].map((node) =>
      serializeNode(nodeRegistry, node)
    ),
    links: [...graphState.links.values()].map((link) => structuredClone(link))
  };
}

/**
 * 克隆图文档根节点状态。
 *
 * @param document - 文档。
 * @returns 处理后的结果。
 */
export function cloneGraphDocumentRootState(
  document: GraphDocumentRootState
): GraphDocumentRootState {
  return {
    documentId: document.documentId,
    revision: document.revision,
    appKind: document.appKind,
    meta: document.meta ? structuredClone(document.meta) : undefined,
    capabilityProfile: document.capabilityProfile
      ? structuredClone(document.capabilityProfile)
      : undefined,
    adapterBinding: document.adapterBinding
      ? structuredClone(document.adapterBinding)
      : undefined
  };
}

/**
 * 创建历史`Reset` 事件。
 *
 * @param reason - `reason`。
 * @returns 创建后的结果对象。
 */
export function createHistoryResetEvent(
  reason: LeaferGraphHistoryResetReason
): LeaferGraphHistoryResetEvent {
  return {
    type: "history.reset",
    timestamp: Date.now(),
    reason
  };
}

/**
 * 创建快照历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createSnapshotHistoryRecord(options: {
  beforeDocument: GraphDocument;
  afterDocument: GraphDocument;
  source: string;
  label?: string;
}): LeaferGraphSnapshotHistoryRecord | null {
  if (isStructurallyEqual(options.beforeDocument, options.afterDocument)) {
    return null;
  }

  return {
    kind: "snapshot",
    recordId: createHistoryRecordId("snapshot"),
    timestamp: Date.now(),
    source: options.source,
    label: options.label,
    beforeDocument: structuredClone(options.beforeDocument),
    afterDocument: structuredClone(options.afterDocument)
  };
}

/**
 * 创建节点创建历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeCreateHistoryRecord(options: {
  nodeSnapshot: NodeSerializeResult;
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord {
  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Create Node",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "node.remove",
        nodeId: options.nodeSnapshot.id
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "node.create",
        input: createCreateNodeInputFromNodeSnapshot(options.nodeSnapshot)
      })
    ]
  });
}

/**
 * 创建节点`Move` 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeMoveHistoryRecord(options: {
  nodeId: string;
  before: { x: number; y: number };
  after: { x: number; y: number };
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord | null {
  if (isSamePoint(options.before, options.after)) {
    return null;
  }

  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Move Node",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "node.move",
        nodeId: options.nodeId,
        input: structuredClone(options.before)
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "node.move",
        nodeId: options.nodeId,
        input: structuredClone(options.after)
      })
    ]
  });
}

/**
 * 创建节点`Resize` 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeResizeHistoryRecord(options: {
  nodeId: string;
  before: { width: number; height: number };
  after: { width: number; height: number };
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord | null {
  if (isSameSize(options.before, options.after)) {
    return null;
  }

  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Resize Node",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "node.resize",
        nodeId: options.nodeId,
        input: structuredClone(options.before)
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "node.resize",
        nodeId: options.nodeId,
        input: structuredClone(options.after)
      })
    ]
  });
}

/**
 * 处理 `createNodeMoveCommitHistoryRecord` 相关逻辑。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeMoveCommitHistoryRecord(options: {
  entries: readonly LeaferGraphNodeMoveCommitEntry[];
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord | null {
  const entries = options.entries.filter(
    (entry) => !isSamePoint(entry.before, entry.after)
  );
  if (!entries.length) {
    return null;
  }

  return createOperationHistoryRecord({
    source: options.source,
    label:
      options.label ?? (entries.length > 1 ? "Move Nodes" : "Move Node"),
    undoOperations: entries.map((entry) =>
      createGraphOperation("history.undo", {
        type: "node.move",
        nodeId: entry.nodeId,
        input: structuredClone(entry.before)
      })
    ),
    redoOperations: entries.map((entry) =>
      createGraphOperation("history.redo", {
        type: "node.move",
        nodeId: entry.nodeId,
        input: structuredClone(entry.after)
      })
    )
  });
}

/**
 * 创建连线创建历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createLinkCreateHistoryRecord(options: {
  link: GraphLink;
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord {
  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Create Link",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "link.remove",
        linkId: options.link.id
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "link.create",
        input: structuredClone(options.link)
      })
    ]
  });
}

/**
 * 创建连线`Remove` 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createLinkRemoveHistoryRecord(options: {
  link: GraphLink;
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord {
  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Remove Link",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "link.create",
        input: structuredClone(options.link)
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "link.remove",
        linkId: options.link.id
      })
    ]
  });
}

/**
 * 创建连线`Reconnect` 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createLinkReconnectHistoryRecord(options: {
  linkId: string;
  before: Pick<GraphLink, "source" | "target">;
  after: Pick<GraphLink, "source" | "target">;
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord | null {
  if (
    isSameLinkEndpoint(options.before.source, options.after.source) &&
    isSameLinkEndpoint(options.before.target, options.after.target)
  ) {
    return null;
  }

  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Reconnect Link",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "link.reconnect",
        linkId: options.linkId,
        input: structuredClone(options.before)
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "link.reconnect",
        linkId: options.linkId,
        input: structuredClone(options.after)
      })
    ]
  });
}

/**
 * 创建节点`Collapse` 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeCollapseHistoryRecord(options: {
  nodeId: string;
  beforeCollapsed: boolean;
  afterCollapsed: boolean;
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord | null {
  if (options.beforeCollapsed === options.afterCollapsed) {
    return null;
  }

  return createOperationHistoryRecord({
    source: options.source,
    label:
      options.label ??
      (options.afterCollapsed ? "Collapse Node" : "Expand Node"),
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "node.collapse",
        nodeId: options.nodeId,
        collapsed: options.beforeCollapsed
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "node.collapse",
        nodeId: options.nodeId,
        collapsed: options.afterCollapsed
      })
    ]
  });
}

/**
 * 创建节点 Widget 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeWidgetHistoryRecord(options: {
  nodeId: string;
  widgetIndex: number;
  beforeValue: unknown;
  afterValue: unknown;
  source: string;
  label?: string;
}): LeaferGraphOperationHistoryRecord | null {
  if (isStructurallyEqual(options.beforeValue, options.afterValue)) {
    return null;
  }

  return createOperationHistoryRecord({
    source: options.source,
    label: options.label ?? "Update Widget",
    undoOperations: [
      createGraphOperation("history.undo", {
        type: "node.widget.value.set",
        nodeId: options.nodeId,
        widgetIndex: options.widgetIndex,
        value: structuredClone(options.beforeValue)
      })
    ],
    redoOperations: [
      createGraphOperation("history.redo", {
        type: "node.widget.value.set",
        nodeId: options.nodeId,
        widgetIndex: options.widgetIndex,
        value: structuredClone(options.afterValue)
      })
    ]
  });
}

/**
 * 创建历史记录事件。
 *
 * @param record - 记录。
 * @returns 创建后的结果对象。
 */
export function createHistoryRecordEvent(record: LeaferGraphHistoryRecord): LeaferGraphHistoryEvent {
  return {
    type: "history.record",
    record
  };
}

/**
 * 创建`Operation` 历史记录。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
function createOperationHistoryRecord(options: {
  source: string;
  undoOperations: GraphOperation[];
  redoOperations: GraphOperation[];
  label?: string;
}): LeaferGraphOperationHistoryRecord {
  return {
    kind: "operation",
    recordId: createHistoryRecordId("operation"),
    timestamp: Date.now(),
    source: options.source,
    label: options.label,
    undoOperations: structuredClone(options.undoOperations),
    redoOperations: structuredClone(options.redoOperations)
  };
}

/**
 * 创建历史记录 ID。
 *
 * @param kind - `kind`。
 * @returns 创建后的结果对象。
 */
function createHistoryRecordId(kind: LeaferGraphHistoryRecord["kind"]): string {
  const recordId = `history:${kind}:${Date.now()}:${historyRecordSeed}`;
  historyRecordSeed += 1;
  return recordId;
}

/**
 * 创建图`Operation`。
 *
 * @param source - 当前来源对象。
 * @param input - 输入参数。
 * @returns 创建后的结果对象。
 */
function createGraphOperation(
  source: string,
  input: GraphOperationInput
): GraphOperation {
  return {
    ...input,
    operationId: `history-op:${input.type}:${Date.now()}:${historyRecordSeed}`,
    timestamp: Date.now(),
    source
  } as GraphOperation;
}

type GraphOperationInput = {
  [TType in GraphOperation["type"]]: Omit<
    Extract<GraphOperation, { type: TType }>,
    "operationId" | "timestamp" | "source"
  >;
}[GraphOperation["type"]];

/**
 * 判断是否为`Same` 坐标。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function isSamePoint(
  left: { x: number; y: number },
  right: { x: number; y: number }
): boolean {
  return left.x === right.x && left.y === right.y;
}

/**
 * 处理 `isSameSize` 相关逻辑。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function isSameSize(
  left: { width: number; height: number },
  right: { width: number; height: number }
): boolean {
  return left.width === right.width && left.height === right.height;
}

/**
 * 处理 `isSameLinkEndpoint` 相关逻辑。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function isSameLinkEndpoint(
  left: Pick<GraphLink["source"], "nodeId" | "slot">,
  right: Pick<GraphLink["source"], "nodeId" | "slot">
): boolean {
  return left.nodeId === right.nodeId && (left.slot ?? 0) === (right.slot ?? 0);
}

/**
 * 处理 `isStructurallyEqual` 相关逻辑。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function isStructurallyEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}
