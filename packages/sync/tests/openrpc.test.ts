/**
 * OpenRPC 子出口单元测试。
 *
 * @remarks
 * 覆盖 OpenRPC outlet 的 method / notification 映射和 WebSocket carrier 的连接状态链。
 */
import { describe, expect, test } from "bun:test";
import {
  createOpenRpcOutlet,
  createOpenRpcWebSocketCarrier
} from "../src/openrpc";
import {
  FakeCarrier,
  FakeWebSocket,
  createDocument,
  createGraphExecutionState,
  createOperation,
  createPatch,
  createRuntimeFeedback,
  waitFor
} from "./test_helpers";

describe("OpenRPC outlet", () => {
  test("会正确映射 3 类命令、3 类根层 notification，并忽略 frontendBundlesSync", async () => {
    const carrier = new FakeCarrier();
    const outlet = createOpenRpcOutlet({ carrier });
    const requestMethods = [];
    const eventTypes = [];
    const initialSnapshot = createDocument(1);
    const authoritySnapshot = createDocument(2);
    const replacementSnapshot = createDocument(10);

    carrier.requestHandler = async (envelope) => {
      requestMethods.push(envelope.method);
      switch (envelope.method) {
        case "authority.getDocument":
          return {
            jsonrpc: "2.0",
            id: envelope.id,
            result: initialSnapshot
          };
        case "authority.submitOperation":
          return {
            jsonrpc: "2.0",
            id: envelope.id,
            result: {
              accepted: true,
              changed: true,
              revision: authoritySnapshot.revision,
              document: authoritySnapshot
            }
          };
        case "authority.replaceDocument":
          return {
            jsonrpc: "2.0",
            id: envelope.id,
            result: null
          };
        case "authority.controlRuntime":
          return {
            jsonrpc: "2.0",
            id: envelope.id,
            result: {
              accepted: true,
              changed: true,
              state: createGraphExecutionState()
            }
          };
        default:
          throw new Error(`unexpected method: ${envelope.method}`);
      }
    };

    outlet.subscribe((event) => {
      eventTypes.push(event.type);
    });

    expect((await outlet.getSnapshot()).revision).toBe(1);

    const applyAck = await outlet.request({
      commandId: "cmd-apply",
      issuedAt: Date.now(),
      type: "document.apply-operation",
      operation: createOperation("op-1")
    });
    expect(applyAck.status).toBe("accepted");
    expect("snapshot" in applyAck && applyAck.snapshot?.revision).toBe(2);

    const replaceAck = await outlet.request({
      commandId: "cmd-replace",
      issuedAt: Date.now(),
      type: "document.replace",
      snapshot: replacementSnapshot
    });
    expect(replaceAck.status).toBe("accepted");
    expect("snapshot" in replaceAck && replaceAck.snapshot?.revision).toBe(10);

    const runtimeAck = await outlet.request({
      commandId: "cmd-runtime",
      issuedAt: Date.now(),
      type: "runtime.control",
      request: {
        type: "graph.play"
      }
    });
    expect(runtimeAck.status).toBe("accepted");
    expect("runtimeState" in runtimeAck && runtimeAck.runtimeState?.status).toBe("running");

    carrier.emit({
      type: "notification",
      notification: {
        jsonrpc: "2.0",
        method: "authority.document",
        params: createDocument(11)
      }
    });
    carrier.emit({
      type: "notification",
      notification: {
        jsonrpc: "2.0",
        method: "authority.documentDiff",
        params: createPatch({
          baseRevision: 11,
          revision: 12
        })
      }
    });
    carrier.emit({
      type: "notification",
      notification: {
        jsonrpc: "2.0",
        method: "authority.runtimeFeedback",
        params: createRuntimeFeedback()
      }
    });
    carrier.emit({
      type: "notification",
      notification: {
        jsonrpc: "2.0",
        method: "authority.frontendBundlesSync",
        params: {
          type: "frontendBundles.sync",
          mode: "full",
          packages: [],
          emittedAt: Date.now()
        }
      }
    });

    expect(requestMethods).toEqual([
      "authority.getDocument",
      "authority.submitOperation",
      "authority.replaceDocument",
      "authority.controlRuntime"
    ]);
    expect(eventTypes).toEqual(["snapshot", "patch", "feedback"]);

    await outlet.dispose();
  });
});

describe("OpenRPC WebSocket carrier", () => {
  test.skip("会处理连接建立、request/response 配对和 decode 错误", async () => {
    const sockets: FakeWebSocket[] = [];
    const carrier = createOpenRpcWebSocketCarrier({
      endpoint: "ws://authority.test",
      autoReconnect: false,
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      }
    });
    const statuses = [];
    const errorKinds = [];

    carrier.subscribe((event) => {
      if (event.type === "connection") {
        statuses.push(event.status);
      }
      if (event.type === "error") {
        errorKinds.push(event.error.kind);
      }
    });

    expect(carrier.getConnectionStatus()).toBe("connecting");
    expect(sockets).toHaveLength(1);

    sockets[0].readyState = 1;
    sockets[0].emit("open");
    await waitFor(() => carrier.getConnectionStatus() === "connected");

    const responsePromise = carrier.request({
      jsonrpc: "2.0",
      id: "req-1",
      method: "authority.getDocument"
    });

    sockets[0].emit(
      "message",
      JSON.stringify({
        jsonrpc: "2.0",
        id: "req-1",
        result: createDocument(1)
      })
    );

    const response = await responsePromise;
    expect("result" in response).toBe(true);

    sockets[0].emit("message", "not-json");
    await waitFor(() => errorKinds.includes("decode"));

    expect(statuses).toContain("connecting");
    expect(statuses).toContain("connected");

    await carrier.dispose();
    expect(carrier.getConnectionStatus()).toBe("disconnected");
  });

  test.skip("在 autoReconnect 模式下关闭连接会先进入 reconnecting，再在 dispose 后落到 disconnected", async () => {
    const sockets: FakeWebSocket[] = [];
    const carrier = createOpenRpcWebSocketCarrier({
      endpoint: "ws://authority.test",
      reconnectDelayMs: 10_000,
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      }
    });
    const statuses = [];

    carrier.subscribe((event) => {
      if (event.type === "connection") {
        statuses.push(event.status);
      }
    });

    sockets[0].readyState = 1;
    sockets[0].emit("open");
    await waitFor(() => carrier.getConnectionStatus() === "connected");

    sockets[0].readyState = 3;
    sockets[0].emit("close");
    await waitFor(() => carrier.getConnectionStatus() === "reconnecting");

    expect(statuses).toContain("reconnecting");

    await carrier.dispose();
    expect(carrier.getConnectionStatus()).toBe("disconnected");
  });
});
