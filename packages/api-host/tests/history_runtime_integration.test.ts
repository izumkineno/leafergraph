import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  NodeSerializeResult
} from "@leafergraph/core/node";
import type {
  GraphOperation,
  LeaferGraphHistoryEvent,
  LeaferGraphInteractionCommitEvent
} from "@leafergraph/core/contracts";

import { createTestHarness } from "./test_harness";
import { createTestGraphHarness } from "./test_graph";

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "history-runtime-doc",
    revision: 1,
    appKind: "history-runtime-test",
    nodes: [],
    links: []
  };
}

function createDocumentWithNodes(
  nodes: NodeSerializeResult[],
  revision: number
): GraphDocument {
  return {
    documentId: "history-runtime-doc",
    revision,
    appKind: "history-runtime-test",
    nodes,
    links: []
  };
}

function createReconnectOperation(
  linkId: string,
  targetNodeId: string
): GraphOperation {
  return {
    type: "link.reconnect",
    operationId: `test:link.reconnect:${linkId}:${targetNodeId}`,
    timestamp: Date.now(),
    source: "test",
    linkId,
    input: {
      target: {
        nodeId: targetNodeId,
        slot: 0
      }
    }
  };
}

describe("history_runtime_integration", () => {
  test("historySource 会按 operation / snapshot 分类正式变更", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });
    const records: Array<{
      kind: string;
      label?: string;
      source: string;
    }> = [];
    const unsubscribe = harness.runtime.historySource.subscribe((event: LeaferGraphHistoryEvent) => {
      if (event.type === "history.record") {
        records.push({
          kind: event.record.kind,
          label: event.record.label,
          source: event.record.source
        });
      }
    });

    try {
      harness.host.createNode({ id: "source-node", type: "test/source", x: 0, y: 0 });
      harness.host.createNode({ id: "target-a", type: "test/target", x: 280, y: 0 });
      harness.host.createNode({ id: "target-b", type: "test/target", x: 560, y: 0 });
      harness.host.moveNode("source-node", { x: 40, y: 24 });
      harness.host.updateNode("source-node", { title: "Source Updated" });
      harness.host.setNodeCollapsed("target-a", true);
      const link = harness.host.createLink({
        source: { nodeId: "source-node", slot: 0 },
        target: { nodeId: "target-a", slot: 0 }
      });
      harness.host.applyGraphOperation(createReconnectOperation(link.id, "target-b"));
      harness.host.removeLink(link.id);
      harness.host.removeNode("target-b");

      expect(records).toEqual([
        { kind: "operation", label: "Create Node", source: "api" },
        { kind: "operation", label: "Create Node", source: "api" },
        { kind: "operation", label: "Create Node", source: "api" },
        { kind: "operation", label: "Move Node", source: "api" },
        { kind: "snapshot", label: "Update Node", source: "api" },
        { kind: "operation", label: "Collapse Node", source: "api" },
        { kind: "operation", label: "Create Link", source: "api" },
        { kind: "operation", label: "Reconnect Link", source: "test" },
        { kind: "operation", label: "Remove Link", source: "api" },
        { kind: "snapshot", label: "Remove Node", source: "api" }
      ]);
    } finally {
      unsubscribe();
    }
  });

  test("replaceGraphDocument 和 applyGraphDocumentDiff 会发出 history.reset", () => {
    const { graph } = createTestGraphHarness({ document: createEmptyDocument() });
    const resetReasons: string[] = [];
    const unsubscribe = graph.subscribeHistory((event) => {
      if (event.type === "history.reset") {
        resetReasons.push(event.reason);
      }
    });

    try {
      const initialDocument = createDocumentWithNodes(
        [
          {
            id: "source-node",
            type: "test/source",
            title: "Source",
            layout: {
              x: 0,
              y: 0,
              width: 160,
              height: 80
            },
            outputs: [{ name: "out" }]
          }
        ],
        2
      );
      graph.replaceGraphDocument(initialDocument);

      const nextDocument = createDocumentWithNodes(
        [
          {
            id: "source-node",
            type: "test/source",
            title: "Source",
            layout: {
              x: 180,
              y: 60,
              width: 160,
              height: 80
            },
            outputs: [{ name: "out" }]
          }
        ],
        3
      );
      const diffResult = graph.applyGraphDocumentDiff(
        {
          documentId: "history-runtime-doc",
          baseRevision: 2,
          revision: 3,
          emittedAt: Date.now(),
          operations: [
            {
              type: "node.move",
              operationId: "diff:node.move:source-node",
              timestamp: Date.now(),
              source: "authority",
              nodeId: "source-node",
              input: {
                x: 180,
                y: 60
              }
            }
          ],
          fieldChanges: []
        },
        nextDocument
      );

      expect(diffResult.success).toBe(true);
      expect(diffResult.requiresFullReplace).toBe(false);
      expect(resetReasons).toEqual(["replace-document", "apply-document-diff"]);
    } finally {
      unsubscribe();
    }
  });

  test("setNodeCollapsed 和 setNodeWidgetValue 应生成 operation history 与 undo/redo", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });
    harness.host.createNode({
      id: "widget-node",
      type: "test/target",
      x: 120,
      y: 80,
      widgets: [
        {
          type: "test/raw-widget",
          name: "value",
          value: 1
        }
      ]
    });

    const records: any[] = [];
    const unsubscribe = harness.runtime.historySource.subscribe((event) => {
      if (event.type === "history.record") {
        records.push(event.record);
      }
    });

    try {
      harness.host.setNodeCollapsed("widget-node", true);
      harness.host.setNodeWidgetValue("widget-node", 0, 2);

      const collapseRecord = records[0];
      const widgetRecord = records[1];
      expect(records).toHaveLength(2);
      expect(collapseRecord).toMatchObject({
        kind: "operation",
        label: "Collapse Node",
        source: "api"
      });
      expect(collapseRecord.undoOperations).toEqual([
        {
          type: "node.collapse",
          nodeId: "widget-node",
          collapsed: false,
          operationId: collapseRecord.undoOperations[0].operationId,
          timestamp: collapseRecord.undoOperations[0].timestamp,
          source: "history.undo"
        }
      ]);
      expect(collapseRecord.redoOperations).toEqual([
        {
          type: "node.collapse",
          nodeId: "widget-node",
          collapsed: true,
          operationId: collapseRecord.redoOperations[0].operationId,
          timestamp: collapseRecord.redoOperations[0].timestamp,
          source: "history.redo"
        }
      ]);
      expect(widgetRecord).toMatchObject({
        kind: "operation",
        label: "Update Widget",
        source: "api"
      });
      expect(widgetRecord.undoOperations).toEqual([
        {
          type: "node.widget.value.set",
          nodeId: "widget-node",
          widgetIndex: 0,
          value: 1,
          operationId: widgetRecord.undoOperations[0].operationId,
          timestamp: widgetRecord.undoOperations[0].timestamp,
          source: "history.undo"
        }
      ]);
      expect(widgetRecord.redoOperations).toEqual([
        {
          type: "node.widget.value.set",
          nodeId: "widget-node",
          widgetIndex: 0,
          value: 2,
          operationId: widgetRecord.redoOperations[0].operationId,
          timestamp: widgetRecord.redoOperations[0].timestamp,
          source: "history.redo"
        }
      ]);
      expect(harness.host.getNodeSnapshot("widget-node")?.widgets?.[0]?.value).toBe(2);
    } finally {
      unsubscribe();
    }
  });

  test("link.create.commit 会在本地自动落图并发出 history.record", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });
    const historyEvents: LeaferGraphHistoryEvent[] = [];
    const unsubscribe = harness.runtime.historySource.subscribe((event) => {
      historyEvents.push(event);
    });

    try {
      harness.host.createNode({ id: "source-node", type: "test/source", x: 0, y: 0 });
      harness.host.createNode({ id: "target-node", type: "test/target", x: 320, y: 0 });

      harness.state.emitInteractionCommit({
        type: "link.create.commit",
        input: {
          source: { nodeId: "source-node", slot: 0 },
          target: { nodeId: "target-node", slot: 0 }
        }
      } as LeaferGraphInteractionCommitEvent);

      const links = [...harness.state.links.values()].filter(
        (link) => link.source.nodeId === "source-node"
      );
      expect(links).toHaveLength(1);
      expect(
        historyEvents.some(
          (event) =>
            event.type === "history.record" &&
            event.record.kind === "operation" &&
            event.record.source === "interaction.commit" &&
            event.record.label === "Create Link"
        )
      ).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  test("node.widget.commit 会继续发出并写入 operation history", () => {
    const harness = createTestHarness({ document: createEmptyDocument() });
    harness.host.createNode({
      id: "widget-node",
      type: "test/target",
      x: 80,
      y: 40,
      widgets: [
        {
          type: "test/raw-widget",
          name: "value",
          value: 1
        }
      ]
    });

    const interactionEvents: LeaferGraphInteractionCommitEvent[] = [];
    const historyRecords: any[] = [];
    const unsubscribeInteraction = harness.runtime.interactionCommitSource.subscribe((event) => {
      interactionEvents.push(event);
    });
    const unsubscribeHistory = harness.runtime.historySource.subscribe((event) => {
      if (event.type === "history.record") {
        historyRecords.push(event.record);
      }
    });

    try {
      harness.state.emitInteractionCommit({
        type: "node.widget.commit",
        nodeId: "widget-node",
        widgetIndex: 0,
        beforeValue: 1,
        afterValue: 2,
        beforeWidgets: [
          {
            type: "test/raw-widget",
            name: "value",
            value: 1
          }
        ],
        afterWidgets: [
          {
            type: "test/raw-widget",
            name: "value",
            value: 2
          }
        ]
      } as LeaferGraphInteractionCommitEvent);

      expect(interactionEvents).toEqual([
        {
          type: "node.widget.commit",
          nodeId: "widget-node",
          widgetIndex: 0,
          beforeValue: 1,
          afterValue: 2,
          beforeWidgets: [
            {
              type: "test/raw-widget",
              name: "value",
              value: 1
            }
          ],
          afterWidgets: [
            {
              type: "test/raw-widget",
              name: "value",
              value: 2
            }
          ]
        }
      ]);
      expect(historyRecords).toHaveLength(1);
      const historyRecord = historyRecords[0];
      expect(historyRecord).toMatchObject({
        kind: "operation",
        label: "Update Widget",
        source: "interaction.commit"
      });
      expect(historyRecord.undoOperations[0]).toMatchObject({
        type: "node.widget.value.set",
        nodeId: "widget-node",
        widgetIndex: 0,
        value: 1,
        source: "history.undo"
      });
      expect(historyRecord.redoOperations[0]).toMatchObject({
        type: "node.widget.value.set",
        nodeId: "widget-node",
        widgetIndex: 0,
        value: 2,
        source: "history.redo"
      });
    } finally {
      unsubscribeHistory();
      unsubscribeInteraction();
    }
  });
});
