import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import {
  createMessagePortRemoteAuthorityClient,
  createMessagePortRemoteAuthorityTransport
} from "../src/session/message_port_remote_authority_transport";
import { createMessagePortRemoteAuthorityHost } from "../src/session/message_port_remote_authority_host";
import type { EditorRemoteAuthorityDocumentService } from "../src/session/graph_document_authority_service";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "message-port-doc",
    revision,
    appKind: "message-port-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createOperation(operationId: string): GraphOperation {
  return {
    type: "node.remove",
    operationId,
    timestamp: Date.now(),
    source: "message-port.test",
    nodeId: "node-a"
  };
}

function flushMessages(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createAuthorityServiceHarness(initialDocument: GraphDocument): {
  actions: string[];
  service: EditorRemoteAuthorityDocumentService;
} {
  let currentDocument = structuredClone(initialDocument);
  const actions: string[] = [];
  const feedbackListeners = new Set<(event: RuntimeFeedbackEvent) => void>();

  return {
    actions,
    service: {
      getDocument(): GraphDocument {
        actions.push("getDocument");
        return structuredClone(currentDocument);
      },
      submitOperation(): {
        accepted: boolean;
        changed: boolean;
        revision: GraphDocument["revision"];
        document: GraphDocument;
      } {
        actions.push("submitOperation");
        currentDocument = createDocument("2");
        queueMicrotask(() => {
          for (const listener of feedbackListeners) {
            listener({
              type: "node.state",
              event: {
                nodeId: "node-a",
                exists: false,
                reason: "removed",
                timestamp: Date.now()
              }
            });
          }
        });
        return {
          accepted: true,
          changed: true,
          revision: currentDocument.revision,
          document: structuredClone(currentDocument)
        };
      },
      replaceDocument(document: GraphDocument): GraphDocument {
        actions.push("replaceDocument");
        currentDocument = structuredClone(document);
        return structuredClone(currentDocument);
      },
      subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
        feedbackListeners.add(listener);
        return () => {
          feedbackListeners.delete(listener);
        };
      }
    }
  };
}

describe("createMessagePortRemoteAuthorityTransport", () => {
  test("应通过 MessagePort 收发 request-response 和 runtime feedback", async () => {
    const channel = new MessageChannel();
    const authority = createAuthorityServiceHarness(createDocument("1"));
    const transport = createMessagePortRemoteAuthorityTransport({
      port: channel.port1
    });
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: authority.service
    });

    const feedbackEvents: string[] = [];
    const disposeFeedbackSubscription = transport.subscribe((event) => {
      feedbackEvents.push(event.type);
    });

    const documentResponse = await transport.request({
      action: "getDocument"
    });
    expect(documentResponse.action).toBe("getDocument");
    expect(documentResponse.document.revision).toBe("1");

    const submitResponse = await transport.request({
      action: "submitOperation",
      operation: createOperation("op-1"),
      context: {
        currentDocument: createDocument("1"),
        pendingOperationIds: ["op-1"]
      }
    });
    expect(submitResponse.action).toBe("submitOperation");
    expect(submitResponse.result.changed).toBe(true);

    await flushMessages();
    expect(feedbackEvents).toEqual(["runtimeFeedback"]);

    const replaceResponse = await transport.request({
      action: "replaceDocument",
      document: createDocument("8"),
      context: {
        currentDocument: createDocument("2")
      }
    });
    expect(replaceResponse.action).toBe("replaceDocument");
    expect(replaceResponse.document?.revision).toBe("8");
    expect(authority.actions).toEqual([
      "getDocument",
      "submitOperation",
      "replaceDocument"
    ]);

    disposeFeedbackSubscription();
    transport.dispose?.();
    host.dispose();
  });
});

describe("createMessagePortRemoteAuthorityClient", () => {
  test("应把 MessagePort transport 包装成标准 authority client", async () => {
    const channel = new MessageChannel();
    let currentDocument = createDocument("5");
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: {
        getDocument(): GraphDocument {
          return structuredClone(currentDocument);
        },
        submitOperation(): {
          accepted: boolean;
          changed: boolean;
          revision: GraphDocument["revision"];
          document: GraphDocument;
        } {
          currentDocument = createDocument("6");
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: structuredClone(currentDocument)
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          currentDocument = structuredClone(document);
          return structuredClone(currentDocument);
        }
      }
    });

    const client = createMessagePortRemoteAuthorityClient({
      port: channel.port1
    });

    expect((await client.getDocument()).revision).toBe("5");

    const submitResult = await client.submitOperation(createOperation("op-2"), {
      currentDocument: createDocument("5"),
      pendingOperationIds: ["op-2"]
    });
    expect(submitResult.revision).toBe("6");
    expect(submitResult.document?.revision).toBe("6");

    const replacedDocument = await client.replaceDocument?.(createDocument("9"), {
      currentDocument: createDocument("6")
    });
    expect(replacedDocument?.revision).toBe("9");

    client.dispose?.();
    host.dispose();
  });
});
