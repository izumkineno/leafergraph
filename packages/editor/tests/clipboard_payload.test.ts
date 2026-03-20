import { describe, expect, test } from "bun:test";

import type {
  GraphLink,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";
import {
  copyNodesToClipboardPayload,
  createNodesFromClipboardPayload,
  parseLeaferGraphClipboardPayload,
  serializeLeaferGraphClipboardPayload
} from "../src/commands/clipboard_payload";
import type { EditorGraphDocumentSession } from "../src/session/graph_document_session";

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
  let entitySeed = 1;

  const graph = {
    getNodeSnapshot(nodeId: string) {
      const node = nodeMap.get(nodeId);
      return node ? structuredClone(node) : undefined;
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
    }
  } as unknown as LeaferGraph;

  const session = {
    currentDocument: {
      documentId: "doc-test",
      revision: 1,
      appKind: "demo",
      nodes: [],
      links: []
    },
    pendingOperationIds: [],
    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      switch (operation.type) {
        case "node.create": {
          const nodeId = operation.input.id ?? `node-created-${entitySeed}`;
          entitySeed += 1;
          nodeMap.set(
            nodeId,
            createNodeSnapshot(nodeId, {
              type: operation.input.type,
              title: operation.input.title,
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
        default:
          return {
            accepted: false,
            changed: false,
            operation,
            affectedNodeIds: [],
            affectedLinkIds: []
          };
      }
    }
  } as unknown as EditorGraphDocumentSession;

  return {
    graph,
    session
  };
}

describe("clipboard payload helpers", () => {
  test("payload JSON round-trip 应保留节点属性与内部连线", () => {
    const harness = createGraphHarness({
      nodes: [
        createNodeSnapshot("node-a", {
          x: 24,
          y: 36,
          properties: { mode: "sum" },
          data: { gain: 0.75 },
          flags: { collapsed: true },
          widgets: [{ type: "slider", name: "gain", value: 0.75 }]
        }),
        createNodeSnapshot("node-b", {
          x: 260,
          y: 120
        }),
        createNodeSnapshot("node-c", {
          x: 520,
          y: 180
        })
      ],
      links: [
        createLinkSnapshot("link-a-b", "node-a", "node-b"),
        createLinkSnapshot("link-b-c", "node-b", "node-c")
      ]
    });

    const payload = copyNodesToClipboardPayload(harness.graph, [
      "node-a",
      "node-b"
    ]);

    expect(payload).not.toBeNull();
    expect(payload?.links).toEqual([createLinkSnapshot("link-a-b", "node-a", "node-b")]);

    const text = serializeLeaferGraphClipboardPayload(payload!);
    const parsed = parseLeaferGraphClipboardPayload(text);

    expect(parsed).toEqual(payload);
    expect(parsed?.nodes[0]?.properties).toEqual({ mode: "sum" });
    expect(parsed?.nodes[0]?.data).toEqual({ gain: 0.75 });
    expect(parsed?.nodes[0]?.flags).toEqual({ collapsed: true });
    expect(parsed?.nodes[0]?.widgets).toEqual([
      { type: "slider", name: "gain", value: 0.75 }
    ]);
  });

  test("createNodesFromClipboardPayload 应重建新节点与内部连线 ID", () => {
    const source = createGraphHarness({
      nodes: [
        createNodeSnapshot("node-a", { x: 48, y: 72 }),
        createNodeSnapshot("node-b", { x: 288, y: 72 })
      ],
      links: [createLinkSnapshot("link-a-b", "node-a", "node-b")]
    });
    const target = createGraphHarness();
    const payload = copyNodesToClipboardPayload(source.graph, [
      "node-a",
      "node-b"
    ]);

    if (!payload) {
      throw new Error("未生成 payload");
    }

    const createdNodes = createNodesFromClipboardPayload(
      target.graph,
      target.session,
      payload,
      600,
      320
    );

    expect(createdNodes).toHaveLength(2);
    expect(createdNodes[0]?.id).not.toBe("node-a");
    expect(createdNodes[1]?.id).not.toBe("node-b");
    expect(createdNodes[0]?.layout.x).toBe(600);
    expect(createdNodes[0]?.layout.y).toBe(320);
    expect(createdNodes[1]?.layout.x).toBe(840);
    expect(createdNodes[1]?.layout.y).toBe(320);

    const recreatedLinks = target.graph.findLinksByNode(createdNodes[0]!.id);
    expect(recreatedLinks).toHaveLength(1);
    expect(recreatedLinks[0]?.source.nodeId).toBe(createdNodes[0]?.id);
    expect(recreatedLinks[0]?.target.nodeId).toBe(createdNodes[1]?.id);
  });

  test("parseLeaferGraphClipboardPayload 遇到非 LeaferGraph JSON 时返回 null", () => {
    expect(parseLeaferGraphClipboardPayload("{\"hello\":\"world\"}")).toBeNull();
  });

  test("parseLeaferGraphClipboardPayload 应接受不带 direction 的文档连线", () => {
    const payloadText = JSON.stringify({
      kind: "leafergraph/clipboard",
      version: 1,
      anchor: { x: 10, y: 20 },
      nodes: [
        createNodeSnapshot("node-a", { x: 10, y: 20 }),
        createNodeSnapshot("node-b", { x: 40, y: 20 })
      ],
      links: [
        {
          id: "link-a-b",
          source: { nodeId: "node-a", slot: 0 },
          target: { nodeId: "node-b", slot: 0 }
        }
      ]
    });

    const parsed = parseLeaferGraphClipboardPayload(payloadText);

    expect(parsed).not.toBeNull();
    expect(parsed?.links).toHaveLength(1);
    expect(parsed?.links[0]).toEqual({
      id: "link-a-b",
      source: { nodeId: "node-a", slot: 0 },
      target: { nodeId: "node-b", slot: 0 }
    });
  });

  test("parseLeaferGraphClipboardPayload 应接受缺省 width / height 的节点", () => {
    const node = createNodeSnapshot("node-on-play", {
      type: "system/on-play",
      title: "On Play",
      x: 389,
      y: 379
    });
    delete node.layout.width;
    delete node.layout.height;

    const payloadText = JSON.stringify({
      kind: "leafergraph/clipboard",
      version: 1,
      anchor: { x: 389, y: 379 },
      nodes: [node],
      links: []
    });

    const parsed = parseLeaferGraphClipboardPayload(payloadText);

    expect(parsed).not.toBeNull();
    expect(parsed?.nodes[0]?.type).toBe("system/on-play");
    expect(parsed?.nodes[0]?.layout).toEqual({
      x: 389,
      y: 379
    });
  });

  test("createNodesFromClipboardPayload 应接受缺省 width / height 的节点", () => {
    const target = createGraphHarness();
    const node = createNodeSnapshot("node-on-play", {
      type: "system/on-play",
      title: "On Play",
      x: 389,
      y: 379
    });
    delete node.layout.width;
    delete node.layout.height;

    const payload = {
      kind: "leafergraph/clipboard" as const,
      version: 1 as const,
      anchor: { x: 389, y: 379 },
      nodes: [node],
      links: []
    };

    const createdNodes = createNodesFromClipboardPayload(
      target.graph,
      target.session,
      payload,
      437,
      427
    );

    expect(createdNodes).toHaveLength(1);
    expect(createdNodes[0]?.type).toBe("system/on-play");
    expect(createdNodes[0]?.layout.x).toBe(437);
    expect(createdNodes[0]?.layout.y).toBe(427);
    expect(createdNodes[0]?.layout.width).toBe(240);
    expect(createdNodes[0]?.layout.height).toBe(140);
  });
});
