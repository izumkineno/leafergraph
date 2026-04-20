import { describe, expect, test } from "bun:test";

import type { GraphDocument, NodeSerializeResult } from "@leafergraph/node";
import {
  applyGraphDocumentDiffToDocument,
  createCreateNodeInputFromNodeSnapshot,
  createUpdateNodeInputFromNodeSnapshot,
  type GraphDocumentDiff
} from "../src/graph_document_diff";

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

function createNodeSnapshot(): NodeSerializeResult {
  return {
    id: "node-1",
    type: "demo/node",
    title: "Node 1",
    layout: {
      x: 12,
      y: 24,
      width: 180,
      height: 96
    },
    properties: {
      subtitle: "demo",
      intervalMs: 500
    },
    propertySpecs: [
      {
        name: "intervalMs",
        type: "number",
        default: 500
      }
    ],
    inputs: [{ name: "Start", type: "event" }],
    outputs: [{ name: "Tick", type: "event" }],
    widgets: [
      {
        type: "number",
        name: "intervalMs",
        value: 500
      }
    ],
    data: {
      label: "payload"
    },
    flags: {
      pinned: true
    }
  };
}

describe("contracts graph_document_diff", () => {
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

  test("applyGraphDocumentDiffToDocument 应支持 node.collapse 与 node.widget.value.set 正式操作", () => {
    const currentDocument = createTestDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 2,
      operations: [
        {
          type: "node.collapse",
          nodeId: "node-1",
          collapsed: true,
          operationId: "diff-node-collapse",
          timestamp: 2,
          source: "authority.documentDiff"
        },
        {
          type: "node.widget.value.set",
          nodeId: "node-1",
          widgetIndex: 0,
          value: 250,
          operationId: "diff-node-widget-value",
          timestamp: 3,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(true);
    expect(result.requiresFullReplace).toBe(false);
    expect(result.affectedNodeIds).toEqual(["node-1"]);
    expect(result.document.nodes[0]?.flags?.collapsed).toBe(true);
    expect(result.document.nodes[0]?.widgets?.[0]?.value).toBe(250);
  });

  test("createCreateNodeInputFromNodeSnapshot 应保留展示字段与结构字段", () => {
    const snapshot = createNodeSnapshot();

    const result = createCreateNodeInputFromNodeSnapshot(snapshot);

    expect(result).toMatchObject({
      id: "node-1",
      type: "demo/node",
      title: "Node 1",
      x: 12,
      y: 24,
      width: 180,
      height: 96,
      properties: {
        subtitle: "demo",
        intervalMs: 500
      },
      data: {
        label: "payload"
      },
      flags: {
        pinned: true
      }
    });
    expect(result.inputs).toEqual([{ name: "Start", type: "event" }]);
    expect(result.outputs).toEqual([{ name: "Tick", type: "event" }]);
    expect(result.widgets?.[0]?.value).toBe(500);
  });

  test("createUpdateNodeInputFromNodeSnapshot 应生成可直接用于 updateNode 的补丁", () => {
    const snapshot = createNodeSnapshot();

    const result = createUpdateNodeInputFromNodeSnapshot(snapshot);

    expect(result).toMatchObject({
      title: "Node 1",
      x: 12,
      y: 24,
      width: 180,
      height: 96,
      properties: {
        subtitle: "demo",
        intervalMs: 500
      },
      data: {
        label: "payload"
      },
      flags: {
        pinned: true
      }
    });
    expect(result.inputs).toEqual([{ name: "Start", type: "event" }]);
    expect(result.outputs).toEqual([{ name: "Tick", type: "event" }]);
    expect(result.widgets?.[0]?.name).toBe("intervalMs");
  });
});
