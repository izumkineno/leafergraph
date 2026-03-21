import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  GraphOperation,
  RuntimeFeedbackEvent
} from "leafergraph";
import { createMessagePortRemoteAuthorityClient } from "../src/session/message_port_remote_authority_transport";
import { createMessagePortRemoteAuthorityTransport } from "../src/session/message_port_remote_authority_transport";
import { createMessagePortRemoteAuthorityHost } from "../src/session/message_port_remote_authority_host";
import type { EditorRemoteAuthorityDocumentService } from "../src/session/graph_document_authority_service";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "message-port-host-doc",
    revision,
    appKind: "message-port-host-test",
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
    source: "message-port.host.test",
    nodeId: "node-a",
    input: {
      x: 160,
      y: 40
    }
  };
}

function flushMessages(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("createMessagePortRemoteAuthorityHost", () => {
  test("应把 authority service 暴露为 MessagePort 对端", async () => {
    const channel = new MessageChannel();
    let currentDocument = createDocument("1");
    const feedbackListeners = new Set<(event: RuntimeFeedbackEvent) => void>();
    const service: EditorRemoteAuthorityDocumentService = {
      getDocument(): GraphDocument {
        return structuredClone(currentDocument);
      },
      submitOperation(): {
        accepted: boolean;
        changed: boolean;
        revision: GraphDocument["revision"];
        document: GraphDocument;
      } {
        currentDocument = createDocument("2");
        queueMicrotask(() => {
          for (const listener of feedbackListeners) {
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
      replaceDocument(document: GraphDocument): GraphDocument {
        currentDocument = structuredClone(document);
        return structuredClone(currentDocument);
      },
      subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
        feedbackListeners.add(listener);
        return () => {
          feedbackListeners.delete(listener);
        };
      }
    };
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service
    });
    const client = createMessagePortRemoteAuthorityClient({
      port: channel.port1
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = client.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    expect((await client.getDocument()).revision).toBe("1");

    const submitResult = await client.submitOperation(createOperation("op-1"), {
      currentDocument: createDocument("1"),
      pendingOperationIds: ["op-1"]
    });
    expect(submitResult.accepted).toBe(true);
    expect(submitResult.revision).toBe("2");

    await flushMessages();
    expect(
      runtimeFeedbackEvents.some(
        (event) =>
          event.type === "node.state" &&
          event.event.nodeId === "node-a" &&
          event.event.reason === "moved"
      )
    ).toBe(true);

    const replacedDocument = await client.replaceDocument(createDocument("9"), {
      currentDocument: createDocument("2")
    });
    expect(replacedDocument?.revision).toBe("9");

    disposeRuntimeFeedbackSubscription();
    client.dispose?.();
    host.dispose();
  });

  test("释放 host 时应顺带释放 authority service", () => {
    const channel = new MessageChannel();
    let disposed = false;
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: {
        getDocument(): GraphDocument {
          return createDocument("1");
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: "1"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        },
        dispose(): void {
          disposed = true;
        }
      },
      disposeServiceOnDispose: true
    });

    host.dispose();
    expect(disposed).toBe(true);

    channel.port1.close();
  });

  test("应透传 authority 运行控制请求", async () => {
    const channel = new MessageChannel();
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: {
        getDocument(): GraphDocument {
          return createDocument("1");
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: "1"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        },
        controlRuntime(request) {
          return {
            accepted: true,
            changed: request.type === "graph.step",
            state: {
              status: "idle",
              queueSize: 0,
              stepCount: request.type === "graph.step" ? 1 : 0,
              lastSource: request.type === "graph.step" ? "graph-step" : undefined
            }
          };
        }
      }
    });
    const client = createMessagePortRemoteAuthorityClient({
      port: channel.port1
    });

    const result = await client.controlRuntime({
      type: "graph.step"
    });

    expect(result).toMatchObject({
      accepted: true,
      changed: true,
      state: {
        status: "idle",
        queueSize: 0,
        stepCount: 1,
        lastSource: "graph-step"
      }
    });

    client.dispose?.();
    host.dispose();
  });

  test("应支持通过 MessagePort host 返回 rpc.discover 文档", async () => {
    const channel = new MessageChannel();
    const host = createMessagePortRemoteAuthorityHost({
      port: channel.port2,
      service: {
        getDocument(): GraphDocument {
          return createDocument("1");
        },
        submitOperation() {
          return {
            accepted: true,
            changed: false,
            revision: "1"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        }
      }
    });
    const transport = createMessagePortRemoteAuthorityTransport({
      port: channel.port1
    });

    const discoverDocument = await transport.request({
      method: "rpc.discover"
    });

    expect(discoverDocument).toMatchObject({
      openrpc: "1.3.2",
      methods: expect.any(Array)
    });

    transport.dispose?.();
    host.dispose();
  });
});
