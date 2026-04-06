import { describe, expect, it } from "bun:test";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import type {
  GraphLink,
  NodeRuntimeState,
  NodeSerializeResult
} from "@leafergraph/node";
import { createLeaferGraphContextMenuClipboardStore } from "../src/clipboard_store";
import {
  createClipboardFragment,
  createLeaferGraphEditingController
} from "../src/editing";

describe("@leafergraph/context-menu-builtins/editing", () => {
  it("createClipboardFragment 只保留选中节点之间的内部连线", () => {
    const harness = createEditingHarness();

    const fragment = createClipboardFragment({
      host: harness.host,
      nodeIds: ["node-1", "node-2"]
    });

    expect(fragment?.nodes.map((node) => node.id)).toEqual(["node-1", "node-2"]);
    expect(fragment?.links.map((link) => link.id)).toEqual(["link-1"]);
  });

  it("copySelection 和 cutSelection 会处理空选区与非空选区", () => {
    const emptyHarness = createEditingHarness({
      selectedNodeIds: []
    });

    expect(emptyHarness.controller.canCopySelection()).toBe(false);
    expect(emptyHarness.controller.canCutSelection()).toBe(false);
    expect(emptyHarness.controller.copySelection()).toBeNull();
    expect(emptyHarness.controller.cutSelection()).toBeNull();
    expect(emptyHarness.clipboard.hasFragment()).toBe(false);

    const harness = createEditingHarness({
      selectedNodeIds: ["node-1", "node-2"]
    });

    const copiedFragment = harness.controller.copySelection();

    expect(copiedFragment?.nodes.map((node) => node.id)).toEqual(["node-1", "node-2"]);
    expect(copiedFragment?.links.map((link) => link.id)).toEqual(["link-1"]);
    expect(harness.clipboard.getFragment()?.nodes.map((node) => node.id)).toEqual([
      "node-1",
      "node-2"
    ]);

    const cutFragment = harness.controller.cutSelection();

    expect(cutFragment?.nodes.map((node) => node.id)).toEqual(["node-1", "node-2"]);
    expect(harness.removedNodeGroups).toEqual([["node-1", "node-2"]]);
    expect(harness.removedSingleNodeIds).toEqual([]);
    expect(harness.getSelectedNodeIds()).toEqual([]);
  });

  it("pasteClipboard 在提供锚点时会按锚点加偏移落点，并替换选区", () => {
    const harness = createEditingHarness();

    harness.clipboard.setFragment(
      createFragment([
        createSnapshot("node-1", 40, 20),
        createSnapshot("node-2", 120, 80)
      ], [createLink("link-1", "node-1", "node-2")])
    );

    const createdNodeIds = harness.controller.pasteClipboard({
      anchorPoint: {
        x: 240,
        y: 160
      }
    });

    expect(createdNodeIds).toEqual(["created-node-1", "created-node-2"]);
    expect(harness.createdNodes).toMatchObject([
      {
        type: "system/on-play",
        x: 264,
        y: 184
      },
      {
        type: "system/on-play",
        x: 344,
        y: 244
      }
    ]);
    expect(harness.createdLinks).toEqual([
      {
        source: {
          nodeId: "created-node-1",
          slot: "start"
        },
        target: {
          nodeId: "created-node-2",
          slot: "start"
        }
      }
    ]);
    expect(harness.getSelectedNodeIds()).toEqual(["created-node-1", "created-node-2"]);
  });

  it("pasteClipboard 在没有锚点时会沿用片段原点加偏移", () => {
    const harness = createEditingHarness();

    harness.clipboard.setFragment(
      createFragment([
        createSnapshot("node-1", 40, 20),
        createSnapshot("node-2", 120, 80)
      ])
    );

    const createdNodeIds = harness.controller.pasteClipboard();

    expect(createdNodeIds).toEqual(["created-node-1", "created-node-2"]);
    expect(harness.createdNodes).toMatchObject([
      {
        x: 64,
        y: 44
      },
      {
        x: 144,
        y: 104
      }
    ]);
  });

  it("duplicateNodeIds 在 anchorToPoint 为 false 时保持固定偏移", () => {
    const harness = createEditingHarness();

    const createdNodeIds = harness.controller.duplicateNodeIds(["node-1", "node-2"], {
      anchorPoint: {
        x: 500,
        y: 360
      },
      anchorToPoint: false
    });

    expect(createdNodeIds).toEqual(["created-node-1", "created-node-2"]);
    expect(harness.createdNodes).toMatchObject([
      {
        x: 64,
        y: 44
      },
      {
        x: 144,
        y: 104
      }
    ]);
  });

  it("缺少 removeNodes 时会回退到逐个 removeNode", () => {
    const harness = createEditingHarness({
      selectedNodeIds: ["node-1", "node-2"],
      omitRemoveNodes: true
    });

    const fragment = harness.controller.cutSelection();

    expect(fragment?.nodes.map((node) => node.id)).toEqual(["node-1", "node-2"]);
    expect(harness.removedNodeGroups).toEqual([]);
    expect(harness.removedSingleNodeIds).toEqual(["node-1", "node-2"]);
    expect(harness.getSelectedNodeIds()).toEqual([]);
  });
});

