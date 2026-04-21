import { describe, expect, it } from "bun:test";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/core/contracts";
import type {
  GraphLink,
  NodeRuntimeState,
  NodeSerializeResult
} from "@leafergraph/core/node";
import type {
  LeaferContextMenuContext,
  LeaferContextMenuItem,
  LeaferContextMenuResolver
} from "@leafergraph/extensions/context-menu";
import {
  registerLeaferGraphContextMenuBuiltins,
  type LeaferGraphContextMenuBuiltinsHost
} from "../src/index";

describe("@leafergraph/extensions/context-menu-builtins", () => {
  it("默认会注册常用 builtins resolver", () => {
    const menu = new FakeMenu();
    const host = createFakeHost();
    const history = createFakeHistory();

    const dispose = registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      history
    });

    expect(menu.keys()).toEqual([
      "builtin:canvasUndo:canvas-undo",
      "builtin:canvasRedo:canvas-redo",
      "builtin:canvasSelectAll:canvas-select-all",
      "builtin:canvasControls:canvas-controls",
      "builtin:canvasAddNode:canvas-add-node",
      "builtin:canvasPaste:canvas-paste",
      "builtin:canvasDeleteSelection:canvas-delete-selection",
      "builtin:nodeRunFromHere:node-run-from-here",
      "builtin:nodeCopy:node-copy",
      "builtin:nodeCut:node-cut",
      "builtin:nodeDuplicate:node-duplicate",
      "builtin:nodeDelete:node-delete",
      "builtin:linkDelete:link-delete"
    ]);

    dispose();
    expect(menu.keys()).toEqual([]);
  });

  it("可以通过显式 false 关闭默认启用的功能", () => {
    const menu = new FakeMenu();
    const host = createFakeHost();

    registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      features: {
        canvasUndo: false,
        nodeCopy: false,
        linkDelete: false
      }
    });

    expect(menu.keys()).not.toContain("builtin:canvasUndo:canvas-undo");
    expect(menu.keys()).not.toContain("builtin:nodeCopy:node-copy");
    expect(menu.keys()).not.toContain("builtin:linkDelete:link-delete");
    expect(menu.keys()).toContain("builtin:nodeDelete:node-delete");
  });

  it("节点复制后可以在画布粘贴节点和片段内连线", () => {
    const menu = new FakeMenu();
    const host = createFakeHost();

    registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      resolveShortcutLabel(actionId) {
        switch (actionId) {
          case "graph.copy":
            return "Ctrl+C";
          case "graph.paste":
            return "Ctrl+V";
          default:
            return undefined;
        }
      }
    });

    const nodeItems = menu.resolve(createContext("node", "node-1"));
    const copyItem = findActionItem(nodeItems, "builtin-node-copy");
    expect(copyItem?.disabled).toBe(false);
    expect(copyItem?.shortcut).toBe("Ctrl+C");
    copyItem?.onSelect?.(createContext("node", "node-1"));

    const pasteContext = createContext("canvas", undefined, {
      pagePoint: {
        x: 240,
        y: 160
      }
    });
    const canvasItems = menu.resolve(pasteContext);
    const pasteItem = findActionItem(canvasItems, "builtin-canvas-paste");
    expect(pasteItem?.disabled).toBe(false);
    expect(pasteItem?.shortcut).toBe("Ctrl+V");
    pasteItem?.onSelect?.(pasteContext);

    expect(host.createdNodes).toHaveLength(1);
    expect(host.createdNodes[0]).toMatchObject({
      type: "system/on-play",
      x: 264,
      y: 184
    });
    expect(host.createdLinks).toHaveLength(1);
    expect(host.createdLinks[0]).toMatchObject({
      source: {
        nodeId: "created-node-1",
        slot: "start"
      },
      target: {
        nodeId: "created-node-1",
        slot: "start"
      }
    });
    expect(host.listSelectedNodeIds()).toEqual(["created-node-1"]);
  });

  it("节点删除会优先调用批量 removeNodes", () => {
    const menu = new FakeMenu();
    const host = createFakeHost({
      selectedNodeIds: ["node-1", "node-2"]
    });

    registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      features: {
        nodeDelete: true
      }
    });

    const nodeItems = menu.resolve(createContext("node", "node-1"));
    const deleteItem = findActionItem(nodeItems, "builtin-node-delete");
    deleteItem?.onSelect?.(createContext("node", "node-1"));

    expect(host.removedNodeGroups).toEqual([["node-1", "node-2"]]);
    expect(host.removedSingleNodeIds).toEqual([]);
  });

  it("从注册表添加节点会优先使用 pagePoint，避免缩放后的坐标漂移", () => {
    const menu = new FakeMenu();
    const host = createFakeHost();

    registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      features: {
        canvasAddNode: true
      }
    });

    const canvasContext = createContext("canvas", undefined, {
      pagePoint: {
        x: 360,
        y: 220
      },
      worldPoint: {
        x: 520,
        y: 340
      }
    });
    const canvasItems = menu.resolve(canvasContext);
    const addNodeItem = canvasItems.find(
      (item): item is Extract<LeaferContextMenuItem, { kind: "submenu" }> =>
        "key" in item &&
        item.key === "builtin-canvas-add-node" &&
        item.kind === "submenu"
    );
    const categoryItem = addNodeItem?.children?.find(
      (item): item is Extract<LeaferContextMenuItem, { kind: "submenu" }> =>
        "key" in item && item.kind === "submenu"
    );
    const nodeItem = findActionItem(categoryItem?.children ?? [], "builtin-canvas-add-node:system/on-play");

    nodeItem?.onSelect?.(canvasContext);

    expect(host.createdNodes).toHaveLength(1);
    expect(host.createdNodes[0]).toMatchObject({
      type: "system/on-play",
      x: 360,
      y: 220
    });
  });

  it("缺少 removeNodes 时会回退到逐个 removeNode", () => {
    const menu = new FakeMenu();
    const host = createFakeHost({
      selectedNodeIds: ["node-1", "node-2"],
      omitRemoveNodes: true
    });

    registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      features: {
        nodeDelete: true
      }
    });

    const nodeItems = menu.resolve(createContext("node", "node-1"));
    const deleteItem = findActionItem(nodeItems, "builtin-node-delete");
    deleteItem?.onSelect?.(createContext("node", "node-1"));

    expect(host.removedNodeGroups).toEqual([]);
    expect(host.removedSingleNodeIds).toEqual(["node-1", "node-2"]);
  });

  it("画布控制和从节点运行会转发到宿主", () => {
    const menu = new FakeMenu();
    const host = createFakeHost();

    registerLeaferGraphContextMenuBuiltins(menu as never, {
      host,
      features: {
        canvasControls: true,
        nodeRunFromHere: true
      }
    });

    const canvasItems = menu.resolve(createContext("canvas"));
    const controlsItem = canvasItems.find(
      (item): item is Extract<LeaferContextMenuItem, { kind: "submenu" }> =>
        "key" in item &&
        item.key === "builtin-canvas-controls" &&
        item.kind === "submenu"
    );
    const playItem = findActionItem(controlsItem?.children ?? [], "builtin-canvas-controls-play");
    const stepItem = findActionItem(controlsItem?.children ?? [], "builtin-canvas-controls-step");
    const stopItem = findActionItem(controlsItem?.children ?? [], "builtin-canvas-controls-stop");
    const fitItem = findActionItem(controlsItem?.children ?? [], "builtin-canvas-controls-fit");

    const canvasContext = createContext("canvas");
    playItem?.onSelect?.(canvasContext);
    stepItem?.onSelect?.(canvasContext);
    stopItem?.onSelect?.(canvasContext);
    fitItem?.onSelect?.(canvasContext);

    const nodeItems = menu.resolve(createContext("node", "node-1"));
    const runItem = findActionItem(nodeItems, "builtin-node-run-from-here");
    runItem?.onSelect?.(createContext("node", "node-1"));

    expect(host.playCount).toBe(1);
    expect(host.stepCount).toBe(1);
    expect(host.stopCount).toBe(1);
    expect(host.fitCount).toBe(1);
    expect(host.playedFromNodeIds).toEqual(["node-1"]);
  });
});

