import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphLink,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";
import { createEditorCommandBus } from "../src/commands/command_bus";
import {
  copyNodesToClipboard,
  createClipboardLinkSnapshots
} from "../src/commands/node_commands";
import type { EditorGraphDocumentSession } from "../src/session/graph_document_session";
import type { EditorNodeSelectionController } from "../src/state/selection";

type TestNodeSnapshot = NonNullable<LeaferGraph["getNodeSnapshot"]>;

function createNodeSnapshot(
  nodeId: string,
  options: {
    type?: string;
    title?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    properties?: Record<string, unknown>;
    data?: Record<string, unknown>;
    flags?: Record<string, unknown>;
    widgets?: unknown[];
  } = {}
): TestNodeSnapshot {
  return {
    id: nodeId,
    type: options.type ?? "demo/node",
    title: options.title ?? nodeId,
    layout: {
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 240,
      height: options.height ?? 140
    },
    flags: structuredClone(options.flags ?? {}),
    properties: structuredClone(options.properties ?? {}),
    propertySpecs: [],
    inputs: [],
    outputs: [],
    widgets: structuredClone(options.widgets ?? []),
    data: structuredClone(options.data ?? {})
  };
}

function createLinkSnapshot(
  linkId: string,
  sourceNodeId: string,
  targetNodeId: string
): GraphLink {
  return {
    id: linkId,
    source: {
      nodeId: sourceNodeId,
      direction: "output",
      slot: 0
    },
    target: {
      nodeId: targetNodeId,
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
    subscribe(listener: (nodeIds: readonly string[]) => void): () => void {
      listener(selectedNodeIds);
      return () => {};
    }
  };
}

function createGraphHarness(options?: {
  nodes?: TestNodeSnapshot[];
  links?: GraphLink[];
}): {
  graph: LeaferGraph;
  session: EditorGraphDocumentSession;
} {
  const nodeMap = new Map(
    (options?.nodes ?? []).map((node) => [node.id, structuredClone(node)])
  );
  const linkMap = new Map(
    (options?.links ?? []).map((link) => [link.id, structuredClone(link)])
  );
  let operationSeed = 1;

  const removeRelatedLinks = (nodeId: string): void => {
    for (const link of [...linkMap.values()]) {
      if (link.source.nodeId === nodeId || link.target.nodeId === nodeId) {
        linkMap.delete(link.id);
      }
    }
  };

  const graph = {
    listNodes() {
      return [
        {
          type: "demo/node",
          title: "Demo Node"
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
        defaultWidth: 240,
        defaultHeight: 140
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

  const applyOperation = (operation: GraphOperation): GraphOperationApplyResult => {
    switch (operation.type) {
      case "node.create": {
        const nodeId = operation.input.id ?? `node-created-${operationSeed}`;
        operationSeed += 1;
        nodeMap.set(
          nodeId,
          createNodeSnapshot(nodeId, {
            type: operation.input.type,
            title: operation.input.title ?? operation.input.type,
            x: operation.input.x,
            y: operation.input.y,
            width: operation.input.width,
            height: operation.input.height,
            properties: operation.input.properties,
            data: operation.input.data,
            flags: operation.input.flags,
            widgets: operation.input.widgets
          })
        );
        return {
          accepted: true,
          changed: true,
          operation,
          affectedNodeIds: [nodeId],
          affectedLinkIds: []
        };
      }
      case "node.remove": {
        const existed = nodeMap.delete(operation.nodeId);
        if (existed) {
          removeRelatedLinks(operation.nodeId);
        }
        return {
          accepted: true,
          changed: existed,
          operation,
          affectedNodeIds: existed ? [operation.nodeId] : [],
          affectedLinkIds: []
        };
      }
      case "link.create": {
        const link = structuredClone(operation.input);
        linkMap.set(link.id, link);
        return {
          accepted: true,
          changed: true,
          operation,
          affectedNodeIds: [],
          affectedLinkIds: [link.id]
        };
      }
      case "link.remove": {
        const existed = linkMap.delete(operation.linkId);
        return {
          accepted: true,
          changed: existed,
          operation,
          affectedNodeIds: [],
          affectedLinkIds: existed ? [operation.linkId] : []
        };
      }
      default:
        return {
          accepted: true,
          changed: true,
          operation,
          affectedNodeIds: [],
          affectedLinkIds: []
        };
    }
  };

  const session: EditorGraphDocumentSession = {
    currentDocument: {
      documentId: "clipboard-links-doc",
      revision: "1",
      appKind: "test-app",
      nodes: [],
      links: [],
      meta: {}
    } satisfies GraphDocument,
    pendingOperationIds: [],
    submitOperationWithAuthority(operation: GraphOperation) {
      const applyResult = applyOperation(operation);
      return {
        applyResult,
        confirmation: Promise.resolve({
          operationId: operation.operationId,
          accepted: applyResult.accepted,
          changed: applyResult.changed,
          revision: "1"
        })
      };
    },
    submitOperation(operation: GraphOperation) {
      return applyOperation(operation);
    },
    recordAppliedOperations(): void {},
    reconcileNodeState(): void {},
    replaceDocument(): void {},
    subscribeOperationConfirmation(): () => void {
      return () => {};
    },
    subscribePending(): () => void {
      return () => {};
    },
    subscribe(): () => void {
      return () => {};
    }
  };

  return {
    graph,
    session
  };
}

describe("node clipboard with internal links", () => {
  test("复制选区时应只带走选区内部连线", () => {
    const nodeA = createNodeSnapshot("node-a", {
      x: 40,
      y: 60,
      properties: {
        titleColor: "#38bdf8"
      },
      data: {
        threshold: 0.6
      },
      flags: {
        collapsed: true
      },
      widgets: [
        {
          type: "slider",
          name: "gain",
          value: 0.75
        }
      ]
    });
    const nodeB = createNodeSnapshot("node-b", {
      x: 300,
      y: 180
    });
    const nodeC = createNodeSnapshot("node-c", {
      x: 640,
      y: 220
    });
    const internalLink = createLinkSnapshot("link-internal", "node-a", "node-b");
    const externalLink = createLinkSnapshot("link-external", "node-b", "node-c");
    const harness = createGraphHarness({
      nodes: [nodeA, nodeB, nodeC],
      links: [internalLink, externalLink]
    });

    const clipboard = copyNodesToClipboard(harness.graph, ["node-a", "node-b"]);

    expect(clipboard).not.toBeNull();
    expect(clipboard?.payload.nodes).toHaveLength(2);
    expect(clipboard?.payload.links).toEqual([internalLink]);
    expect(clipboard?.payload.nodes[0]?.properties).toEqual(nodeA.properties);
    expect(clipboard?.payload.nodes[0]?.data).toEqual(nodeA.data);
    expect(clipboard?.payload.nodes[0]?.flags).toEqual(nodeA.flags);
    expect(clipboard?.payload.nodes[0]?.widgets).toEqual(nodeA.widgets);
  });

  test("selection.duplicate 应一并重建内部连线，并在历史负载里记录", () => {
    const harness = createGraphHarness({
      nodes: [
        createNodeSnapshot("node-a", {
          x: 32,
          y: 48,
          properties: {
            gain: 12
          }
        }),
        createNodeSnapshot("node-b", {
          x: 320,
          y: 48,
          data: {
            label: "downstream"
          }
        })
      ],
      links: [createLinkSnapshot("link-a-b", "node-a", "node-b")]
    });
    const selection = createSelectionStub(["node-a", "node-b"]);
    const commandBus = createEditorCommandBus({
      graph: harness.graph,
      session: harness.session,
      selection,
      bindNode: () => {},
      unbindNode: () => {},
      quickCreateNodeType: "demo/node",
      isRuntimeReady: () => true,
      resolveLastPointerPagePoint: () => ({
        x: 160,
        y: 120
      }),
      resolveViewportCenterPagePoint: () => ({
        x: 400,
        y: 280
      })
    });

    const execution = commandBus.execute({
      type: "selection.duplicate"
    });

    expect(execution.success).toBe(true);
    expect(execution.changed).toBe(true);
    expect(execution.operations?.map((operation) => operation.type)).toEqual([
      "node.create",
      "node.create",
      "link.create"
    ]);
    expect(execution.historyPayload).toMatchObject({
      kind: "create-nodes"
    });

    if (!execution.historyPayload || execution.historyPayload.kind !== "create-nodes") {
      throw new Error("缺少 create-nodes 历史负载");
    }

    expect(execution.historyPayload.links).toHaveLength(1);
    const [createdLink] = execution.historyPayload.links ?? [];
    expect(createdLink?.source.nodeId).not.toBe("node-a");
    expect(createdLink?.target.nodeId).not.toBe("node-b");
    expect(createdLink?.source.nodeId).toBe(execution.historyPayload.nodeSnapshots[0]?.id);
    expect(createdLink?.target.nodeId).toBe(execution.historyPayload.nodeSnapshots[1]?.id);

    const recreatedLinks = createClipboardLinkSnapshots(
      copyNodesToClipboard(harness.graph, ["node-a", "node-b"])!,
      new Map(
        execution.historyPayload.nodeSnapshots.map((snapshot, index) => [
          index === 0 ? "node-a" : "node-b",
          snapshot.id
        ])
      )
    );
    expect(recreatedLinks).toHaveLength(1);
  });

  test("clipboard.paste 应保留选区内部连线和节点属性", () => {
    const harness = createGraphHarness({
      nodes: [
        createNodeSnapshot("node-a", {
          x: 48,
          y: 72,
          properties: {
            mode: "multiply"
          },
          data: {
            gain: 0.8
          }
        }),
        createNodeSnapshot("node-b", {
          x: 288,
          y: 72,
          flags: {
            collapsed: true
          }
        })
      ],
      links: [createLinkSnapshot("link-a-b", "node-a", "node-b")]
    });
    const selection = createSelectionStub(["node-a", "node-b"]);
    const commandBus = createEditorCommandBus({
      graph: harness.graph,
      session: harness.session,
      selection,
      bindNode: () => {},
      unbindNode: () => {},
      quickCreateNodeType: "demo/node",
      isRuntimeReady: () => true,
      resolveLastPointerPagePoint: () => ({
        x: 180,
        y: 160
      }),
      resolveViewportCenterPagePoint: () => ({
        x: 360,
        y: 240
      })
    });

    const copyExecution = commandBus.execute({
      type: "selection.copy"
    });
    expect(copyExecution.success).toBe(true);

    const pasteExecution = commandBus.execute({
      type: "clipboard.paste",
      point: {
        x: 540,
        y: 300
      }
    });

    expect(pasteExecution.success).toBe(true);
    expect(pasteExecution.operations?.map((operation) => operation.type)).toEqual([
      "node.create",
      "node.create",
      "link.create"
    ]);

    if (
      !pasteExecution.historyPayload ||
      pasteExecution.historyPayload.kind !== "create-nodes"
    ) {
      throw new Error("缺少 create-nodes 历史负载");
    }

    const [createdNodeA, createdNodeB] = pasteExecution.historyPayload.nodeSnapshots;
    expect(createdNodeA?.properties).toEqual({
      mode: "multiply"
    });
    expect(createdNodeA?.data).toEqual({
      gain: 0.8
    });
    expect(createdNodeB?.flags).toEqual({
      collapsed: true
    });
    expect(pasteExecution.historyPayload.links).toHaveLength(1);
    expect(pasteExecution.historyPayload.links?.[0]?.source.nodeId).toBe(
      createdNodeA?.id
    );
    expect(pasteExecution.historyPayload.links?.[0]?.target.nodeId).toBe(
      createdNodeB?.id
    );
  });

  test("clipboard.paste 应接受缺省 width / height 的节点 payload", () => {
    const harness = createGraphHarness();
    const selection = createSelectionStub();
    const commandBus = createEditorCommandBus({
      graph: harness.graph,
      session: harness.session,
      selection,
      bindNode: () => {},
      unbindNode: () => {},
      quickCreateNodeType: "demo/node",
      isRuntimeReady: () => true,
      resolveLastPointerPagePoint: () => ({
        x: 180,
        y: 160
      }),
      resolveViewportCenterPagePoint: () => ({
        x: 360,
        y: 240
      })
    });
    const node = createNodeSnapshot("node-on-play", {
      type: "system/on-play",
      title: "On Play",
      x: 389,
      y: 379
    });
    delete node.layout.width;
    delete node.layout.height;

    commandBus.setClipboardPayload({
      kind: "leafergraph/clipboard",
      version: 1,
      anchor: {
        x: 389,
        y: 379
      },
      nodes: [node],
      links: []
    });

    const pasteExecution = commandBus.execute({
      type: "clipboard.paste",
      point: {
        x: 437,
        y: 427
      }
    });

    expect(pasteExecution.success).toBe(true);
    expect(pasteExecution.operations?.map((operation) => operation.type)).toEqual([
      "node.create"
    ]);

    if (
      !pasteExecution.historyPayload ||
      pasteExecution.historyPayload.kind !== "create-nodes"
    ) {
      throw new Error("缺少 create-nodes 历史负载");
    }

    expect(pasteExecution.historyPayload.nodeSnapshots).toHaveLength(1);
    expect(pasteExecution.historyPayload.nodeSnapshots[0]?.type).toBe(
      "system/on-play"
    );
    expect(pasteExecution.historyPayload.nodeSnapshots[0]?.layout).toEqual({
      x: 437,
      y: 427,
      width: 240,
      height: 140
    });
  });
});
