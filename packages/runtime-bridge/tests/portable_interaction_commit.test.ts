import { describe, expect, test } from "bun:test";

import {
  createGraphOperationsFromClipboardFragment,
  createGraphOperationsFromInteractionCommit
} from "../src/portable/index.js";

describe("runtime bridge portable helper", () => {
  test("node.move.commit 应翻译成多条 node.move 正式操作", () => {
    const operations = createGraphOperationsFromInteractionCommit(
      {
        type: "node.move.commit",
        entries: [
          {
            nodeId: "node-a",
            before: { x: 0, y: 0 },
            after: { x: 12, y: 24 }
          },
          {
            nodeId: "node-b",
            before: { x: 24, y: 36 },
            after: { x: 48, y: 60 }
          }
        ]
      },
      {
        source: "test.bridge",
        timestamp: 100,
        operationIdPrefix: "bridge-move"
      }
    );

    expect(operations).toEqual([
      {
        type: "node.move",
        nodeId: "node-a",
        input: {
          x: 12,
          y: 24
        },
        operationId: "bridge-move:0",
        timestamp: 100,
        source: "test.bridge"
      },
      {
        type: "node.move",
        nodeId: "node-b",
        input: {
          x: 48,
          y: 60
        },
        operationId: "bridge-move:1",
        timestamp: 100,
        source: "test.bridge"
      }
    ]);
  });

  test("六类交互提交都应映射到稳定的正式操作结构", () => {
    const resizeOperation = createGraphOperationsFromInteractionCommit(
      {
        type: "node.resize.commit",
        nodeId: "node-a",
        before: { width: 120, height: 80 },
        after: { width: 160, height: 96 }
      },
      {
        timestamp: 200,
        operationIdPrefix: "resize"
      }
    );
    const linkCreateOperation = createGraphOperationsFromInteractionCommit(
      {
        type: "link.create.commit",
        input: {
          id: "link-1",
          source: {
            nodeId: "node-a",
            slot: 0
          },
          target: {
            nodeId: "node-b",
            slot: 0
          }
        }
      },
      {
        timestamp: 201,
        operationIdPrefix: "link"
      }
    );
    const collapseOperation = createGraphOperationsFromInteractionCommit(
      {
        type: "node.collapse.commit",
        nodeId: "node-a",
        beforeCollapsed: false,
        afterCollapsed: true
      },
      {
        timestamp: 202,
        operationIdPrefix: "collapse"
      }
    );
    const widgetOperation = createGraphOperationsFromInteractionCommit(
      {
        type: "node.widget.commit",
        nodeId: "node-a",
        widgetIndex: 2,
        beforeValue: "before",
        afterValue: {
          label: "after"
        },
        beforeWidgets: [],
        afterWidgets: []
      },
      {
        timestamp: 203,
        operationIdPrefix: "widget"
      }
    );
    const renameOperation = createGraphOperationsFromInteractionCommit(
      {
        type: "node.rename.commit",
        nodeId: "node-a",
        beforeTitle: "Before",
        afterTitle: "After"
      },
      {
        timestamp: 204,
        operationIdPrefix: "rename"
      }
    );

    expect(resizeOperation).toEqual([
      {
        type: "node.resize",
        nodeId: "node-a",
        input: {
          width: 160,
          height: 96
        },
        operationId: "resize:0",
        timestamp: 200,
        source: "interaction.commit"
      }
    ]);
    expect(linkCreateOperation).toEqual([
      {
        type: "link.create",
        input: {
          id: "link-1",
          source: {
            nodeId: "node-a",
            slot: 0
          },
          target: {
            nodeId: "node-b",
            slot: 0
          }
        },
        operationId: "link:0",
        timestamp: 201,
        source: "interaction.commit"
      }
    ]);
    expect(collapseOperation).toEqual([
      {
        type: "node.collapse",
        nodeId: "node-a",
        collapsed: true,
        operationId: "collapse:0",
        timestamp: 202,
        source: "interaction.commit"
      }
    ]);
    expect(widgetOperation).toEqual([
      {
        type: "node.widget.value.set",
        nodeId: "node-a",
        widgetIndex: 2,
        value: {
          label: "after"
        },
        operationId: "widget:0",
        timestamp: 203,
        source: "interaction.commit"
      }
    ]);
    expect(renameOperation).toEqual([
      {
        type: "node.rename",
        nodeId: "node-a",
        title: "After",
        beforeTitle: "Before",
        operationId: "rename:0",
        timestamp: 204,
        source: "interaction.commit"
      }
    ]);
  });

  test("clipboard 片段应翻译成稳定的 node.create / link.create 操作", () => {
    const result = createGraphOperationsFromClipboardFragment(
      {
        nodes: [
          {
            id: "source-node",
            type: "demo/source",
            title: "Source",
            layout: {
              x: 12,
              y: 24,
              width: 120,
              height: 80
            },
            widgets: [],
            properties: {},
            inputs: [],
            outputs: [],
            flags: {}
          },
          {
            id: "target-node",
            type: "demo/target",
            title: "Target",
            layout: {
              x: 120,
              y: 36,
              width: 120,
              height: 80
            },
            widgets: [],
            properties: {},
            inputs: [],
            outputs: [],
            flags: {}
          }
        ],
        links: [
          {
            id: "link-1",
            source: {
              nodeId: "source-node",
              slot: "out"
            },
            target: {
              nodeId: "target-node",
              slot: "in"
            }
          }
        ]
      },
      {
        source: "test.clipboard",
        timestamp: 300,
        operationIdPrefix: "clipboard",
        offset: {
          x: 10,
          y: 20
        },
        createNodeId: (_snapshot, index) => `node-copy-${index + 1}`,
        createLinkId: (_link, index) => `link-copy-${index + 1}`
      }
    );

    expect(result.createdNodeIds).toEqual(["node-copy-1", "node-copy-2"]);
    expect(result.createdLinkIds).toEqual(["link-copy-1"]);
    expect(result.operations).toEqual([
      {
        type: "node.create",
        input: {
          id: "node-copy-1",
          type: "demo/source",
          title: "Source",
          x: 22,
          y: 44,
          width: 120,
          height: 80,
          properties: {},
          inputs: [],
          outputs: [],
          widgets: [],
          flags: {}
        },
        operationId: "clipboard:node:0",
        timestamp: 300,
        source: "test.clipboard"
      },
      {
        type: "node.create",
        input: {
          id: "node-copy-2",
          type: "demo/target",
          title: "Target",
          x: 130,
          y: 56,
          width: 120,
          height: 80,
          properties: {},
          inputs: [],
          outputs: [],
          widgets: [],
          flags: {}
        },
        operationId: "clipboard:node:1",
        timestamp: 300,
        source: "test.clipboard"
      },
      {
        type: "link.create",
        input: {
          id: "link-copy-1",
          source: {
            nodeId: "node-copy-1",
            slot: "out"
          },
          target: {
            nodeId: "node-copy-2",
            slot: "in"
          }
        },
        operationId: "clipboard:link:0",
        timestamp: 300,
        source: "test.clipboard"
      }
    ]);
  });
});
