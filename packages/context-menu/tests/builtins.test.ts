import { describe, expect, it, mock } from "bun:test";
import type {
  GraphLink,
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput
} from "leafergraph";

type TestMenuResolver = (context: TestMenuContext) => TestMenuItem[] | null | undefined;

interface TestMenuContext {
  container: HTMLElement;
  host: HTMLElement;
  target: {
    kind: "canvas" | "node" | "link";
    id?: string;
  };
  triggerReason: "manual";
  pagePoint: { x: number; y: number };
  clientPoint: { x: number; y: number };
  containerPoint: { x: number; y: number };
  worldPoint?: { x: number; y: number };
}

interface TestActionItem {
  key: string;
  label?: string;
  disabled?: boolean;
  onSelect?(context: TestMenuContext): void;
}

interface TestSeparatorItem {
  kind: "separator";
  key?: string;
}

type TestMenuItem = TestActionItem | TestSeparatorItem | {
  kind: "submenu";
  key: string;
  label?: string;
  children?: TestMenuItem[];
};

describe("@leafergraph/context-menu builtins", () => {
  it("只会注册显式启用的功能 resolver", async () => {
    const { registerLeaferContextMenuBuiltins } = await loadBuiltinsModule();
    const menu = new FakeMenu();
    const graph = createFakeGraph();

    const dispose = registerLeaferContextMenuBuiltins(menu as never, {
      graph: graph as LeaferGraph,
      features: {
        canvasControls: true,
        nodeDelete: true
      }
    });

    expect(menu.keys()).toEqual([
      "builtin:canvasControls:canvas-controls",
      "builtin:nodeDelete:node-delete"
    ]);

    dispose();
    expect(menu.keys()).toEqual([]);
  });

  it("节点复制后可以在画布粘贴节点和片段内连线", async () => {
    const { registerLeaferContextMenuBuiltins } = await loadBuiltinsModule();
    const menu = new FakeMenu();
    const graph = createFakeGraph();

    registerLeaferContextMenuBuiltins(menu as never, {
      graph: graph as LeaferGraph,
      features: {
        nodeCopy: true,
        canvasPaste: true
      }
    });

    const nodeItems = menu.resolve(createContext("node", "node-1"));
    const copyItem = findItem(nodeItems, "builtin-node-copy");
    expect(copyItem?.disabled).toBe(false);
    copyItem?.onSelect?.(createContext("node", "node-1"));

    const pasteContext = createContext("canvas", undefined, {
      x: 240,
      y: 160
    });
    const canvasItems = menu.resolve(pasteContext);
    const pasteItem = findItem(canvasItems, "builtin-canvas-paste");
    expect(pasteItem?.disabled).toBe(false);
    pasteItem?.onSelect?.(pasteContext);

    expect(graph.createdNodes).toHaveLength(1);
    expect(graph.createdNodes[0]).toMatchObject({
      type: "system/on-play",
      x: 264,
      y: 184
    });
    expect(graph.createdLinks).toHaveLength(1);
    expect(graph.createdLinks[0]).toMatchObject({
      source: {
        nodeId: "created-node-1",
        slot: "start"
      },
      target: {
        nodeId: "created-node-1",
        slot: "start"
      }
    });
  });
});

class FakeMenu {
  private readonly resolvers = new Map<string, TestMenuResolver>();

  registerResolver(key: string, resolver: TestMenuResolver): () => void {
    this.resolvers.set(key, resolver);
    return () => {
      this.resolvers.delete(key);
    };
  }

  keys(): string[] {
    return [...this.resolvers.keys()];
  }

  resolve(context: TestMenuContext): TestMenuItem[] {
    const items: TestMenuItem[] = [];
    for (const resolver of this.resolvers.values()) {
      items.push(...(resolver(context) ?? []));
    }
    return items;
  }
}

function createContext(
  kind: TestMenuContext["target"]["kind"],
  id?: string,
  worldPoint?: {
    x: number;
    y: number;
  }
): TestMenuContext {
  return {
    container: document.body,
    host: document.body,
    target: {
      kind,
      id
    },
    triggerReason: "manual",
    pagePoint: { x: 24, y: 24 },
    clientPoint: { x: 24, y: 24 },
    containerPoint: { x: 24, y: 24 },
    worldPoint
  };
}

function findItem(
  items: TestMenuItem[],
  key: string
): TestActionItem | undefined {
  return items.find((item) => "key" in item && item.key === key && !("kind" in item && item.kind === "separator")) as
    | TestActionItem
    | undefined;
}

async function loadBuiltinsModule() {
  mock.module("leafergraph", () => ({
    createCreateNodeInputFromNodeSnapshot(node: {
      id: string;
      type: string;
      title?: string;
      layout: {
        x: number;
        y: number;
      };
    }) {
      return {
        id: node.id,
        type: node.type,
        title: node.title,
        x: node.layout.x,
        y: node.layout.y
      };
    }
  }));

  return import("../src/builtins/registry");
}

function createFakeGraph(): LeaferGraph & {
  createdNodes: LeaferGraphCreateNodeInput[];
  createdLinks: LeaferGraphCreateLinkInput[];
} {
  const createdNodes: LeaferGraphCreateNodeInput[] = [];
  const createdLinks: LeaferGraphCreateLinkInput[] = [];
  let nodeSeed = 0;

  const nodeSnapshot = {
    id: "node-1",
    type: "system/on-play",
    title: "Start Event",
    layout: {
      x: 40,
      y: 20
    }
  };
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

  return {
    createdNodes,
    createdLinks,
    listNodes() {
      return [
        {
          type: "system/on-play",
          title: "Start Event",
          category: "System"
        }
      ] as ReturnType<LeaferGraph["listNodes"]>;
    },
    getNodeSnapshot(nodeId: string) {
      return nodeId === "node-1"
        ? (nodeSnapshot as ReturnType<LeaferGraph["getNodeSnapshot"]>)
        : undefined;
    },
    findLinksByNode(nodeId: string) {
      return nodeId === "node-1" ? links : [];
    },
    isNodeSelected() {
      return false;
    },
    listSelectedNodeIds() {
      return [];
    },
    setSelectedNodeIds() {
      return [];
    },
    createNode(input: LeaferGraphCreateNodeInput) {
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
      } as ReturnType<LeaferGraph["createNode"]>;
    },
    createLink(input: LeaferGraphCreateLinkInput) {
      createdLinks.push(input);
      return {
        id: `created-link-${createdLinks.length}`,
        source: input.source,
        target: input.target
      } as ReturnType<LeaferGraph["createLink"]>;
    },
    play() {
      return true;
    },
    step() {
      return true;
    },
    stop() {
      return true;
    },
    fitView() {},
    playFromNode() {
      return true;
    },
    removeNode() {
      return true;
    },
    removeLink() {
      return true;
    }
  } as LeaferGraph & {
    createdNodes: LeaferGraphCreateNodeInput[];
    createdLinks: LeaferGraphCreateLinkInput[];
  };
}
