import { describe, expect, test } from "bun:test";

import type {
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "../src/session/graph_document_authority_transport";
import type { EditorRemoteAuthorityProtocolAdapter } from "../src/session/graph_document_authority_protocol";
import { createWebSocketRemoteAuthorityTransport } from "../src/session/websocket_remote_authority_transport";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  sentPayloads: string[] = [];

  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error("socket not open");
    }

    this.sentPayloads.push(data);
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return;
    }

    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  emitMessage(data: unknown): void {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: typeof data === "string" ? data : JSON.stringify(data)
      })
    );
  }

  emitError(): void {
    this.dispatchEvent(new Event("error"));
  }
}

function createTransportRequest(): EditorRemoteAuthorityTransportRequest {
  return {
    method: "authority.getDocument"
  };
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

    parseRequestEnvelope() {
      return null;
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

describe("createWebSocketRemoteAuthorityTransport", () => {
  test("open 前请求应直接拒绝", async () => {
    const socket = new FakeWebSocket();
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/authority",
      createWebSocket() {
        return socket;
      }
    });

    await expect(transport.request(createTransportRequest())).rejects.toThrow(
      "authority websocket 尚未连接"
    );

    transport.dispose();
  });

  test("应处理 request-response、document push 与 runtime feedback", async () => {
    const socket = new FakeWebSocket();
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/authority",
      createWebSocket() {
        return socket;
      }
    });
    const authorityEvents: unknown[] = [];
    const disposeSubscription = transport.subscribe((event) => {
      authorityEvents.push(event);
    });

    socket.emitOpen();
    await transport.ready;

    const requestPromise =
      transport.request<EditorRemoteAuthorityTransportResponse>(
        createTransportRequest()
      );
    const sentEnvelope = JSON.parse(socket.sentPayloads[0] ?? "{}") as {
      id: string;
    };

    socket.emitMessage({
      jsonrpc: "2.0",
      method: "authority.document",
      params: {
        documentId: "websocket-transport-doc",
        revision: "1",
        appKind: "transport-test",
        nodes: [],
        links: [],
        meta: {}
      }
    });
    socket.emitMessage({
      jsonrpc: "2.0",
      method: "authority.runtimeFeedback",
      params: {
        type: "node.state",
        event: {
          nodeId: "node-1",
          exists: true,
          reason: "updated",
          timestamp: Date.now()
        }
      }
    });
    socket.emitMessage({
      jsonrpc: "2.0",
      method: "authority.documentDiff",
      params: {
        documentId: "websocket-transport-doc",
        baseRevision: "1",
        revision: "2",
        emittedAt: 1,
        operations: [
          {
            type: "node.move",
            nodeId: "node-1",
            input: {
              x: 24,
              y: 36
            },
            operationId: "diff-node-move",
            timestamp: 1,
            source: "authority.documentDiff"
          }
        ],
        fieldChanges: []
      }
    });
    socket.emitMessage({
      jsonrpc: "2.0",
      id: sentEnvelope.id,
      result: {
        documentId: "websocket-transport-doc",
        revision: "1",
        appKind: "transport-test",
        nodes: [],
        links: [],
        meta: {}
      }
    });

    await expect(requestPromise).resolves.toEqual({
      documentId: "websocket-transport-doc",
      revision: "1",
      appKind: "transport-test",
      nodes: [],
      links: [],
      meta: {}
    });
    expect(authorityEvents).toEqual([
      {
        type: "document",
        document: {
          documentId: "websocket-transport-doc",
          revision: "1",
          appKind: "transport-test",
          nodes: [],
          links: [],
          meta: {}
        }
      },
      {
        type: "runtimeFeedback",
        event: {
          type: "node.state",
          event: expect.objectContaining({
            nodeId: "node-1",
            exists: true,
            reason: "updated"
          })
        }
      },
      {
        type: "documentDiff",
        diff: {
          documentId: "websocket-transport-doc",
          baseRevision: "1",
          revision: "2",
          emittedAt: 1,
          operations: [
            {
              type: "node.move",
              nodeId: "node-1",
              input: {
                x: 24,
                y: 36
              },
              operationId: "diff-node-move",
              timestamp: 1,
              source: "authority.documentDiff"
            }
          ],
          fieldChanges: []
        }
      }
    ]);

    disposeSubscription();
    transport.dispose();
  });

  test("close 时应拒绝所有 pending 请求", async () => {
    const socket = new FakeWebSocket();
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/authority",
      createWebSocket() {
        return socket;
      }
    });

    socket.emitOpen();
    await transport.ready;

    const requestPromise = transport.request(createTransportRequest());
    socket.close();

    await expect(requestPromise).rejects.toThrow("authority websocket 已关闭");

    transport.dispose();
  });

  test("error 时应让 ready 失败", async () => {
    const socket = new FakeWebSocket();
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/authority",
      createWebSocket() {
        return socket;
      }
    });

    socket.emitError();

    await expect(transport.ready).rejects.toThrow("authority websocket 连接失败");

    transport.dispose();
  });

  test("应允许通过 protocol adapter 替换 envelope 结构", async () => {
    const socket = new FakeWebSocket();
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/custom",
      protocolAdapter: createCustomProtocolAdapter(),
      createWebSocket() {
        return socket;
      }
    });

    socket.emitOpen();
    await transport.ready;

    const requestPromise =
      transport.request<EditorRemoteAuthorityTransportResponse>(
        createTransportRequest()
      );
    const sentEnvelope = JSON.parse(socket.sentPayloads[0] ?? "{}") as Record<
      string,
      unknown
    >;
    expect(sentEnvelope.kind).toBe("custom.request");

    socket.emitMessage({
      kind: "custom.response",
      id: sentEnvelope.id,
      result: {
        documentId: "custom-protocol-doc",
        revision: "1",
        appKind: "transport-test",
        nodes: [],
        links: [],
        meta: {}
      }
    });

    await expect(requestPromise).resolves.toEqual({
      documentId: "custom-protocol-doc",
      revision: "1",
      appKind: "transport-test",
      nodes: [],
      links: [],
      meta: {}
    });

    transport.dispose();
  });

  test("首连成功后应支持自动重连并暴露连接状态", async () => {
    const socket1 = new FakeWebSocket();
    const socket2 = new FakeWebSocket();
    const sockets = [socket1, socket2];
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/reconnect",
      autoReconnect: true,
      reconnectDelayMs: 0,
      createWebSocket() {
        const nextSocket = sockets.shift();
        if (!nextSocket) {
          throw new Error("missing fake socket");
        }

        return nextSocket;
      }
    });
    const connectionStates: string[] = [];
    const disposeConnectionStatusSubscription =
      transport.subscribeConnectionStatus((status) => {
        connectionStates.push(status);
      });

    socket1.emitOpen();
    await transport.ready;
    expect(transport.getConnectionStatus()).toBe("connected");

    socket1.close();
    await Promise.resolve();
    expect(transport.getConnectionStatus()).toBe("reconnecting");

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    socket2.emitOpen();
    await Promise.resolve();

    expect(transport.getConnectionStatus()).toBe("connected");
    expect(connectionStates).toEqual([
      "connecting",
      "connected",
      "reconnecting",
      "connected"
    ]);

    const requestPromise =
      transport.request<EditorRemoteAuthorityTransportResponse>(
        createTransportRequest()
      );
    const sentEnvelope = JSON.parse(socket2.sentPayloads[0] ?? "{}") as {
      id: string;
    };
    socket2.emitMessage({
      jsonrpc: "2.0",
      id: sentEnvelope.id,
      result: {
        documentId: "reconnected-doc",
        revision: "2",
        appKind: "transport-test",
        nodes: [],
        links: [],
        meta: {}
      }
    });

    await expect(requestPromise).resolves.toEqual({
      documentId: "reconnected-doc",
      revision: "2",
      appKind: "transport-test",
      nodes: [],
      links: [],
      meta: {}
    });

    disposeConnectionStatusSubscription();
    transport.dispose();
  });
});
