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
});

describe("remote-client session binding", () => {
  test("应暴露 authoritative document projection 标记并在 dispose 时释放 client", () => {
    let disposed = false;
    const authorityClient: EditorRemoteAuthorityClient = {
      async submitOperation() {
        return {
          accepted: true,
          changed: false,
          revision: "1"
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
    expect(disposed).toBe(true);
  });
});
