import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphDocumentDiff,
  GraphOperation,
  LeaferGraph
} from "leafergraph";
import type { EditorRemoteAuthorityClient } from "../src/session/graph_document_authority_client";
import {
  createRemoteGraphDocumentSession
} from "../src/session/graph_document_session";
import {
  createConfigurableSessionBindingFactory
} from "../src/session/graph_document_session_binding";

function createTestDocument(): GraphDocument {
  return {
    documentId: "remote-doc",
    revision: "1",
    appKind: "test-app",
    nodes: [
      {
        id: "node-1",
        title: "Node 1",
        type: "test.node",
        layout: { x: 0, y: 0, width: 120, height: 80 }
      } as GraphDocument["nodes"][number]
    ],
    links: [],
    meta: {}
  };
}

function createNodeRemoveOperation(): GraphOperation {
  return {
    type: "node.remove",
    nodeId: "node-1",
    operationId: "op-remove-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

describe("createRemoteGraphDocumentSession", () => {
  test("authority 确认后应切换到 client 返回的新文档", async () => {
    const initialDocument = createTestDocument();
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: true,
          revision: "2",
          document: {
            ...initialDocument,
            revision: "2",
            nodes: []
          }
        };
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });
    const documentSnapshots: string[] = [];
    session.subscribe((document) => {
      documentSnapshots.push(document.revision);
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation()
    );
    expect(session.pendingOperationIds).toEqual(["op-remove-node-1"]);

    const confirmation = await submission.confirmation;
    expect(confirmation.accepted).toBe(true);
    expect(confirmation.changed).toBe(true);
    expect(confirmation.revision).toBe("2");
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(session.currentDocument.revision).toBe("2");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(documentSnapshots).toEqual(["1", "2"]);
  });

  test("replaceDocument 应支持 authority 回写最终文档", async () => {
    const initialDocument = createTestDocument();
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      },
      async replaceDocument(document) {
        return {
          ...document,
          revision: "11",
          meta: {
            ...(document.meta ?? {}),
            authority: "confirmed"
          }
        };
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });

    session.replaceDocument({
      documentId: "remote-doc-2",
      revision: "10",
      appKind: "test-app",
      nodes: [],
      links: [],
      meta: {}
    });
    await Promise.resolve();

    expect(session.currentDocument.documentId).toBe("remote-doc-2");
    expect(session.currentDocument.revision).toBe("11");
    expect(session.currentDocument.meta).toEqual({
      authority: "confirmed"
    });
  });

  test("应消费 authority 主动回推的 document 快照", async () => {
    const initialDocument = createTestDocument();
    let emitDocument: ((document: GraphDocument) => void) | null = null;
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      },
      subscribeDocument(listener) {
        emitDocument = listener;
        return () => {
          emitDocument = null;
        };
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });
    const revisions: string[] = [];
    session.subscribe((document) => {
      revisions.push(String(document.revision));
    });

    emitDocument?.({
      ...initialDocument,
      revision: "3",
      nodes: []
    });
    await Promise.resolve();

    expect(session.currentDocument.revision).toBe("3");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(revisions).toEqual(["1", "3"]);

    session.dispose?.();
  });

  test("应消费 authority 主动回推的 document diff，并发出 diff projection", async () => {
    const initialDocument = createTestDocument();
    let emitDocumentDiff: ((diff: GraphDocumentDiff) => void) | null = null;
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      },
      subscribeDocumentDiff(listener) {
        emitDocumentDiff = listener;
        return () => {
          emitDocumentDiff = null;
        };
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });
    const projectionTypes: string[] = [];
    session.subscribeProjection?.((projection) => {
      projectionTypes.push(projection.type);
    });

    emitDocumentDiff?.({
      documentId: "remote-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 1,
      operations: [
        {
          type: "node.move",
          nodeId: "node-1",
          input: {
            x: 24,
            y: 36
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
        }
      ]
    });
    await Promise.resolve();

    expect(session.currentDocument.revision).toBe("2");
    expect(session.currentDocument.nodes[0]?.title).toBe("Node 1 Updated");
    expect(session.currentDocument.nodes[0]?.layout).toMatchObject({
      x: 24,
      y: 36
    });
    expect(projectionTypes).toEqual(["full", "diff"]);

    session.dispose?.();
  });

  test("document diff 的 baseRevision 不匹配时应触发 resync，而不是脏应用", async () => {
    const initialDocument = createTestDocument();
    let emitDocumentDiff: ((diff: GraphDocumentDiff) => void) | null = null;
    let getDocumentCount = 0;
    const authorityClient: EditorRemoteAuthorityClient = {
      async getDocument() {
        getDocumentCount += 1;
        return {
          ...initialDocument,
          revision: "5",
          nodes: []
        };
      },
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      },
      subscribeDocumentDiff(listener) {
        emitDocumentDiff = listener;
        return () => {
          emitDocumentDiff = null;
        };
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });
    const projectionTypes: string[] = [];
    session.subscribeProjection?.((projection) => {
      projectionTypes.push(projection.type);
    });

    emitDocumentDiff?.({
      documentId: "remote-doc",
      baseRevision: "0",
      revision: "2",
      emittedAt: 1,
      operations: [],
      fieldChanges: [
        {
          type: "node.title.set",
          nodeId: "node-1",
          value: "Should Not Apply"
        }
      ]
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(getDocumentCount).toBe(1);
    expect(session.currentDocument.revision).toBe("5");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(projectionTypes).toEqual(["full", "full"]);

    session.dispose?.();
  });

  test("显式 resyncAuthorityDocument 应重新拉取并替换当前权威文档", async () => {
    const initialDocument = createTestDocument();
    let getDocumentCount = 0;
    const authorityClient: EditorRemoteAuthorityClient = {
      async getDocument() {
        getDocumentCount += 1;
        return {
          ...initialDocument,
          revision: "4",
          nodes: []
        };
      },
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });
    const revisions: string[] = [];
    session.subscribe((document) => {
      revisions.push(String(document.revision));
    });

    const document = await session.resyncAuthorityDocument?.();

    expect(getDocumentCount).toBe(1);
    expect(document?.revision).toBe("4");
    expect(session.currentDocument.revision).toBe("4");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(revisions).toEqual(["1", "4"]);
  });

  test("显式 resyncAuthorityDocument 默认应让 pending 失效，并切回权威文档", async () => {
    const initialDocument = createTestDocument();
    let resolveSubmitOperation: ((value: {
      accepted: boolean;
      changed: boolean;
      revision: string;
      document?: GraphDocument;
    }) => void) | null = null;
    const authorityClient: EditorRemoteAuthorityClient = {
      async getDocument() {
        return {
          ...initialDocument,
          revision: "9",
          nodes: []
        };
      },
      submitOperation() {
        return new Promise((resolve) => {
          resolveSubmitOperation = resolve;
        });
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation()
    );
    expect(session.pendingOperationIds).toEqual(["op-remove-node-1"]);

    const document = await session.resyncAuthorityDocument?.({
      pendingReason: "authority 已重新连接，待确认操作已失效，请手工重试"
    });
    const confirmation = await submission.confirmation;

    expect(document?.revision).toBe("9");
    expect(session.currentDocument.revision).toBe("9");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(confirmation).toEqual({
      operationId: "op-remove-node-1",
      accepted: false,
      changed: false,
      reason: "authority 已重新连接，待确认操作已失效，请手工重试",
      revision: "1"
    });

    resolveSubmitOperation?.({
      accepted: true,
      changed: true,
      revision: "10",
      document: {
        ...initialDocument,
        revision: "10"
      }
    });
    await Promise.resolve();

    expect(session.currentDocument.revision).toBe("9");
  });

  test("authority 请求失败后应自动 resync 当前权威文档", async () => {
    const initialDocument = createTestDocument();
    let getDocumentCount = 0;
    const authorityClient: EditorRemoteAuthorityClient = {
      async getDocument() {
        getDocumentCount += 1;
        return {
          ...initialDocument,
          revision: "7",
          nodes: []
        };
      },
      async submitOperation() {
        throw new Error("authority offline");
      }
    };
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: authorityClient
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation()
    );
    const confirmation = await submission.confirmation;

    expect(getDocumentCount).toBe(1);
    expect(confirmation.accepted).toBe(false);
    expect(confirmation.changed).toBe(false);
    expect(confirmation.reason).toBe("authority offline");
    expect(confirmation.revision).toBe("7");
    expect(session.currentDocument.revision).toBe("7");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(session.pendingOperationIds).toHaveLength(0);
  });
});

