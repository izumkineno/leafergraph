import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import {
  applyGraphDocumentDiffToDocument,
  type GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import { LeaferGraph } from "../src/index";

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

function createTestDocumentWithLink(): GraphDocument {
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
        outputs: [{ name: "out" }]
      },
      {
        id: "node-2",
        type: "demo/node",
        title: "Node 2",
        layout: {
          x: 240,
          y: 0,
          width: 120,
          height: 80
        },
        inputs: [{ name: "in" }]
      },
      {
        id: "node-3",
        type: "demo/node",
        title: "Node 3",
        layout: {
          x: 480,
          y: 0,
          width: 120,
          height: 80
        },
        inputs: [{ name: "in" }]
      }
    ],
    links: [
      {
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
    ]
  };
}

describe("graph_document_diff", () => {
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
      apiHost: {
        runWithoutHistoryCapture<T>(callback: () => T): T {
          return callback();
        },
        notifyHistoryReset() {}
      },
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

  test("LeaferGraph.applyGraphDocumentDiff 在 node.create 图元已存在时应回退到整图替换", () => {
    const currentDocument = createTestDocument();
    const nextDocument: GraphDocument = {
      ...currentDocument,
      revision: "2",
      nodes: [
        ...currentDocument.nodes,
        {
          id: "node-2",
          type: "demo/node",
          title: "Node 2",
          layout: {
            x: 240,
            y: 0,
            width: 120,
            height: 80
          }
        }
      ]
    };
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 2,
      operations: [
        {
          type: "node.create",
          operationId: "diff:node.create:node-2",
          timestamp: 2,
          source: "authority",
          input: {
            id: "node-2",
            type: "demo/node",
            x: 240,
            y: 0
          }
        }
      ],
      fieldChanges: []
    };

    let createNodeCalled = false;
    let historyResetCalls = 0;
    const fakeGraph = {
      apiHost: {
        runWithoutHistoryCapture<T>(callback: () => T): T {
          return callback();
        },
        notifyHistoryReset() {
          historyResetCalls += 1;
        },
        createNode() {
          createNodeCalled = true;
        }
      },
      nodeLayer: {
        findId(id: string) {
          return id === "node-node-2" ? { id } : undefined;
        }
      },
      linkLayer: {
        findId() {
          return undefined;
        }
      }
    } as unknown as LeaferGraph;

    const result = LeaferGraph.prototype.applyGraphDocumentDiff.call(
      fakeGraph,
      diff,
      nextDocument
    );

    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
    expect(result.reason).toBe("node.create 无法安全增量投影");
    expect(createNodeCalled).toBe(false);
    expect(historyResetCalls).toBe(0);
  });

  test("LeaferGraph.applyGraphDocumentDiff 在 link.reconnect 被拒绝时应回退到整图替换", () => {
    const currentDocument = createTestDocumentWithLink();
    const nextDocument: GraphDocument = {
      ...currentDocument,
      revision: "2",
      links: [
        {
          id: "link-1",
          source: {
            nodeId: "node-1",
            slot: 0
          },
          target: {
            nodeId: "node-3",
            slot: 0
          }
        }
      ]
    };
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 3,
      operations: [
        {
          type: "link.reconnect",
          operationId: "diff:link.reconnect:link-1",
          timestamp: 3,
          source: "authority",
          linkId: "link-1",
          input: {
            target: {
              nodeId: "node-3",
              slot: 0
            }
          }
        }
      ],
      fieldChanges: []
    };

    let historyResetCalls = 0;
    const fakeGraph = {
      apiHost: {
        runWithoutHistoryCapture<T>(callback: () => T): T {
          return callback();
        },
        notifyHistoryReset() {
          historyResetCalls += 1;
        },
        applyGraphOperation() {
          return {
            accepted: false,
            changed: false,
            operation: diff.operations[0],
            affectedNodeIds: [],
            affectedLinkIds: [],
            reason: "reject link reconnect"
          };
        }
      },
      nodeLayer: {
        findId() {
          return undefined;
        }
      },
      linkLayer: {
        findId(id: string) {
          return id === "graph-link-link-1" ? { id } : undefined;
        }
      }
    } as unknown as LeaferGraph;

    const result = LeaferGraph.prototype.applyGraphDocumentDiff.call(
      fakeGraph,
      diff,
      nextDocument
    );

    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
    expect(result.reason).toBe("reject link reconnect");
    expect(historyResetCalls).toBe(0);
  });
});