class FakeMenu {
  private readonly resolvers = new Map<string, LeaferContextMenuResolver>();

  registerResolver(key: string, resolver: LeaferContextMenuResolver): () => void {
    this.resolvers.set(key, resolver);
    return () => {
      this.resolvers.delete(key);
    };
  }

  keys(): string[] {
    return [...this.resolvers.keys()];
  }

  resolve(context: LeaferContextMenuContext): LeaferContextMenuItem[] {
    const items: LeaferContextMenuItem[] = [];
    for (const resolver of this.resolvers.values()) {
      items.push(...(resolver(context) ?? []));
    }
    return items;
  }
}

function createContext(
  kind: LeaferContextMenuContext["target"]["kind"],
  id?: string,
  points?: {
    pagePoint?: {
      x: number;
      y: number;
    };
    worldPoint?: {
      x: number;
      y: number;
    };
  }
): LeaferContextMenuContext {
  return {
    container: document.body,
    host: document.body,
    target: {
      kind,
      id
    },
    triggerReason: "manual",
    pagePoint: points?.pagePoint ?? { x: 24, y: 24 },
    clientPoint: { x: 24, y: 24 },
    containerPoint: { x: 24, y: 24 },
    worldPoint: points?.worldPoint
  };
}

function findActionItem(
  items: LeaferContextMenuItem[],
  key: string
): Extract<LeaferContextMenuItem, { key: string }> | undefined {
  return items.find(
    (item): item is Extract<LeaferContextMenuItem, { key: string }> =>
      "key" in item &&
      item.key === key &&
      item.kind !== "separator" &&
      item.kind !== "submenu" &&
      item.kind !== "group"
  );
}

