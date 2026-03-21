import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import {
  createClientBackedRemoteAuthorityService,
  createTransportBackedRemoteAuthorityService
} from "../src/session/graph_document_authority_service_bridge";
import type {
  EditorRemoteAuthorityDocumentClient,
  EditorRemoteAuthorityTransport,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "../src/session/graph_document_authority_transport";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "service-bridge-doc",
    revision,
    appKind: "service-bridge-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createOperation(operationId: string): GraphOperation {
  return {
    type: "node.move",
    operationId,
    timestamp: Date.now(),
    source: "service.bridge.test",
    nodeId: "node-a",
    input: {
      x: 160,
      y: 48
    }
  };
}

describe("graph document authority service bridge", () => {
  test("createClientBackedRemoteAuthorityService 应代理 client 并转发反馈", async () => {
    const runtimeFeedbackListeners = new Set<
      (event: RuntimeFeedbackEvent) => void
    >();
    let disposed = false;
    let currentDocument = createDocument("1");
    const client: EditorRemoteAuthorityDocumentClient = {
      async getDocument() {
        return structuredClone(currentDocument);
      },
      async submitOperation() {
        currentDocument = createDocument("2");
        queueMicrotask(() => {
          for (const listener of runtimeFeedbackListeners) {
            listener({
              type: "node.state",
              event: {
                nodeId: "node-a",
                exists: true,
                reason: "moved",
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
      async replaceDocument(document: GraphDocument) {
        currentDocument = structuredClone(document);
        return structuredClone(currentDocument);
      },
      subscribe(listener) {
        runtimeFeedbackListeners.add(listener);
        return () => {
          runtimeFeedbackListeners.delete(listener);
        };
      },
      dispose() {
        disposed = true;
      }
    };
    const service = createClientBackedRemoteAuthorityService({
      client
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = service.subscribe?.((event) => {
      runtimeFeedbackEvents.push(event);
    });

    expect((await service.getDocument()).revision).toBe("1");
    expect(
      (
        await service.submitOperation(createOperation("service-bridge-op"), {
          currentDocument: createDocument("1"),
          pendingOperationIds: []
        })
      ).revision
    ).toBe("2");
    await Promise.resolve();

    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-a" &&
          event.event.reason === "moved"
      )
    ).toBe(true);

    const replacedDocument = await service.replaceDocument?.(createDocument("9"), {
      currentDocument: createDocument("2")
    });
    expect(replacedDocument?.revision).toBe("9");

    disposeRuntimeFeedbackSubscription?.();
    service.dispose?.();
    expect(disposed).toBe(true);
  });

  test("createTransportBackedRemoteAuthorityService 应复用 transport client", async () => {
    const transportListeners = new Set<
      (event: EditorRemoteAuthorityTransportEvent) => void
    >();
    let disposed = false;
    let currentDocument = createDocument("3");
    const transport: EditorRemoteAuthorityTransport = {
      async request<TResponse extends EditorRemoteAuthorityTransportResponse>(
        request: EditorRemoteAuthorityTransportRequest
      ): Promise<TResponse> {
        switch (request.method) {
          case "authority.getDocument":
            return structuredClone(currentDocument) as TResponse;
          case "authority.submitOperation":
            currentDocument = createDocument("4");
            queueMicrotask(() => {
              for (const listener of transportListeners) {
                listener({
                  type: "runtimeFeedback",
                  event: {
                    type: "node.state",
                    event: {
                      nodeId: "node-a",
                      exists: true,
                      reason: "moved",
                      timestamp: Date.now()
                    }
                  }
                });
              }
            });
            return {
              accepted: true,
              changed: true,
              revision: currentDocument.revision,
              document: structuredClone(currentDocument)
            } as TResponse;
          case "authority.replaceDocument":
            currentDocument = structuredClone(request.params.document);
            return structuredClone(currentDocument) as TResponse;
          case "authority.controlRuntime":
            return {
              accepted: false,
              changed: false,
              reason: "transport stub 不支持运行控制"
            } as TResponse;
          case "rpc.discover":
            return {
              openrpc: "1.3.2",
              info: {
                title: "Service Bridge Stub Authority",
                version: "0.0.0"
              }
            } as TResponse;
        }
      },
      subscribe(listener) {
        transportListeners.add(listener);
        return () => {
          transportListeners.delete(listener);
        };
      },
      dispose() {
        disposed = true;
      }
    };
    const service = createTransportBackedRemoteAuthorityService({
      transport
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = service.subscribe?.((event) => {
      runtimeFeedbackEvents.push(event);
    });

    expect((await service.getDocument()).revision).toBe("3");
    expect(
      (
        await service.submitOperation(createOperation("transport-bridge-op"), {
          currentDocument: createDocument("3"),
          pendingOperationIds: []
        })
      ).revision
    ).toBe("4");
    await Promise.resolve();

    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-a" &&
          event.event.reason === "moved"
      )
    ).toBe(true);

    service.dispose?.();
    disposeRuntimeFeedbackSubscription?.();
    expect(disposed).toBe(true);
  });
});