function createEditingHarness(options?: {
  selectedNodeIds?: string[];
  omitRemoveNodes?: boolean;
}) {
  const createdNodes: LeaferGraphCreateNodeInput[] = [];
  const createdLinks: LeaferGraphCreateLinkInput[] = [];
  const removedSingleNodeIds: string[] = [];
  const removedNodeGroups: string[][] = [];
  const clipboard = createLeaferGraphContextMenuClipboardStore();
  const snapshots = new Map<string, NodeSerializeResult>([
    ["node-1", createSnapshot("node-1", 40, 20)],
    ["node-2", createSnapshot("node-2", 120, 80)],
    ["node-3", createSnapshot("node-3", 320, 200)]
  ]);
  const links: GraphLink[] = [
    createLink("link-1", "node-1", "node-2"),
    createLink("link-2", "node-1", "node-3")
  ];
  let nodeSeed = 0;
  let selectedNodeIds = [...(options?.selectedNodeIds ?? ["node-1"])];

  const host = {
    listSelectedNodeIds() {
      return [...selectedNodeIds];
    },
    setSelectedNodeIds(
      nodeIds: readonly string[],
      mode: LeaferGraphSelectionUpdateMode = "replace"
    ) {
      if (mode === "replace") {
        selectedNodeIds = [...nodeIds];
      } else if (mode === "add") {
        selectedNodeIds = [...new Set([...selectedNodeIds, ...nodeIds])];
      } else {
        const removedIds = new Set(nodeIds);
        selectedNodeIds = selectedNodeIds.filter((nodeId) => !removedIds.has(nodeId));
      }

      return [...selectedNodeIds];
    },
    getNodeSnapshot(nodeId: string) {
      return snapshots.get(nodeId);
    },
    findLinksByNode(nodeId: string) {
      return links.filter(
        (link) => link.source.nodeId === nodeId || link.target.nodeId === nodeId
      );
    }
  };

  const controller = createLeaferGraphEditingController({
    host,
    clipboard,
    mutationAdapters: {
      createNode(input) {
        createdNodes.push(input);
        nodeSeed += 1;
        return {
          id: `created-node-${nodeSeed}`,
          type: input.type,
          title: input.title ?? String(input.type),
          layout: {
            x: input.x,
            y: input.y
          }
        } as NodeRuntimeState;
      },
      createLink(input) {
        createdLinks.push(input);
        return {
          id: `created-link-${createdLinks.length}`,
          source: input.source,
          target: input.target
        } as GraphLink;
      },
      removeNode(nodeId) {
        removedSingleNodeIds.push(nodeId);
      },
      ...(options?.omitRemoveNodes
        ? {}
        : {
            removeNodes(nodeIds: readonly string[]) {
              removedNodeGroups.push([...nodeIds]);
            }
          })
    }
  });

  return {
    clipboard,
    controller,
    createdLinks,
    createdNodes,
    getSelectedNodeIds() {
      return [...selectedNodeIds];
    },
    host,
    removedNodeGroups,
    removedSingleNodeIds
  };
}

function createFragment(
  nodes: NodeSerializeResult[],
  links: GraphLink[] = []
) {
  return {
    nodes,
    links
  };
}

function createSnapshot(
  id: string,
  x: number,
  y: number,
  type = "system/on-play"
): NodeSerializeResult {
  return {
    id,
    type,
    title: `${id} title`,
    layout: {
      x,
      y,
      width: 180,
      height: 96
    },
    properties: {},
    inputs: [],
    outputs: [],
    widgets: [],
    flags: {}
  } as NodeSerializeResult;
}

function createLink(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceSlot = "start",
  targetSlot = "start"
): GraphLink {
  return {
    id,
    source: {
      nodeId: sourceNodeId,
      slot: sourceSlot
    },
    target: {
      nodeId: targetNodeId,
      slot: targetSlot
    }
  } as GraphLink;
}
