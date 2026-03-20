import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";
import { createMockRemoteGraphDocumentSession } from "../src/session/graph_document_session";

function createTestDocument(): GraphDocument {
  return {
    documentId: "doc-test",
    revision: "1",
    appKind: "test-app",
    nodes: [
      {
        id: "node-1",
        title: "Node 1",
        type: "test.node",
        layout: { x: 0, y: 0, width: 120, height: 80 }
      } as GraphDocument["nodes"][number],
      {
        id: "node-2",
        title: "Node 2",
        type: "test.node",
        layout: { x: 240, y: 0, width: 120, height: 80 }
      } as GraphDocument["nodes"][number]
    ],
    links: [
      {
        id: "link-1",
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
    ],
    meta: {}
  };
}

function createNodeRemoveOperation(
  nodeId: string,
  operationId: string
): GraphOperation {
  return {
    type: "node.remove",
    nodeId,
    operationId,
    timestamp: Date.now(),
    source: "editor.test"
  };
}

function createGraphApplyResult(
  operation: GraphOperation,
  changed: boolean
): GraphOperationApplyResult {
  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds:
      operation.type === "node.remove" && changed ? [operation.nodeId] : [],
    affectedLinkIds: []
  };
}

function createMockLeaferGraph(initialDocument: GraphDocument): {
  graph: LeaferGraph;
  getApplyCount(): number;
} {
  let currentDocument = structuredClone(initialDocument);
  let applyCount = 0;

  const graph = {
    applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult {
      applyCount += 1;

      if (operation.type !== "node.remove") {
        return createGraphApplyResult(operation, false);
      }

      const exists = currentDocument.nodes.some((node) => node.id === operation.nodeId);
      if (!exists) {
        return createGraphApplyResult(operation, false);
      }

      currentDocument = {
        ...currentDocument,
        nodes: currentDocument.nodes.filter((node) => node.id !== operation.nodeId),
        links: currentDocument.links.filter(
          (link) =>
            link.source.nodeId !== operation.nodeId &&
            link.target.nodeId !== operation.nodeId
        )
      };

      return createGraphApplyResult(operation, true);
    },

    replaceGraphDocument(document: GraphDocument): void {
      currentDocument = structuredClone(document);
    }
  } as unknown as LeaferGraph;

  return {
    graph,
    getApplyCount(): number {
      return applyCount;
    }
  };
}

describe("createMockRemoteGraphDocumentSession", () => {
  test("应支持 pending -> confirmed 并推进文档 revision", async () => {
    const document = createTestDocument();
    const { graph } = createMockLeaferGraph(document);
    const session = createMockRemoteGraphDocumentSession({
      graph,
      document,
      confirmationDelayMs: 0
    });
    const pendingSnapshots: string[][] = [];
    session.subscribePending((pendingOperationIds) => {
      pendingSnapshots.push([...pendingOperationIds]);
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation("node-1", "op-remove-node-1")
    );
    expect(submission.applyResult.accepted).toBe(true);
    expect(submission.applyResult.changed).toBe(false);
    expect(submission.applyResult.reason).toBe("等待 authority 确认");
    expect(session.pendingOperationIds).toEqual(["op-remove-node-1"]);

    const confirmation = await submission.confirmation;
    expect(confirmation.accepted).toBe(true);
    expect(confirmation.changed).toBe(true);
    expect(confirmation.revision).toBe("2");
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(session.currentDocument.nodes.map((node) => node.id)).toEqual(["node-2"]);
    expect(session.currentDocument.links).toHaveLength(0);
    expect(pendingSnapshots).toEqual([[], ["op-remove-node-1"], []]);
  });

  test("应支持 rejected 并保持文档不变", async () => {
    const document = createTestDocument();
    const { graph, getApplyCount } = createMockLeaferGraph(document);
    const session = createMockRemoteGraphDocumentSession({
      graph,
      document,
      confirmationDelayMs: 0,
      shouldRejectOperation: () => "authority 拒绝该操作"
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation("node-1", "op-reject-node-1")
    );
    const confirmation = await submission.confirmation;

    expect(confirmation.accepted).toBe(false);
    expect(confirmation.changed).toBe(false);
    expect(confirmation.reason).toBe("authority 拒绝该操作");
    expect(confirmation.revision).toBe("1");
    expect(getApplyCount()).toBe(0);
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(session.currentDocument.nodes.map((node) => node.id)).toEqual([
      "node-1",
      "node-2"
    ]);
    expect(session.currentDocument.links).toHaveLength(1);
  });

  test("replaceDocument 应取消 pending 并切换到新文档", async () => {
    const document = createTestDocument();
    const { graph } = createMockLeaferGraph(document);
    const session = createMockRemoteGraphDocumentSession({
      graph,
      document,
      confirmationDelayMs: 200
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation("node-1", "op-pending-replace")
    );
    expect(session.pendingOperationIds).toEqual(["op-pending-replace"]);

    const nextDocument: GraphDocument = {
      documentId: "doc-replaced",
      revision: "10",
      appKind: "test-app",
      nodes: [
        {
          id: "node-9",
          title: "Node 9",
          type: "test.node",
          layout: { x: 0, y: 0, width: 160, height: 96 }
        } as GraphDocument["nodes"][number]
      ],
      links: [],
      meta: { replaced: true }
    };

    session.replaceDocument(nextDocument);
    const confirmation = await submission.confirmation;

    expect(confirmation.accepted).toBe(false);
    expect(confirmation.changed).toBe(false);
    expect(confirmation.reason).toBe("文档已替换，待确认操作已取消");
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(session.currentDocument.documentId).toBe("doc-replaced");
    expect(session.currentDocument.nodes.map((node) => node.id)).toEqual(["node-9"]);
  });
});
