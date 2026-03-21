import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphLink,
  LeaferGraph,
  LeaferGraphContextMenuContext
} from "leafergraph";
import { createEditorCommandBus } from "../src/commands/command_bus";
import type { EditorRemoteAuthorityClient } from "../src/session/graph_document_authority_client";
import { createRemoteGraphDocumentSession } from "../src/session/graph_document_session";
import type { EditorNodeSelectionController } from "../src/state/selection";

type TestNodeSnapshot = NonNullable<LeaferGraph["getNodeSnapshot"]>;
const TEST_PENDING_NODE_TYPE = "test/pending-node";
const TEST_PENDING_NODE_TITLE = "Pending Test Node";

function createNodeSnapshot(
  nodeId: string,
  options: {
    type?: string;
    title?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } = {}
): TestNodeSnapshot {
  return {
    id: nodeId,
    type: options.type ?? TEST_PENDING_NODE_TYPE,
    title: options.title ?? nodeId,
    layout: {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 240,
      height: options.height ?? 140
    },
    flags: {},
    properties: {},
    propertySpecs: [],
    inputs: [],
    outputs: [],
    widgets: [],
    data: {}
  };
}

function createLinkSnapshot(linkId: string): GraphLink {
  return {
    id: linkId,
    source: {
      nodeId: "node-1",
      direction: "output",
      slot: 0
    },
    target: {
      nodeId: "node-2",
      direction: "input",
      slot: 0
    }
  };
}

function createSelectionStub(
  initialSelectedNodeIds: string[] = []
): EditorNodeSelectionController {
  const selectedNodeIds = [...initialSelectedNodeIds];

  return {
    get primarySelectedNodeId(): string | null {
      return selectedNodeIds.at(-1) ?? null;
    },
    get selectedNodeId(): string | null {
      return selectedNodeIds.at(-1) ?? null;
    },
    get selectedNodeIds(): readonly string[] {
      return selectedNodeIds;
    },
    isSelected(nodeId: string): boolean {
      return selectedNodeIds.includes(nodeId);
    },
    hasMultipleSelected(): boolean {
      return selectedNodeIds.length > 1;
    },
    setMany(nodeIds: readonly string[]): void {
      selectedNodeIds.length = 0;
      selectedNodeIds.push(...nodeIds);
    },
    select(nodeId: string | null): void {
      this.setMany(nodeId ? [nodeId] : []);
    },
    add(nodeId: string): void {
      if (!selectedNodeIds.includes(nodeId)) {
        selectedNodeIds.push(nodeId);
      }
    },
    remove(nodeId: string): void {
      const index = selectedNodeIds.indexOf(nodeId);
      if (index >= 0) {
        selectedNodeIds.splice(index, 1);
      }
    },
    toggle(nodeId: string): void {
      if (this.isSelected(nodeId)) {
        this.remove(nodeId);
      } else {
        this.add(nodeId);
      }
    },
    clear(): void {
      selectedNodeIds.length = 0;
    },
    clearIfContains(nodeId: string): void {
      this.remove(nodeId);
    },
    subscribe(listener: (selectedNodeIds: readonly string[]) => void): () => void {
      listener(selectedNodeIds);
      return () => {};
    }
  };
}

function createPendingAuthorityClient(): EditorRemoteAuthorityClient {
  return {
    submitOperation() {
      return new Promise(() => {});
    }
  };
}

function createGraphStub(options?: {
  nodes?: TestNodeSnapshot[];
  links?: GraphLink[];
}): LeaferGraph {
  const nodeMap = new Map(
    (options?.nodes ?? []).map((node) => [node.id, structuredClone(node)])
  );
  const linkMap = new Map(
    (options?.links ?? []).map((link) => [link.id, structuredClone(link)])
  );

  return {
    listNodes() {
      return [
        {
          type: TEST_PENDING_NODE_TYPE,
          title: TEST_PENDING_NODE_TITLE,
          size: [320, 180],
          properties: [
            {
              name: "status",
              type: "string",
              default: "READY"
            }
          ],
          inputs: [
            {
              name: "In",
              type: "event"
            }
          ],
          outputs: [
            {
              name: "Out",
              type: "event"
            }
          ],
          widgets: [
            {
              type: "slider",
              name: "gain",
              value: 0.5
            }
          ]
        }
      ];
    },
    getNodeSnapshot(nodeId: string) {
      const snapshot = nodeMap.get(nodeId);
      return snapshot ? structuredClone(snapshot) : undefined;
    },
    getNodeResizeConstraint() {
      return {
        enabled: true,
        defaultWidth: 320,
        defaultHeight: 180
      };
    },
    getLink(linkId: string) {
      const link = linkMap.get(linkId);
      return link ? structuredClone(link) : undefined;
    },
    findLinksByNode(nodeId: string) {
      return [...linkMap.values()]
        .filter(
          (link) =>
            link.source.nodeId === nodeId || link.target.nodeId === nodeId
        )
        .map((link) => structuredClone(link));
    },
    fitView() {
      return true;
    },
    playFromNode() {
      return true;
    }
  } as unknown as LeaferGraph;
}

function createDocument(): GraphDocument {
  return {
    documentId: "authority-first-doc",
    revision: "1",
    appKind: "test-app",
    nodes: [
      createNodeSnapshot("node-1"),
      createNodeSnapshot("node-2", {
        x: 320
      })
    ],
    links: [createLinkSnapshot("link-1")],
    meta: {}
  };
}

