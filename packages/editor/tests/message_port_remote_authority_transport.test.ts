import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import type { EditorRemoteAuthorityProtocolAdapter } from "../src/session/graph_document_authority_protocol";
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

function createCustomProtocolAdapter(): EditorRemoteAuthorityProtocolAdapter {
  return {
    createRequestEnvelope(requestId, request) {
      return {
        kind: "custom.request",
        id: requestId,
        payload: request
      } as never;
    },

    createSuccessEnvelope(requestId, response) {
      return {
        kind: "custom.response",
        id: requestId,
        result: response
      } as never;
    },

    createErrorEnvelope(requestId, code, message, data) {
      return {
        kind: "custom.response",
        id: requestId,
        error: {
          code,
          message,
          data
        }
      } as never;
    },

    createNotificationEnvelope(event) {
      return {
        kind: "custom.event",
        payload: event
      } as never;
    },

    parseRequestEnvelope(value) {
      if (typeof value !== "object" || value === null) {
        return null;
      }

      const record = value as Record<string, unknown>;
      if (record.kind !== "custom.request") {
        return null;
      }

      return {
        jsonrpc: "2.0",
        id: record.id,
        method: (record.payload as { method: string }).method,
        request: record.payload
      } as never;
    },

    parseInboundEnvelope(value) {
      if (typeof value !== "object" || value === null) {
        return null;
      }

      const record = value as Record<string, unknown>;
      switch (record.kind) {
        case "custom.event":
          return {
            jsonrpc: "2.0",
            method: "custom.event",
            event: record.payload
          } as never;
        case "custom.response":
          return "error" in record
            ? ({
                jsonrpc: "2.0",
                id: record.id,
                ok: false,
                error: record.error
              } as never)
            : ({
                jsonrpc: "2.0",
                id: record.id,
                ok: true,
                result: record.result
              } as never);
        default:
          return null;
      }
    }
  };
}

function createAuthorityServiceHarness(initialDocument: GraphDocument): {
  actions: string[];
  service: EditorRemoteAuthorityDocumentService;
} {
  let currentDocument = structuredClone(initialDocument);
  const actions: string[] = [];
  const documentListeners = new Set<(document: GraphDocument) => void>();
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
          for (const listener of documentListeners) {
            listener(structuredClone(currentDocument));
          }
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
      },
      subscribeDocument(listener: (document: GraphDocument) => void): () => void {
        documentListeners.add(listener);
        return () => {
          documentListeners.delete(listener);
        };
      }
    }
  };
}

describe("createMessagePortRemoteAuthorityTransport", () => {
  test("应通过 MessagePort 收发 request-response、document push 和 runtime feedback", async () => {
    const channel = new MessageChannel();
    const authority = createAuthorityServiceHarness(createDocument("1"));
    const transport = createMessagePortRemoteAuthorityTransport({
      port: channel.port1
    });
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: authority.service
    });

    const authorityEvents: string[] = [];
    const disposeFeedbackSubscription = transport.subscribe((event) => {
      authorityEvents.push(event.type);
    });

    const documentResponse = await transport.request({
      method: "authority.getDocument"
    });
    expect(documentResponse.revision).toBe("1");

    const submitResponse = await transport.request({
      method: "authority.submitOperation",
      params: {
        operation: createOperation("op-1"),
        context: {
          currentDocument: createDocument("1"),
          pendingOperationIds: ["op-1"]
        }
      }
    });
    expect(submitResponse.changed).toBe(true);

    await flushMessages();
    expect(authorityEvents).toEqual(["document", "runtimeFeedback"]);

    const replaceResponse = await transport.request({
      method: "authority.replaceDocument",
      params: {
        document: createDocument("8"),
        context: {
          currentDocument: createDocument("2")
        }
      }
    });
    expect(replaceResponse?.revision).toBe("8");
    expect(authority.actions).toEqual([
      "getDocument",
      "submitOperation",
      "replaceDocument"
    ]);

    disposeFeedbackSubscription();
    transport.dispose?.();
    host.dispose();
  });

  test("transport 与 host 应允许共享自定义 protocol adapter", async () => {
    const channel = new MessageChannel();
    const protocolAdapter = createCustomProtocolAdapter();
    const authority = createAuthorityServiceHarness(createDocument("11"));
    const transport = createMessagePortRemoteAuthorityTransport({
      port: channel.port1,
      protocolAdapter
    });
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: authority.service,
      protocolAdapter
    });

    const documentResponse = await transport.request({
      method: "authority.getDocument"
    });
    expect(documentResponse.revision).toBe("11");

    transport.dispose?.();
    host.dispose();
  });
});

describe("createMessagePortRemoteAuthorityClient", () => {
  test("应把 MessagePort transport 包装成标准 authority client", async () => {
    const channel = new MessageChannel();
    let currentDocument = createDocument("5");
    const documentListeners = new Set<(document: GraphDocument) => void>();
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
          queueMicrotask(() => {
            for (const listener of documentListeners) {
              listener(structuredClone(currentDocument));
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
          currentDocument = structuredClone(document);
          queueMicrotask(() => {
            for (const listener of documentListeners) {
              listener(structuredClone(currentDocument));
            }
          });
          return structuredClone(currentDocument);
        },
        subscribeDocument(listener: (document: GraphDocument) => void): () => void {
          documentListeners.add(listener);
          return () => {
            documentListeners.delete(listener);
          };
        }
      }
    });

    const client = createMessagePortRemoteAuthorityClient({
      port: channel.port1
    });
    const pushedDocumentRevisions: string[] = [];
    const disposeDocumentSubscription = client.subscribeDocument((document) => {
      pushedDocumentRevisions.push(String(document.revision));
    });

    expect((await client.getDocument()).revision).toBe("5");

    const submitResult = await client.submitOperation(createOperation("op-2"), {
      currentDocument: createDocument("5"),
      pendingOperationIds: ["op-2"]
    });
    expect(submitResult.revision).toBe("6");
    expect(submitResult.document?.revision).toBe("6");
    await flushMessages();
    expect(pushedDocumentRevisions).toEqual(["6"]);

    const replacedDocument = await client.replaceDocument?.(createDocument("9"), {
      currentDocument: createDocument("6")
    });
    expect(replacedDocument?.revision).toBe("9");

    disposeDocumentSubscription();
    client.dispose?.();
    host.dispose();
  });
});
