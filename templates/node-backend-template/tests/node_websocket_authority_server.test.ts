import { afterEach, describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/node";
import WebSocket from "ws";

import {
  DEFAULT_AUTHORITY_PROTOCOL_ADAPTER,
  startNodeAuthorityServer,
  type AuthorityGraphOperation,
  type AuthorityOutboundEnvelope
} from "../src/index.js";

type AuthoritySuccessEnvelope = Extract<
  AuthorityOutboundEnvelope,
  { channel: "authority.response"; ok: true }
>;

type AuthorityEventEnvelope = Extract<
  AuthorityOutboundEnvelope,
  { channel: "authority.event" }
>;

const authorityServers = new Set<
  Awaited<ReturnType<typeof startNodeAuthorityServer>>
>();

function waitForDelay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function waitForSocketOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("open", handleOpen);
      socket.off("error", handleError);
    };

    socket.on("open", handleOpen);
    socket.on("error", handleError);
  });
}

function waitForSocketClose(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    socket.once("close", () => {
      resolve();
    });
  });
}

async function waitForEnvelope<TEnvelope extends AuthorityOutboundEnvelope>(
  messages: AuthorityOutboundEnvelope[],
  predicate: (envelope: AuthorityOutboundEnvelope) => envelope is TEnvelope,
  timeoutMs = 1000
): Promise<TEnvelope> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const matchedEnvelope = messages.find(predicate);
    if (matchedEnvelope) {
      return matchedEnvelope;
    }
    await waitForDelay(10);
  }

  throw new Error("等待 authority envelope 超时");
}

function createNodeRemoveOperation(): AuthorityGraphOperation {
  return {
    type: "node.remove",
    nodeId: "node-1",
    operationId: "template-node-websocket-remove-node-1",
    timestamp: Date.now(),
    source: "template.websocket.test"
  };
}

