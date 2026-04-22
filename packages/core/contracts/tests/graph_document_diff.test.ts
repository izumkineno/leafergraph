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
  test("applyGraphDocumentDiffToDocument merges operations and fieldChanges", () => {
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

  test("applyGraphDocumentDiffToDocument supports node.collapse and node.widget.value.set operations", () => {
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

  test("applyGraphDocumentDiffToDocument rejects dangling link.create", () => {
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
    expect(result.reason).toContain("node not found");
    expect(result.document).toEqual(currentDocument);
    expect(result.document.links.map((link) => link.id)).toEqual(["link-1", "link-2"]);
  });

  test("applyGraphDocumentDiffToDocument rejects dangling link.reconnect", () => {
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
    expect(result.reason).toContain("slot not found");
    expect(result.document).toEqual(currentDocument);
    expect(result.document.links[0]).toEqual({
      id: "link-1",
      source: { nodeId: "node-1", slot: 0 },
      target: { nodeId: "node-2", slot: 0 }
    });
  });

  test("applyGraphDocumentDiffToDocument preserves node/link order on pure updates", () => {
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
          beforeTitle: "Node 1",
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

  test("applyGraphDocumentDiffToDocument keeps indexes valid across remove/create/link.create", () => {
    const currentDocument = createLinkedDocument();
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 6,
      operations: [
        {
          type: "node.remove",
          nodeId: "node-2",
          operationId: "diff-node-remove",
          timestamp: 1,
          source: "authority.documentDiff"
        },
        {
          type: "node.create",
          operationId: "diff-node-create",
          timestamp: 2,
          source: "authority.documentDiff",
          input: {
            id: "node-4",
            type: "demo/target",
            title: "Node 4",
            x: 480,
            y: 0,
            inputs: [{ name: "In" }]
          }
        },
        {
          type: "link.create",
          operationId: "diff-link-create",
          timestamp: 3,
          source: "authority.documentDiff",
          input: {
            id: "link-3",
            source: {
              nodeId: "node-1",
              slot: 0
            },
            target: {
              nodeId: "node-4",
              slot: 0
            }
          }
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(true);
    expect(result.document.nodes.map((node) => node.id)).toEqual([
      "node-1",
      "node-3",
      "node-4"
    ]);
    expect(result.document.links.map((link) => link.id)).toEqual(["link-3"]);
    expect(result.document.links[0]).toEqual({
      id: "link-3",
      source: { nodeId: "node-1", slot: 0 },
      target: { nodeId: "node-4", slot: 0 }
    });
  });

  test("successful apply does not mutate currentDocument", () => {
    const currentDocument = createTestDocument();
    const before = structuredClone(currentDocument);
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 7,
      operations: [
        {
          type: "node.move",
          nodeId: "node-1",
          input: { x: 10, y: 20 },
          operationId: "diff-node-move-immutability",
          timestamp: 1,
          source: "authority.documentDiff"
        }
      ],
      fieldChanges: [
        {
          type: "node.property.set",
          nodeId: "node-1",
          key: "intervalMs",
          value: 2000
        }
      ]
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(true);
    expect(currentDocument).toEqual(before);
    expect(currentDocument.nodes[0]?.layout).toEqual(before.nodes[0]?.layout);
    expect(currentDocument.nodes[0]?.properties).toEqual(before.nodes[0]?.properties);
    expect(result.document).not.toBe(currentDocument);
    expect(result.document.nodes).not.toBe(currentDocument.nodes);
    expect(result.document.links).not.toBe(currentDocument.links);
  });

  test("rejected apply does not mutate currentDocument", () => {
    const currentDocument = createLinkedDocument();
    const before = structuredClone(currentDocument);
    const diff: GraphDocumentDiff = {
      documentId: "diff-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 8,
      operations: [
        {
          type: "node.remove",
          nodeId: "node-2",
          operationId: "diff-node-remove-before-reject",
          timestamp: 1,
          source: "authority.documentDiff"
        },
        {
          type: "link.create",
          operationId: "diff-link-create-reject",
          timestamp: 2,
          source: "authority.documentDiff",
          input: {
            id: "link-3",
            source: {
              nodeId: "node-1",
              slot: 0
            },
            target: {
              nodeId: "node-2",
              slot: 0
            }
          }
        }
      ],
      fieldChanges: []
    };

    const result = applyGraphDocumentDiffToDocument(currentDocument, diff);

    expect(result.success).toBe(false);
    expect(currentDocument).toEqual(before);
    expect(result.document).toEqual(before);
    expect(result.document).not.toBe(currentDocument);
  });

  test("createCreateNodeInputFromNodeSnapshot preserves serializable fields", () => {
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

  test("createUpdateNodeInputFromNodeSnapshot builds a direct update payload", () => {
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
