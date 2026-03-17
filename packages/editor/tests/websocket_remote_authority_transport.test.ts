import { describe, expect, test } from "bun:test";

import type {
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "../src/session/graph_document_authority_transport";
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
    action: "getDocument"
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

  test("应处理 request-response 与 runtime feedback", async () => {
    const socket = new FakeWebSocket();
    const transport = createWebSocketRemoteAuthorityTransport({
      url: "ws://authority.test/authority",
      createWebSocket() {
        return socket;
      }
    });
    const runtimeFeedbackEvents: unknown[] = [];
    const disposeSubscription = transport.subscribe((event) => {
      runtimeFeedbackEvents.push(event);
    });

    socket.emitOpen();
    await transport.ready;

    const requestPromise =
      transport.request<EditorRemoteAuthorityTransportResponse>(
        createTransportRequest()
      );
    const sentEnvelope = JSON.parse(socket.sentPayloads[0] ?? "{}") as {
      requestId: string;
    };

    socket.emitMessage({
      channel: "authority.event",
      event: {
        type: "runtimeFeedback",
        event: {
          type: "node.state",
          event: {
            nodeId: "node-1",
            exists: true,
            reason: "updated",
            timestamp: Date.now()
          }
        }
      }
    });
    socket.emitMessage({
      channel: "authority.response",
      requestId: sentEnvelope.requestId,
      ok: true,
      response: {
        action: "getDocument",
        document: {
          documentId: "websocket-transport-doc",
          revision: "1",
          appKind: "transport-test",
          nodes: [],
          links: [],
          meta: {}
        }
      }
    });

    await expect(requestPromise).resolves.toEqual({
      action: "getDocument",
      document: {
        documentId: "websocket-transport-doc",
        revision: "1",
        appKind: "transport-test",
        nodes: [],
        links: [],
        meta: {}
      }
    });
    expect(runtimeFeedbackEvents).toHaveLength(1);

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
});
