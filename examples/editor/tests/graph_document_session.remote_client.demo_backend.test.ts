import "./helpers/install_test_host_polyfills";
import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import { createRemoteGraphDocumentSession } from "../src/session/graph_document_session";
import {
  createNodeProcessRemoteAuthorityClient,
  type CreateNodeProcessRemoteAuthorityTransportOptions
} from "../src/session/node_process_remote_authority_client";

interface DemoBackendClientHandle {
  client: ReturnType<typeof createNodeProcessRemoteAuthorityClient>;
  dispose(): void;
}

const demoBackendHandles = new Set<DemoBackendClientHandle>();

function createDemoBackendClient(): DemoBackendClientHandle {
  const scriptPath = path.join(
    import.meta.dir,
    "fixtures",
    "remote_authority_demo_backend.mjs"
  );
  const options: CreateNodeProcessRemoteAuthorityTransportOptions = {
    args: [scriptPath]
  };
  const client = createNodeProcessRemoteAuthorityClient(options);
  const handle: DemoBackendClientHandle = {
    client,
    dispose(): void {
      client.dispose();
    }
  };
  demoBackendHandles.add(handle);
  return handle;
}

function createNodeRemoveOperation(): GraphOperation {
  return {
    type: "node.remove",
    nodeId: "node-1",
    operationId: "demo-backend-remove-node-1",
    timestamp: Date.now(),
    source: "editor.test"
  };
}

afterEach(() => {
  for (const handle of demoBackendHandles) {
    handle.dispose();
    demoBackendHandles.delete(handle);
  }
});

describe("createRemoteGraphDocumentSession + demo backend", () => {
  test("应串通 authority 文档确认、replaceDocument 与 runtime feedback", async () => {
    const backend = createDemoBackendClient();
    const initialDocument = await backend.client.getDocument();
    const session = createRemoteGraphDocumentSession({
      document: initialDocument,
      client: backend.client
    });
    const documentRevisions: Array<GraphDocument["revision"]> = [];
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeDocumentSubscription = session.subscribe((document) => {
      documentRevisions.push(document.revision);
    });
    const disposeRuntimeFeedbackSubscription = backend.client.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    const submission = session.submitOperationWithAuthority(
      createNodeRemoveOperation()
    );
    expect(submission.applyResult.accepted).toBe(true);
    expect(submission.applyResult.changed).toBe(false);
    expect(session.pendingOperationIds).toEqual(["demo-backend-remove-node-1"]);

    const confirmation = await submission.confirmation;
    expect(confirmation.accepted).toBe(true);
    expect(confirmation.changed).toBe(true);
    expect(confirmation.revision).toBe("2");
    expect(session.pendingOperationIds).toHaveLength(0);
    expect(session.currentDocument.nodes.map((node) => node.id)).toEqual(["node-2"]);
    expect(documentRevisions).toEqual(["1", "2"]);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-1" &&
          event.event.exists === false
      )
    ).toBe(true);

    session.replaceDocument({
      documentId: "demo-backend-doc-3",
      revision: "7",
      appKind: "demo-backend",
      nodes: [],
      links: [],
      meta: {
        replaced: "session"
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(session.currentDocument.documentId).toBe("demo-backend-doc-3");
    expect(session.currentDocument.revision).toBe("7");

    disposeDocumentSubscription();
    disposeRuntimeFeedbackSubscription();
  });
});