function createFakeHost(options?: {
  selectedNodeIds?: string[];
  omitRemoveNodes?: boolean;
}): LeaferGraphContextMenuBuiltinsHost & {
  createdNodes: LeaferGraphCreateNodeInput[];
  createdLinks: LeaferGraphCreateLinkInput[];
  removedSingleNodeIds: string[];
  removedNodeGroups: string[][];
  removedLinkIds: string[];
  playedFromNodeIds: string[];
  playCount: number;
  stepCount: number;
  stopCount: number;
  fitCount: number;
} {
  const createdNodes: LeaferGraphCreateNodeInput[] = [];
  const createdLinks: LeaferGraphCreateLinkInput[] = [];
  const removedSingleNodeIds: string[] = [];
  const removedNodeGroups: string[][] = [];
  const removedLinkIds: string[] = [];
  const playedFromNodeIds: string[] = [];
  let nodeSeed = 0;
  let selectedNodeIds = [...(options?.selectedNodeIds ?? [])];

  const snapshots = new Map<string, NodeSerializeResult>([
    [
      "node-1",
      {
        id: "node-1",
        type: "system/on-play",
        title: "Start Event",
        layout: {
          x: 40,
          y: 20,
          width: 180,
          height: 96
        },
        properties: {},
        inputs: [],
        outputs: [],
        widgets: [],
        flags: {}
      } as NodeSerializeResult
    ],
    [
      "node-2",
      {
        id: "node-2",
        type: "system/on-play",
        title: "Another Start",
        layout: {
          x: 120,
          y: 80,
          width: 180,
          height: 96
        },
        properties: {},
        inputs: [],
        outputs: [],
        widgets: [],
        flags: {}
      } as NodeSerializeResult
    ]
  ]);
  const links: GraphLink[] = [
    {
      id: "link-1",
      source: {
        nodeId: "node-1",
        slot: "start"
      },
      target: {
        nodeId: "node-1",
        slot: "start"
      }
    } as GraphLink
  ];

  const host: LeaferGraphContextMenuBuiltinsHost & {
    createdNodes: LeaferGraphCreateNodeInput[];
    createdLinks: LeaferGraphCreateLinkInput[];
    removedSingleNodeIds: string[];
    removedNodeGroups: string[][];
    removedLinkIds: string[];
    playedFromNodeIds: string[];
    playCount: number;
    stepCount: number;
    stopCount: number;
    fitCount: number;
  } = {
    createdNodes,
    createdLinks,
    removedSingleNodeIds,
    removedNodeGroups,
    removedLinkIds,
    playedFromNodeIds,
    playCount: 0,
    stepCount: 0,
    stopCount: 0,
    fitCount: 0,
    listNodes() {
      return [
        {
          type: "system/on-play",
          title: "Start Event",
          category: "System"
        }
      ];
    },
    listNodeIds() {
      return [...snapshots.keys()];
    },
    getNodeSnapshot(nodeId: string) {
      return snapshots.get(nodeId);
    },
    findLinksByNode(nodeId: string) {
      return nodeId === "node-1" ? links : [];
    },
    isNodeSelected(nodeId: string) {
      return selectedNodeIds.includes(nodeId);
    },
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
    createNode(input: LeaferGraphCreateNodeInput, _context: LeaferContextMenuContext) {
      createdNodes.push(input);
      nodeSeed += 1;
      const id = `created-node-${nodeSeed}`;
      snapshots.set(
        id,
        {
          id,
          type: input.type,
          title: input.title ?? String(input.type),
          layout: {
            x: input.x,
            y: input.y,
            width: input.width ?? 180,
            height: input.height ?? 96
          },
          properties: input.properties ?? {},
          inputs: [],
          outputs: [],
          widgets: [],
          flags: input.flags ?? {}
        } as NodeSerializeResult
      );
      return {
        id,
        type: input.type,
        title: input.title ?? String(input.type),
        layout: {
          x: input.x,
          y: input.y
        }
      } as NodeRuntimeState;
    },
    createLink(input: LeaferGraphCreateLinkInput, _context: LeaferContextMenuContext) {
      createdLinks.push(input);
      return {
        id: `created-link-${createdLinks.length}`,
        source: input.source,
        target: input.target
      } as GraphLink;
    },
    play(_context: LeaferContextMenuContext) {
      host.playCount += 1;
    },
    step(_context: LeaferContextMenuContext) {
      host.stepCount += 1;
    },
    stop(_context: LeaferContextMenuContext) {
      host.stopCount += 1;
    },
    fitView(_context: LeaferContextMenuContext) {
      host.fitCount += 1;
    },
    playFromNode(nodeId: string, _context: LeaferContextMenuContext) {
      playedFromNodeIds.push(nodeId);
    },
    removeNode(nodeId: string, _context: LeaferContextMenuContext) {
      removedSingleNodeIds.push(nodeId);
    },
    removeLink(linkId: string, _context: LeaferContextMenuContext) {
      removedLinkIds.push(linkId);
    }
  };

  if (!options?.omitRemoveNodes) {
    host.removeNodes = (nodeIds: readonly string[], _context: LeaferContextMenuContext) => {
      removedNodeGroups.push([...nodeIds]);
    };
  }

  return host;
}

function createFakeHistory(options?: {
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const state = {
    undoCount: 0,
    redoCount: 0,
    canUndo: options?.canUndo ?? true,
    canRedo: options?.canRedo ?? true
  };

  return {
    get undoCount() {
      return state.undoCount;
    },
    get redoCount() {
      return state.redoCount;
    },
    undo() {
      state.undoCount += 1;
      return state.canUndo;
    },
    redo() {
      state.redoCount += 1;
      return state.canRedo;
    },
    canUndo() {
      return state.canUndo;
    },
    canRedo() {
      return state.canRedo;
    }
  };
}
