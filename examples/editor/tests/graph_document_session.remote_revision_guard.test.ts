import "./helpers/install_test_host_polyfills";

import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphDocumentDiff,
  GraphOperation
} from "leafergraph";
import type { EditorRemoteAuthorityClient } from "../src/session/graph_document_authority_client";
import { createRemoteGraphDocumentSession } from "../src/session/graph_document_session";

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

describe("createRemoteGraphDocumentSession authoritative revision guard", () => {
  test("response 已提交的 revision 遇到迟到 diff 时应直接忽略，而不是误触发 resync", async () => {
    const initialDocument = createTestDocument();
    let emitDocumentDiff: ((diff: GraphDocumentDiff) => void) | null = null;
    let getDocumentCount = 0;
    const authorityClient: EditorRemoteAuthorityClient = {
      async getDocument() {
        getDocumentCount += 1;
        return {
          ...initialDocument,
          revision: "9",
          nodes: []
        };
      },
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
    const projectionRevisions: string[] = [];
    session.subscribeProjection?.((projection) => {
      projectionRevisions.push(String(projection.document.revision));
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation()
    );
    await submission.confirmation;

    emitDocumentDiff?.({
      documentId: "remote-doc",
      baseRevision: "1",
      revision: "2",
      emittedAt: 1,
      operations: [],
      fieldChanges: []
    });
    await Promise.resolve();

    expect(getDocumentCount).toBe(0);
    expect(session.currentDocument.revision).toBe("2");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(projectionRevisions).toEqual(["1", "2"]);

    session.dispose?.();
  });

  test("replaceDocument 的 authority response 应再发一次 authoritative full projection", async () => {
    const initialDocument = createTestDocument();
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: {
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
      }
    });
    const projectionRevisions: string[] = [];
    session.subscribeProjection?.((projection) => {
      projectionRevisions.push(String(projection.document.revision));
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
    await Promise.resolve();

    expect(session.currentDocument.documentId).toBe("remote-doc-2");
    expect(session.currentDocument.revision).toBe("11");
    expect(session.currentDocument.meta).toEqual({
      authority: "confirmed"
    });
    expect(projectionRevisions).toEqual(["1", "10", "11"]);

    session.dispose?.();
  });

  test("authority.document 同 revision 重复回推时应忽略，不重复覆盖当前快照", async () => {
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

    emitDocument?.({
      ...initialDocument,
      revision: "3",
      nodes: initialDocument.nodes
    });
    await Promise.resolve();

    expect(session.currentDocument.revision).toBe("3");
    expect(session.currentDocument.nodes).toHaveLength(0);
    expect(revisions).toEqual(["1", "3"]);

    session.dispose?.();
  });
});
