import "./helpers/install_test_host_polyfills";
import { describe, expect, test } from "bun:test";

import type {
  GraphDocument,
  RuntimeFeedbackEvent
} from "leafergraph";
import { createMessagePortRemoteAuthorityClient } from "../src/session/message_port_remote_authority_transport";
import { attachMessagePortRemoteAuthorityWorkerHost } from "../src/session/message_port_remote_authority_worker_host";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "worker-authority-doc",
    revision,
    appKind: "worker-authority-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createFakeReceiver() {
  const listeners = new Set<(event: MessageEvent<unknown>) => void>();

  return {
    receiver: {
      addEventListener(
        type: "message",
        listener: (event: MessageEvent<unknown>) => void
      ) {
        if (type === "message") {
          listeners.add(listener);
        }
      },
      removeEventListener(
        type: "message",
        listener: (event: MessageEvent<unknown>) => void
      ) {
        if (type === "message") {
          listeners.delete(listener);
        }
      }
    },
    dispatch(message: unknown, ports: MessagePort[] = []): void {
      const event = {
        data: message,
        ports
      } as MessageEvent<unknown>;

      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}

function flushMessages(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("attachMessagePortRemoteAuthorityWorkerHost", () => {
  test("应通过 worker 握手消息接管 transferred MessagePort", async () => {
    const receiver = createFakeReceiver();
    const feedbackListeners = new Set<(event: RuntimeFeedbackEvent) => void>();
    const host = attachMessagePortRemoteAuthorityWorkerHost({
      receiver: receiver.receiver,
      service: {
        getDocument(): GraphDocument {
          return createDocument("1");
        },
        submitOperation() {
          queueMicrotask(() => {
            for (const listener of feedbackListeners) {
              listener({
                type: "node.state",
                event: {
                  nodeId: "node-a",
                  exists: true,
                  reason: "execution",
                  timestamp: Date.now()
                }
              });
            }
          });
          return {
            accepted: true,
            changed: false,
            revision: "1"
          };
        },
        replaceDocument(document: GraphDocument): GraphDocument {
          return structuredClone(document);
        },
        subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
          feedbackListeners.add(listener);
          return () => {
            feedbackListeners.delete(listener);
          };
        }
      },
      closePortOnDispose: true,
      disposeServiceOnDispose: false
    });
    const channel = new MessageChannel();
    receiver.dispatch(
      {
        type: "leafergraph.authority.connect"
      },
      [channel.port2]
    );
    const client = createMessagePortRemoteAuthorityClient({
      port: channel.port1,
      closePortOnDispose: true
    });
    const runtimeFeedbackEvents: RuntimeFeedbackEvent[] = [];
    const disposeRuntimeFeedbackSubscription = client.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    try {
      expect((await client.getDocument()).revision).toBe("1");

      await client.submitOperation(
        {
          type: "node.remove",
          nodeId: "node-a",
          operationId: "worker-op-1",
          timestamp: Date.now(),
          source: "worker.test"
        },
        {
          currentDocument: createDocument("1"),
          pendingOperationIds: []
        }
      );

      await flushMessages();
      expect(
        runtimeFeedbackEvents.some(
          (event) =>
            event.type === "node.state" &&
            event.event.reason === "execution"
        )
      ).toBe(true);
    } finally {
      disposeRuntimeFeedbackSubscription();
      client.dispose?.();
      host.dispose();
      channel.port1.close();
      channel.port2.close();
    }
  });

  test("释放 worker host 时应顺带释放 authority service", () => {
    const receiver = createFakeReceiver();
    let disposed = false;
    const host = attachMessagePortRemoteAuthorityWorkerHost({
      receiver: receiver.receiver,
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
  });
});
