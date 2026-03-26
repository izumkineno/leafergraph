import { describe, expect, test } from "bun:test";

import type { GraphDocument } from "leafergraph";
import { createMessagePortRemoteAuthorityClient } from "../src/session/message_port_remote_authority_transport";
import { attachMessagePortRemoteAuthorityBridgeHost } from "../src/session/message_port_remote_authority_bridge_host";

function createDocument(revision: string): GraphDocument {
  return {
    documentId: "bridge-authority-doc",
    revision,
    appKind: "bridge-authority-test",
    nodes: [],
    links: [],
    meta: {}
  };
}

function createFakeBridgeReceiver() {
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
    dispatch(event: MessageEvent<unknown>): void {
      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}

describe("attachMessagePortRemoteAuthorityBridgeHost", () => {
  test("应支持按连接事件过滤 bridge authority 握手", async () => {
    const bridgeReceiver = createFakeBridgeReceiver();
    const acceptedSource = {
      id: "accepted-window"
    };
    const rejectedSource = {
      id: "rejected-window"
    };
    let documentRequestCount = 0;
    const host = attachMessagePortRemoteAuthorityBridgeHost({
      receiver: bridgeReceiver.receiver,
      service: {
        getDocument(): GraphDocument {
          documentRequestCount += 1;
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
      },
      acceptConnection(event) {
        return (
          event.origin === "https://allowed.example" &&
          event.source === acceptedSource
        );
      },
      disposeServiceOnDispose: false
    });

    const rejectedChannel = new MessageChannel();
    bridgeReceiver.dispatch({
      data: {
        type: "leafergraph.authority.connect"
      },
      ports: [rejectedChannel.port2],
      origin: "https://blocked.example",
      source: rejectedSource
    } as MessageEvent<unknown>);
    rejectedChannel.port1.close();
    rejectedChannel.port2.close();

    const acceptedChannel = new MessageChannel();
    bridgeReceiver.dispatch({
      data: {
        type: "leafergraph.authority.connect"
      },
      ports: [acceptedChannel.port2],
      origin: "https://allowed.example",
      source: acceptedSource
    } as MessageEvent<unknown>);
    const acceptedClient = createMessagePortRemoteAuthorityClient({
      port: acceptedChannel.port1
    });

    expect((await acceptedClient.getDocument()).revision).toBe("1");
    expect(documentRequestCount).toBe(1);

    acceptedClient.dispose?.();
    host.dispose();
  });
});
