import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import { LeaferGraph } from "../src/index";
import {
  applyGraphDocumentDiffToDocument,
  type GraphDocumentDiff
} from "../src/api/graph_document_diff";

function createTestDocument(): GraphDocument {
  return {
    documentId: "diff-doc",
    revision: "1",
    appKind: "diff-test",
    nodes: [
      {
        id: "node-1",
        type: "demo/node",
        title: "Node 1",
        layout: {
          x: 0,
          y: 0,
          width: 120,
          height: 80
        },
        properties: {
          intervalMs: 1000
        },
        data: {
          label: "before"
        },
        flags: {
          pinned: false
        },
        widgets: [
          {
            type: "number",
            name: "intervalMs",
            value: 1000
          }
        ]
      }
    ],
    links: []
  };
}

describe("graph_document_diff", () => {
  test("applyGraphDocumentDiffToDocument 应合并 operations 和 fieldChanges", () => {
    const currentDocument = createTestDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 1,
      operations: [
        {
          type: "node.move",
          nodeId: "node-1",
          input: {
            x: 32,
            y: 48
          },
          operationId: "diff-node-move",
          timestamp: 1,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: [
        {
          type: "node.title.set",
          nodeId: "node-1",
          value: "Node 1 Updated"
        },
        {
          type: "node.property.set",
          nodeId: "node-1",
          key: "intervalMs",
          value: 500
        },
        {
          type: "node.data.set",
          nodeId: "node-1",
          key: "label",
          value: "after"
        },
        {
          type: "node.flag.set",
          nodeId: "node-1",
          key: "pinned",
          value: true
        },
        {
          type: "node.widget.value.set",
          nodeId: "node-1",
          widgetIndex: 0,
          value: 500
        }
      ]
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(true);
    expect(result.requiresFullReplace).toBe(false);
    expect(result.affectedNodeIds).toEqual(["node-1"]);
    expect(result.document.revision).toBe("2");
    expect(result.document.nodes[0]).toMatchObject({
      title: "Node 1 Updated",
      layout: {
        x: 32,
        y: 48
      },
      properties: {
        intervalMs: 500
      },
      data: {
        label: "after"
      },
      flags: {
        pinned: true
      }
    });
    expect(result.document.nodes[0]?.widgets?.[0]?.value).toBe(500);
  });

  test("LeaferGraph.applyGraphDocumentDiff 应优先走 widget value 快速更新", () => {
    const currentDocument = createTestDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 1,
      operations: [],
      fieldChanges: [
        {
          type: "node.widget.value.set",
          nodeId: "node-1",
          widgetIndex: 0,
          value: 250
        }
      ]
    };
    const mergedResult = applyGraphDocumentDiffToDocument(currentDocument, diff);
    expect(mergedResult.success).toBe(true);

    const widgetValueCalls: unknown[] = [];
    let updateNodeCalled = false;
    const fakeGraph = {
      nodeLayer: {
        findId(id: string) {
          return id === "widget-node-1-0" ? { id } : undefined;
        }
      },
      linkLayer: {
        findId() {
          return undefined;
        }
      },
      setNodeWidgetValue(nodeId: string, widgetIndex: number, value: unknown) {
        widgetValueCalls.push([nodeId, widgetIndex, value]);
      },
      updateNode() {
        updateNodeCalled = true;
        return undefined;
      },
      getNodeSnapshot() {
        return currentDocument.nodes[0];
      }
    } as unknown as LeaferGraph;

    const result = LeaferGraph.prototype.applyGraphDocumentDiff.call(
      fakeGraph,
      diff,
      mergedResult.document
    );

    expect(result.success).toBe(true);
    expect(result.requiresFullReplace).toBe(false);
    expect(result.affectedNodeIds).toEqual(["node-1"]);
    expect(widgetValueCalls).toEqual([["node-1", 0, 250]]);
    expect(updateNodeCalled).toBe(false);
  });
});
