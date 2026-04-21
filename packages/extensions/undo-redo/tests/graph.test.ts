import { describe, expect, it } from "bun:test";
import { bindLeaferGraphUndoRedo } from "../src/graph";
import type { LeaferGraphUndoRedoHost } from "../src/graph";
import type {
  GraphOperation,
  LeaferGraphHistoryEvent,
  LeaferGraphHistoryRecord
} from "@leafergraph/core/contracts";
import type { GraphDocument } from "@leafergraph/core/node";

describe("@leafergraph/extensions/undo-redo graph", () => {
  it("operation record 会被推入 controller，并可回放 undo/redo", () => {
    const host = createFakeHost();
    const binding = bindLeaferGraphUndoRedo({
      host
    });

    host.emitHistory({
      type: "history.record",
      record: {
        kind: "operation",
        recordId: "record-1",
        timestamp: 1,
        source: "api",
        label: "Move Node",
        undoOperations: [createOperation("node.move", "history.undo")],
        redoOperations: [createOperation("node.move", "history.redo")]
      }
    });

    expect(binding.controller.getState()).toMatchObject({
      canUndo: true,
      nextUndoLabel: "Move Node"
    });

    expect(binding.controller.undo()).toBe(true);
    expect(binding.controller.redo()).toBe(true);
    expect(host.appliedOperations.map((operation) => operation.source)).toEqual([
      "history.undo",
      "history.redo"
    ]);
  });

  it("snapshot record 会通过 replaceGraphDocument 回放", () => {
    const host = createFakeHost();
    const binding = bindLeaferGraphUndoRedo({
      host
    });

    host.emitHistory({
      type: "history.record",
      record: {
        kind: "snapshot",
        recordId: "record-2",
        timestamp: 2,
        source: "api",
        label: "Update Node",
        beforeDocument: createDocument("before"),
        afterDocument: createDocument("after")
      }
    });

    expect(binding.controller.undo()).toBe(true);
    expect(binding.controller.redo()).toBe(true);
    expect(host.replacedDocuments.map((document) => document.documentId)).toEqual([
      "before",
      "after"
    ]);
  });

  it("history.reset 默认会清空历史", () => {
    const host = createFakeHost();
    const binding = bindLeaferGraphUndoRedo({
      host
    });

    host.emitHistory(createRecordEvent("record-3"));
    expect(binding.controller.getState().canUndo).toBe(true);

    host.emitHistory({
      type: "history.reset",
      timestamp: 3,
      reason: "replace-document"
    });

    expect(binding.controller.getState()).toMatchObject({
      canUndo: false,
      canRedo: false
    });
  });

  it("resetOnDocumentSync: false 时不会自动清空历史", () => {
    const host = createFakeHost();
    const binding = bindLeaferGraphUndoRedo({
      host,
      config: {
        resetOnDocumentSync: false
      }
    });

    host.emitHistory(createRecordEvent("record-4"));
    host.emitHistory({
      type: "history.reset",
      timestamp: 4,
      reason: "apply-document-diff"
    });

    expect(binding.controller.getState()).toMatchObject({
      canUndo: true,
      nextUndoLabel: "Move Node"
    });
  });

  it("回放期间产生的新 history 事件不会被再次入栈", () => {
    const host = createFakeHost({
      onApplyOperation(operation) {
        host.emitHistory({
          type: "history.record",
          record: {
            kind: "operation",
            recordId: `replayed-${operation.operationId}`,
            timestamp: 5,
            source: operation.source,
            label: "Replay Noise",
            undoOperations: [createOperation("node.move", "history.undo")],
            redoOperations: [createOperation("node.move", "history.redo")]
          }
        });
      }
    });
    const binding = bindLeaferGraphUndoRedo({
      host
    });

    host.emitHistory(createRecordEvent("record-5"));
    expect(binding.controller.undo()).toBe(true);

    expect(binding.controller.getState()).toMatchObject({
      canUndo: false,
      canRedo: true,
      redoCount: 1
    });
  });

  it("maxEntries 会传递给 controller", () => {
    const host = createFakeHost();
    const binding = bindLeaferGraphUndoRedo({
      host,
      config: {
        maxEntries: 1
      }
    });

    host.emitHistory(createRecordEvent("record-6"));
    host.emitHistory(createRecordEvent("record-7"));

    expect(binding.controller.getState()).toMatchObject({
      undoCount: 1,
      nextUndoLabel: "Move Node"
    });
  });
});

function createFakeHost(options?: {
  onApplyOperation?(operation: GraphOperation): void;
}): LeaferGraphUndoRedoHost & {
  emitHistory(event: LeaferGraphHistoryEvent): void;
  appliedOperations: GraphOperation[];
  replacedDocuments: GraphDocument[];
} {
  const listeners = new Set<(event: LeaferGraphHistoryEvent) => void>();
  const host = {
    appliedOperations: [] as GraphOperation[],
    replacedDocuments: [] as GraphDocument[],
    subscribeHistory(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    emitHistory(event: LeaferGraphHistoryEvent) {
      for (const listener of listeners) {
        listener(structuredClone(event));
      }
    },
    applyGraphOperation(operation: GraphOperation) {
      host.appliedOperations.push(structuredClone(operation));
      options?.onApplyOperation?.(operation);
      return {
        accepted: true,
        changed: true,
        operation,
        affectedNodeIds: [],
        affectedLinkIds: []
      };
    },
    replaceGraphDocument(document: GraphDocument) {
      host.replacedDocuments.push(structuredClone(document));
    }
  };

  return host;
}

function createRecordEvent(recordId: string): {
  type: "history.record";
  record: LeaferGraphHistoryRecord;
} {
  return {
    type: "history.record",
    record: {
      kind: "operation",
      recordId,
      timestamp: 1,
      source: "api",
      label: "Move Node",
      undoOperations: [createOperation("node.move", "history.undo")],
      redoOperations: [createOperation("node.move", "history.redo")]
    }
  };
}

function createDocument(documentId: string): GraphDocument {
  return {
    documentId,
    revision: 1,
    appKind: "undo-redo-test",
    nodes: [],
    links: []
  };
}

function createOperation(
  type: GraphOperation["type"],
  source: string
): GraphOperation {
  switch (type) {
    case "node.move":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        nodeId: "node-1",
        input: {
          x: 10,
          y: 20
        }
      };
    case "node.resize":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        nodeId: "node-1",
        input: {
          width: 100,
          height: 60
        }
      };
    case "node.create":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        input: {
          id: "node-1",
          type: "test/node",
          x: 0,
          y: 0
        }
      };
    case "node.update":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        nodeId: "node-1",
        input: {
          title: "Node"
        }
      };
    case "node.remove":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        nodeId: "node-1"
      };
    case "document.update":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        input: {
          appKind: "patched"
        }
      };
    case "link.create":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        input: {
          id: "link-1",
          source: {
            nodeId: "node-1",
            slot: 0
          },
          target: {
            nodeId: "node-2",
            slot: 0
          }
        }
      };
    case "link.remove":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        linkId: "link-1"
      };
    case "link.reconnect":
      return {
        type,
        operationId: `${source}:${type}`,
        timestamp: 1,
        source,
        linkId: "link-1",
        input: {
          target: {
            nodeId: "node-3",
            slot: 0
          }
        }
      };
  }
}
