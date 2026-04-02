import { afterEach, describe, expect, test } from "bun:test";
import { WebSocket, WebSocketServer } from "ws";
import type { RuntimeBridgeInboundEvent } from "@leafergraph/runtime-bridge/transport";
import type { DemoWebSocketEventMap } from "../src/client/websocket_transport";
import {
  WebSocketRuntimeBridgeTransport
} from "../src/client/websocket_transport";
import { createRuntimeBridgeNodeDemoDocument } from "../src/shared/document";
import {
  parseDemoBridgeMessage,
  serializeDemoBridgeMessage,
  type DemoBridgeClientMessage
} from "../src/shared/protocol";

type DemoListener<TKey extends keyof DemoWebSocketEventMap> = (
  event: DemoWebSocketEventMap[TKey]
) => void;

class NodeWebSocketAdapter {
  private readonly listeners = new Map<string, Map<Function, Function>>();

  constructor(private readonly socket: WebSocket) {}

  get readyState(): number {
    return this.socket.readyState;
  }

  send(data: string): void {
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  addEventListener<TKey extends keyof DemoWebSocketEventMap>(
    type: TKey,
    listener: DemoListener<TKey>
  ): void {
    const listenerMap =
      this.listeners.get(type) ?? new Map<Function, Function>();
    this.listeners.set(type, listenerMap);

    const wrappedListener = wrapWsListener(type, listener);
    listenerMap.set(listener, wrappedListener);
    this.socket.on(type, wrappedListener as never);
  }

  removeEventListener<TKey extends keyof DemoWebSocketEventMap>(
    type: TKey,
    listener: DemoListener<TKey>
  ): void {
    const wrappedListener = this.listeners.get(type)?.get(listener);
    if (!wrappedListener) {
      return;
    }

    this.socket.off(type, wrappedListener as never);
    this.listeners.get(type)?.delete(listener);
  }
}

function wrapWsListener<TKey extends keyof DemoWebSocketEventMap>(
  type: TKey,
  listener: DemoListener<TKey>
) {
  switch (type) {
    case "open":
      return () => listener({} as DemoWebSocketEventMap[TKey]);
    case "message":
      return (data: WebSocket.RawData) =>
        listener({ data } as DemoWebSocketEventMap[TKey]);
    case "close":
      return (code: number, reason: Buffer) =>
        listener({
          code,
          reason: reason.toString()
        } as DemoWebSocketEventMap[TKey]);
    case "error":
      return (error: Error) => listener(error as DemoWebSocketEventMap[TKey]);
    default:
      return () => undefined;
  }
}

let server: WebSocketServer | null = null;
let transport: WebSocketRuntimeBridgeTransport | null = null;

afterEach(async () => {
  await transport?.disconnect().catch(() => undefined);
  transport = null;
  await new Promise<void>((resolve) => {
    server?.close(() => resolve());
    if (!server) {
      resolve();
    }
  });
  server = null;
});

async function createTransportServer(): Promise<{
  url: string;
  emittedEvents: RuntimeBridgeInboundEvent[];
}> {
  const emittedEvents: RuntimeBridgeInboundEvent[] = [];
  server = new WebSocketServer({
    port: 0,
    host: "127.0.0.1"
  });

  server.on("connection", (socket) => {
    setTimeout(() => {
      const event: RuntimeBridgeInboundEvent = {
        type: "history.event",
        event: {
          type: "history.reset",
          timestamp: Date.now(),
          reason: "replace-document"
        }
      };
      emittedEvents.push(event);
      socket.send(
        serializeDemoBridgeMessage({
          type: "bridge.event",
          event
        })
      );
    }, 25);

    socket.on("message", (payload) => {
      const message = parseDemoBridgeMessage(payload) as DemoBridgeClientMessage;

      switch (message.type) {
        case "snapshot.request":
          socket.send(
            serializeDemoBridgeMessage({
              type: "snapshot.response",
              requestId: message.requestId,
              document: createRuntimeBridgeNodeDemoDocument()
            })
          );
          return;
        case "operations.submit":
          socket.send(
            serializeDemoBridgeMessage({
              type: "operations.response",
              requestId: message.requestId,
              results: message.operations.map((operation) => ({
                accepted: true,
                changed: true,
                operation,
                affectedNodeIds: [],
                affectedLinkIds: []
              }))
            })
          );
          return;
        case "control.send":
          socket.send(
            serializeDemoBridgeMessage({
              type: "control.response",
              requestId: message.requestId
            })
          );
          return;
        default:
          return;
      }
    });
  });

  await new Promise<void>((resolve) => {
    server?.on("listening", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `ws://127.0.0.1:${port}`,
    emittedEvents
  };
}

describe("WebSocketRuntimeBridgeTransport", () => {
  test("requestSnapshot / submitOperations / sendControl / bridge.event 应工作", async () => {
    const { url, emittedEvents } = await createTransportServer();
    const receivedEvents: RuntimeBridgeInboundEvent[] = [];
    transport = new WebSocketRuntimeBridgeTransport({
      url,
      createSocket: (socketUrl) =>
        new NodeWebSocketAdapter(new WebSocket(socketUrl))
    });
    transport.subscribe((event) => {
      receivedEvents.push(event);
    });

    await transport.connect();
    const snapshot = await transport.requestSnapshot();
    const results = await transport.submitOperations([
      {
        type: "node.collapse",
        nodeId: "demo-heartbeat-timer",
        collapsed: true,
        operationId: "transport-test-collapse",
        timestamp: Date.now(),
        source: "transport.test"
      }
    ]);
    await transport.sendControl({
      type: "play"
    });

    const startedAt = Date.now();
    while (receivedEvents.length === 0 && Date.now() - startedAt < 2000) {
      await Bun.sleep(20);
    }

    expect(snapshot.documentId).toBe("runtime-bridge-node-demo-document");
    expect(results[0]).toMatchObject({
      accepted: true,
      changed: true,
      operation: {
        type: "node.collapse"
      }
    });
    expect(receivedEvents).toEqual(emittedEvents);
  });
});