describe("remote-client session binding", () => {
  test("应暴露 authoritative document projection 标记，并默认不释放外层 authority client", () => {
    let disposed = false;
    let unsubscribed = false;
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      },
      subscribeDocument() {
        return () => {
          unsubscribed = true;
        };
      },
      dispose() {
        disposed = true;
      }
    };
    const factory = createConfigurableSessionBindingFactory({
      mode: "remote-client",
      remoteClient: {
        client: authorityClient
      }
    });
    const binding = factory({
      graph: {} as LeaferGraph,
      document: createTestDocument()
    });

    expect(binding.projectsSessionDocument).toBe(true);
    binding.dispose();
    expect(unsubscribed).toBe(true);
    expect(disposed).toBe(false);
  });

  test("显式声明 ownership 后，binding dispose 应释放 authority client", () => {
    let disposed = false;
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
        };
      },
      subscribeDocument() {
        return () => {};
      },
      dispose() {
        disposed = true;
      }
    };
    const factory = createConfigurableSessionBindingFactory({
      mode: "remote-client",
      remoteClient: {
        client: authorityClient,
        disposeClientOnDispose: true
      }
    });
    const binding = factory({
      graph: {} as LeaferGraph,
      document: createTestDocument()
    });

    binding.dispose();
    expect(disposed).toBe(true);
  });
});