function createSampleAuthorityDocument(): GraphDocument {
  return {
    documentId: "node-authority-doc",
    revision: "1",
    appKind: "node-backend-demo",
    nodes: [
      {
        id: "node-1",
        type: "test/source-node",
        title: "Node 1",
        layout: {
          x: 0,
          y: 0,
          width: 240,
          height: 140
        },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [{ name: "Output", type: "event" }],
        widgets: [],
        data: {}
      },
      {
        id: "node-2",
        type: "test/target-node",
        title: "Node 2",
        layout: {
          x: 320,
          y: 0,
          width: 240,
          height: 140
        },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [{ name: "Input", type: "event" }],
        outputs: [],
        widgets: [],
        data: {}
      }
    ],
    links: [
      {
        id: "link-1",
        source: { nodeId: "node-1", slot: 0 },
        target: { nodeId: "node-2", slot: 0 }
      }
    ],
    meta: {}
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
      authorityName: "node-websocket-test",
      initialDocument: createSampleAuthorityDocument()
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

    const socket = new WebSocket(server.authorityUrl);
    const messages: AuthorityOutboundEnvelope[] = [];
    socket.on("message", (rawData) => {
      messages.push(JSON.parse(rawData.toString()) as AuthorityOutboundEnvelope);
    });
    await waitForSocketOpen(socket);

    const connectedHealth = await fetch(server.healthUrl).then((response) =>
      response.json()
    );
    expect(connectedHealth.connectionCount).toBe(1);
    const frontendBundlesEnvelope = await waitForEnvelope(
      messages,
      (envelope): envelope is AuthorityEventEnvelope =>
        envelope.channel === "authority.event" &&
        envelope.event.type === "frontendBundles.sync" &&
        envelope.event.event.type === "frontendBundles.sync" &&
        envelope.event.event.mode === "full"
    );
    const timerPackage = frontendBundlesEnvelope.event.event.packages?.find(
      (entry) => entry.packageId === "@template/timer-node-package"
    );
    const timerNodeBundle = timerPackage?.bundles.find(
      (bundle) => bundle.bundleId === "@template/timer-node-package/node"
    );
    const timerDemoBundle = timerPackage?.bundles.find(
      (bundle) => bundle.bundleId === "@template/timer-node-package/demo"
    );

    expect(timerNodeBundle).toMatchObject({
      format: "node-json",
      fileName: "node.bundle.json",
      quickCreateNodeType: "system/timer"
    });
    expect(
      timerNodeBundle && "definition" in timerNodeBundle
        ? timerNodeBundle.definition
        : null
    ).toMatchObject({
      type: "system/timer"
    });
    expect(timerDemoBundle).toMatchObject({
      format: "demo-json",
      fileName: "demo.bundle.json"
    });
    expect(
      timerDemoBundle && "document" in timerDemoBundle
        ? timerDemoBundle.document
        : null
    ).toMatchObject({
      documentId: "timer-package-demo-doc"
    });

    socket.send(
      JSON.stringify(
        DEFAULT_AUTHORITY_PROTOCOL_ADAPTER.createRequestEnvelope("get-document", {
          action: "getDocument"
        })
      )
    );

    const getDocumentEnvelope = await waitForEnvelope(
      messages,
      (envelope): envelope is AuthoritySuccessEnvelope =>
        envelope.channel === "authority.response" &&
        envelope.ok === true &&
        envelope.requestId === "get-document"
    );
    if (getDocumentEnvelope.response.action !== "getDocument") {
      throw new Error("authority 未返回 getDocument 响应");
    }
    const initialDocument = getDocumentEnvelope.response.document;
    expect(initialDocument.documentId).toBe("node-authority-doc");
    expect(initialDocument.revision).toBe("1");

    socket.send(
      JSON.stringify(
        DEFAULT_AUTHORITY_PROTOCOL_ADAPTER.createRequestEnvelope("submit-node-remove", {
          action: "submitOperation",
          operation: createNodeRemoveOperation(),
          context: {
            currentDocument: initialDocument,
            pendingOperationIds: []
          }
        })
      )
    );

    const submitEnvelope = await waitForEnvelope(
      messages,
      (envelope): envelope is AuthoritySuccessEnvelope =>
        envelope.channel === "authority.response" &&
        envelope.ok === true &&
        envelope.requestId === "submit-node-remove"
    );
    if (submitEnvelope.response.action !== "submitOperation") {
      throw new Error("authority 未返回 submitOperation 响应");
    }
    expect(submitEnvelope.response.result).toMatchObject({
      accepted: true,
      changed: true,
      revision: "2"
    });

    await waitForEnvelope(
      messages,
      (envelope): envelope is AuthorityEventEnvelope =>
        envelope.channel === "authority.event" &&
        envelope.event.type === "document" &&
        envelope.event.document.revision === "2"
    );
    await waitForEnvelope(
      messages,
      (envelope): envelope is AuthorityEventEnvelope =>
        envelope.channel === "authority.event" &&
        envelope.event.type === "runtimeFeedback" &&
        envelope.event.event.type === "node.state" &&
        envelope.event.event.event.nodeId === "node-1" &&
        envelope.event.event.event.exists === false
    );

    const replacementDocument: GraphDocument = {
      documentId: "node-authority-doc-2",
      revision: "7",
      appKind: "node-backend-demo",
      nodes: [],
      links: [],
      meta: {
        replacedBy: "template-websocket-test"
      }
    };

    socket.send(
      JSON.stringify(
        DEFAULT_AUTHORITY_PROTOCOL_ADAPTER.createRequestEnvelope("replace-document", {
          action: "replaceDocument",
          document: replacementDocument,
          context: {
            currentDocument:
              submitEnvelope.response.result.document ?? initialDocument
          }
        })
      )
    );

    const replaceEnvelope = await waitForEnvelope(
      messages,
      (envelope): envelope is AuthoritySuccessEnvelope =>
        envelope.channel === "authority.response" &&
        envelope.ok === true &&
        envelope.requestId === "replace-document"
    );
    if (replaceEnvelope.response.action !== "replaceDocument") {
      throw new Error("authority 未返回 replaceDocument 响应");
    }
    expect(replaceEnvelope.response.document).toMatchObject({
      documentId: "node-authority-doc-2",
      revision: "7"
    });

    await waitForEnvelope(
      messages,
      (envelope): envelope is AuthorityEventEnvelope =>
        envelope.channel === "authority.event" &&
        envelope.event.type === "document" &&
        envelope.event.document.documentId === "node-authority-doc-2" &&
        envelope.event.document.revision === "7"
    );

    socket.close();
    await waitForSocketClose(socket);
    await waitForDelay(20);

    const disconnectedHealth = await fetch(server.healthUrl).then((response) =>
      response.json()
    );
    expect(disconnectedHealth.connectionCount).toBe(0);
  });
});