function createCommandBusForPendingAuthority(options?: {
  graph?: LeaferGraph;
  selection?: EditorNodeSelectionController;
}) {
  const graph = options?.graph ?? createGraphStub({
    nodes: createDocument().nodes as TestNodeSnapshot[],
    links: createDocument().links
  });
  const session = createRemoteGraphDocumentSession({
    document: createDocument(),
    client: createPendingAuthorityClient()
  });
  const selection = options?.selection ?? createSelectionStub();

  return createEditorCommandBus({
    graph,
    session,
    selection,
    bindNode: () => {},
    unbindNode: () => {},
    quickCreateNodeType: TEST_PENDING_NODE_TYPE,
    isRuntimeReady: () => true,
    resolveLastPointerPagePoint: () => ({
      x: 120,
      y: 160
    }),
    resolveViewportCenterPagePoint: () => ({
      x: 320,
      y: 240
    })
  });
}

describe("EditorCommandBus authority-first", () => {
  test("canvas.create-node 在 remote-client 下应进入 pending，而不是误判失败", () => {
    const commandBus = createCommandBusForPendingAuthority();

    const execution = commandBus.execute({
      type: "canvas.create-node",
      context: {
        pagePoint: {
          x: 120,
          y: 160
        }
      } as LeaferGraphContextMenuContext
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.authority.status).toBe("pending");
    expect(execution.documentRecorded).toBe(false);
    expect(execution.operations?.[0]).toMatchObject({
      type: "node.create",
      input: {
        type: TEST_PENDING_NODE_TYPE,
        title: TEST_PENDING_NODE_TITLE,
        x: 120,
        y: 160,
        width: 320,
        height: 180,
        properties: {
          status: "READY"
        },
        propertySpecs: [
          {
            name: "status",
            type: "string",
            default: "READY"
          }
        ],
        inputs: [
          {
            name: "In",
            type: "event"
          }
        ],
        outputs: [
          {
            name: "Out",
            type: "event"
          }
        ],
        widgets: [
          {
            type: "slider",
            name: "gain",
            value: 0.5
          }
        ],
        flags: {}
      }
    });
    expect(execution.historyPayload?.kind).toBe("create-nodes");
  });

  test("node.remove 在 remote-client 下应保留 pending 语义", () => {
    const commandBus = createCommandBusForPendingAuthority();

    const execution = commandBus.execute({
      type: "node.remove",
      nodeId: "node-1"
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.authority.status).toBe("pending");
    expect(execution.documentRecorded).toBe(false);
    expect(execution.operations?.[0]?.type).toBe("node.remove");
    expect(execution.historyPayload?.kind).toBe("remove-nodes");
  });

  test("node.reset-size 在 remote-client 下应记录目标尺寸而不是当前尺寸", () => {
    const graph = createGraphStub({
      nodes: [
        createNodeSnapshot("node-1", {
          width: 512,
          height: 256
        })
      ]
    });
    const commandBus = createCommandBusForPendingAuthority({
      graph
    });

    const execution = commandBus.execute({
      type: "node.reset-size",
      nodeId: "node-1"
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.authority.status).toBe("pending");
    expect(execution.documentRecorded).toBe(false);
    expect(execution.operations?.[0]).toMatchObject({
      type: "node.resize",
      input: {
        width: 320,
        height: 180
      }
    });
    expect(execution.historyPayload).toMatchObject({
      kind: "resize-node",
      afterSize: {
        width: 320,
        height: 180
      }
    });
  });

  test("link.create 在 remote-client 下应进入 pending 并保留稳定 link id", () => {
    const commandBus = createCommandBusForPendingAuthority();

    const execution = commandBus.execute({
      type: "link.create",
      input: {
        source: {
          nodeId: "node-1",
          direction: "output",
          slot: 0
        },
        target: {
          nodeId: "node-2",
          direction: "input",
          slot: 0
        }
      }
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.authority.status).toBe("pending");
    expect(execution.documentRecorded).toBe(false);
    expect(execution.operations?.[0]?.type).toBe("link.create");
    expect((execution.result as GraphLink).id).toBeTruthy();
  });

  test("link.reconnect 在 remote-client 下应进入 pending 并返回目标端点快照", () => {
    const commandBus = createCommandBusForPendingAuthority();

    const execution = commandBus.execute({
      type: "link.reconnect",
      linkId: "link-1",
      input: {
        target: {
          nodeId: "node-1",
          direction: "input",
          slot: 1
        }
      }
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.authority.status).toBe("pending");
    expect(execution.documentRecorded).toBe(false);
    expect(execution.operations?.[0]?.type).toBe("link.reconnect");
    expect(execution.historyPayload).toMatchObject({
      kind: "reconnect-link",
      afterLink: {
        target: {
          nodeId: "node-1",
          slot: 1
        }
      }
    });
  });

  test("canvas.create-node-from-workspace 在 remote-client 下应进入 pending", () => {
    const commandBus = createCommandBusForPendingAuthority();

    const execution = commandBus.execute({
      type: "canvas.create-node-from-workspace",
      nodeType: TEST_PENDING_NODE_TYPE,
      placement: "last-pointer"
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.authority.status).toBe("pending");
    expect(execution.documentRecorded).toBe(false);
    expect(execution.operations?.[0]?.type).toBe("node.create");
    expect(execution.historyPayload?.kind).toBe("create-nodes");
  });
});
