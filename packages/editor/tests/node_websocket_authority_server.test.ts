import { afterEach, describe, expect, test } from "bun:test";

import type { GraphOperation, RuntimeFeedbackEvent } from "leafergraph";
import { startNodeAuthorityServer } from "../../node/src/authority";
import { createTransportRemoteAuthorityClient } from "../src/session/graph_document_authority_transport";
import { createWebSocketRemoteAuthorityTransport } from "../src/session/websocket_remote_authority_transport";

const authorityServers = new Set<Awaited<ReturnType<typeof startNodeAuthorityServer>>>();

function createNodeRemoveOperation(): GraphOperation {
  return {
    type: "node.remove",
    nodeId: "node-1",
    operationId: "node-websocket-remove-node-1",
    timestamp: Date.now(),
    source: "editor.websocket.test"
  };
}

afterEach(async () => {
  for (const server of authorityServers) {
    await server.close();
    authorityServers.delete(server);
  }
});

describe("node websocket authority server", () => {
  test("应提供 health、authority 文档确认与 runtime feedback", async () => {
    const server = await startNodeAuthorityServer({
      port: 0,
      authorityName: "node-websocket-test"
    });
    authorityServers.add(server);

    const initialHealth = await fetch(server.healthUrl).then((response) =>
      response.json()
    );
    expect(initialHealth).toEqual({
      ok: true,
      documentId: "node-authority-doc",
      revision: "1",
      connectionCount: 0
    });

    const transport = createWebSocketRemoteAuthorityTransport({
      url: server.authorityUrl
    });
    await transport.ready;

    const connectedHealth = await fetch(server.healthUrl).then((response) =>
      response.json()
    );
    expect(connectedHealth.connectionCount).toBe(1);

    const client = createTransportRemoteAuthorityClient({
      transport
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = client.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    const initialDocument = await client.getDocument();
    expect(initialDocument.documentId).toBe("node-authority-doc");
    expect(initialDocument.revision).toBe("1");

    const submitResult = await client.submitOperation(createNodeRemoveOperation(), {
      currentDocument: initialDocument,
      pendingOperationIds: []
    });
    expect(submitResult.accepted).toBe(true);
    expect(submitResult.changed).toBe(true);
    expect(submitResult.revision).toBe("2");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-1" &&
          event.event.exists === false
      )
    ).toBe(true);

    const replacedDocument = await client.replaceDocument(
      {
        documentId: "node-authority-doc-2",
        revision: "7",
        appKind: "node-authority-demo",
        nodes: [],
        links: [],
        meta: {
          replacedBy: "websocket-test"
        }
      },
      {
        currentDocument: submitResult.document ?? initialDocument
      }
    );
    expect(replacedDocument?.documentId).toBe("node-authority-doc-2");
    expect(replacedDocument?.revision).toBe("7");

    disposeRuntimeFeedbackSubscription();
    client.dispose?.();
  });
});
