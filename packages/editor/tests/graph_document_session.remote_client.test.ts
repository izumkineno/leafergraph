import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
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
  test("应暴露 authoritative document projection 标记并在 dispose 时释放 client 与订阅", () => {
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
    expect(disposed).toBe(true);
  });
});
