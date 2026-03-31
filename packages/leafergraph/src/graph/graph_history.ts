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
} from "./graph_runtime_types";

let historyRecordSeed = 1;

export interface LeaferGraphHistorySource {
  emit(event: LeaferGraphHistoryEvent): void;
  subscribe(listener: (event: LeaferGraphHistoryEvent) => void): () => void;
  destroy(): void;
}

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

export function createHistoryResetEvent(
  reason: LeaferGraphHistoryResetReason
): LeaferGraphHistoryResetEvent {
  return {
    type: "history.reset",
    timestamp: Date.now(),
    reason
  };
}

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

export function createNodeCollapseHistoryRecord(options: {
  afterDocument: GraphDocument;
  nodeId: string;
  beforeCollapsed: boolean;
  afterCollapsed: boolean;
  source: string;
  label?: string;
}): LeaferGraphSnapshotHistoryRecord | null {
  if (options.beforeCollapsed === options.afterCollapsed) {
    return null;
  }

  const beforeDocument = structuredClone(options.afterDocument);
  const node = beforeDocument.nodes.find(
    (currentNode) => currentNode.id === options.nodeId
  );
  if (!node) {
    return null;
  }

  node.flags = node.flags ? structuredClone(node.flags) : {};
  if (options.beforeCollapsed) {
    node.flags.collapsed = true;
  } else {
    delete node.flags.collapsed;
  }

  return createSnapshotHistoryRecord({
    beforeDocument,
    afterDocument: options.afterDocument,
    source: options.source,
    label:
      options.label ??
      (options.afterCollapsed ? "Collapse Node" : "Expand Node")
  });
}

export function createNodeWidgetHistoryRecord(options: {
  afterDocument: GraphDocument;
  nodeId: string;
  beforeWidgets: NodeSerializeResult["widgets"];
  afterWidgets: NodeSerializeResult["widgets"];
  source: string;
  label?: string;
}): LeaferGraphSnapshotHistoryRecord | null {
  if (isStructurallyEqual(options.beforeWidgets, options.afterWidgets)) {
    return null;
  }

  const beforeDocument = structuredClone(options.afterDocument);
  const node = beforeDocument.nodes.find(
    (currentNode) => currentNode.id === options.nodeId
  );
  if (!node) {
    return null;
  }

  node.widgets = options.beforeWidgets ? structuredClone(options.beforeWidgets) : [];

  return createSnapshotHistoryRecord({
    beforeDocument,
    afterDocument: options.afterDocument,
    source: options.source,
    label: options.label ?? "Update Widget"
  });
}

export function createHistoryRecordEvent(record: LeaferGraphHistoryRecord): LeaferGraphHistoryEvent {
  return {
    type: "history.record",
    record
  };
}

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

function createHistoryRecordId(kind: LeaferGraphHistoryRecord["kind"]): string {
  const recordId = `history:${kind}:${Date.now()}:${historyRecordSeed}`;
  historyRecordSeed += 1;
  return recordId;
}

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

function isSamePoint(
  left: { x: number; y: number },
  right: { x: number; y: number }
): boolean {
  return left.x === right.x && left.y === right.y;
}

function isSameSize(
  left: { width: number; height: number },
  right: { width: number; height: number }
): boolean {
  return left.width === right.width && left.height === right.height;
}

function isSameLinkEndpoint(
  left: Pick<GraphLink["source"], "nodeId" | "slot">,
  right: Pick<GraphLink["source"], "nodeId" | "slot">
): boolean {
  return left.nodeId === right.nodeId && (left.slot ?? 0) === (right.slot ?? 0);
}

function isStructurallyEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}
