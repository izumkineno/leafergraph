import { describe, expect, test } from "bun:test";

import type { GraphDocument, NodeSerializeResult } from "@leafergraph/core/node";
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
        inputs: [{ name: "In" }],
        outputs: [{ name: "Out" }],
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
        inputs: [{ name: "In" }],
        outputs: [{ name: "Out" }]
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

function createLinkedDocument(): GraphDocument {
  return {
    documentId: "diff-doc",
    revision: "1",
    appKind: "diff-test",
    nodes: [
      {
        id: "node-1",
        type: "demo/source",
        title: "Node 1",
        layout: { x: 0, y: 0, width: 120, height: 80 },
        outputs: [{ name: "Out" }]
      },
      {
        id: "node-2",
        type: "demo/middle",
        title: "Node 2",
        layout: { x: 160, y: 0, width: 120, height: 80 },
        inputs: [{ name: "In" }],
        outputs: [{ name: "Out" }]
      },
      {
        id: "node-3",
        type: "demo/target",
        title: "Node 3",
        layout: { x: 320, y: 0, width: 120, height: 80 },
        inputs: [{ name: "In" }]
      }
    ],
    links: [
      {
        id: "link-1",
        source: { nodeId: "node-1", slot: 0 },
        target: { nodeId: "node-2", slot: 0 }
      },
      {
        id: "link-2",
        source: { nodeId: "node-2", slot: 0 },
        target: { nodeId: "node-3", slot: 0 }
      }
    ]
  };
}

function createLinkedDocument(): GraphDocument {
  return {
    documentId: "diff-doc",
    revision: "1",
    appKind: "diff-test",
    nodes: [
      {
        id: "node-1",
        type: "demo/source",
        title: "Node 1",
        layout: { x: 0, y: 0, width: 120, height: 80 },
        outputs: [{ name: "Out" }]
      },
      {
        id: "node-2",
        type: "demo/middle",
        title: "Node 2",
        layout: { x: 160, y: 0, width: 120, height: 80 },
        inputs: [{ name: "In" }],
        outputs: [{ name: "Out" }]
      },
      {
        id: "node-3",
        type: "demo/target",
        title: "Node 3",
        layout: { x: 320, y: 0, width: 120, height: 80 },
        inputs: [{ name: "In" }]
      }
    ],
    links: [
      {
        id: "link-1",
        source: { nodeId: "node-1", slot: 0 },
        target: { nodeId: "node-2", slot: 0 }
      },
      {
        id: "link-2",
        source: { nodeId: "node-2", slot: 0 },
        target: { nodeId: "node-3", slot: 0 }
      }
    ]
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

  test("applyGraphDocumentDiffToDocument 应拒绝 dangling link.create", () => {
    const currentDocument = createLinkedDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 3,
      operations: [
        {
          type: "link.create",
          input: {
            id: "link-3",
            source: {
              nodeId: "missing-node",
              slot: 0
            },
            target: {
              nodeId: "node-2",
              slot: 0
            }
          },
          operationId: "diff-link-create-missing-source",
          timestamp: 4,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
    expect(result.document).toEqual(currentDocument);
    expect(result.document.links.map((link) => link.id)).toEqual(["link-1", "link-2"]);
  });

  test("applyGraphDocumentDiffToDocument 应拒绝 dangling link.reconnect", () => {
    const currentDocument = createLinkedDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 4,
      operations: [
        {
          type: "link.reconnect",
          linkId: "link-1",
          input: {
            target: {
              nodeId: "node-3",
              slot: 9
            }
          },
          operationId: "diff-link-reconnect-missing-slot",
          timestamp: 5,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
    expect(result.document).toEqual(currentDocument);
    expect(result.document.links[0]).toEqual({
      id: "link-1",
      source: { nodeId: "node-1", slot: 0 },
      target: { nodeId: "node-2", slot: 0 }
    });
  });

  test("applyGraphDocumentDiffToDocument 应在纯更新时保持 node/link 顺序", () => {
    const currentDocument = createLinkedDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 5,
      operations: [
        {
          type: "node.rename",
          nodeId: "node-1",
          title: "Node 1 Renamed",
          operationId: "diff-node-rename-order",
          timestamp: 6,
          source: "authority.documentDiff"
        },
        {
          type: "link.reconnect",
          linkId: "link-1",
          input: {
            target: {
              nodeId: "node-3",
              slot: 0
            }
          },
          operationId: "diff-link-reconnect-order",
          timestamp: 7,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(true);
    expect(result.document.nodes.map((node) => node.id)).toEqual([
      "node-1",
      "node-2",
      "node-3"
    ]);
    expect(result.document.links.map((link) => link.id)).toEqual(["link-1", "link-2"]);
    expect(result.document.nodes[0]?.title).toBe("Node 1 Renamed");
    expect(result.document.links[0]?.target).toEqual({
      nodeId: "node-3",
      slot: 0
    });
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

  test("applyGraphDocumentDiffToDocument 会拒绝写入 dangling link", () => {
    const currentDocument = createTestDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 3,
      operations: [
        {
          type: "link.create",
          input: {
            id: "link-2",
            source: {
              nodeId: "node-1",
              slot: 1
            },
            target: {
              nodeId: "node-2",
              slot: 0
            }
          },
          operationId: "diff-link-create-invalid",
          timestamp: 3,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(false);
    expect(result.requiresFullReplace).toBe(true);
    expect(result.reason).toContain("slot 不存在");
    expect(result.document).toEqual(currentDocument);
  });

  test("applyGraphDocumentDiffToDocument 会在纯更新时保持 node 和 link 顺序", () => {
    const currentDocument = createTestDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 4,
      operations: [
        {
          type: "node.rename",
          nodeId: "node-1",
          title: "Node 1 Updated",
          beforeTitle: "Node 1",
          operationId: "diff-node-rename",
          timestamp: 4,
          source: "authority.documentDiff"
        },
        {
          type: "link.reconnect",
          linkId: "link-1",
          input: {
            target: {
              nodeId: "node-2",
              slot: 0
            }
          },
          operationId: "diff-link-reconnect",
          timestamp: 5,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(true);
    expect(result.document.nodes.map((node) => node.id)).toEqual([
      "node-1",
      "node-2"
    ]);
    expect(result.document.links.map((link) => link.id)).toEqual(["link-1"]);
  });
});
