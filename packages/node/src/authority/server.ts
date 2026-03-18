import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

import {
  createNodeAuthorityRuntime,
  type CreateNodeAuthorityRuntimeOptions,
  type NodeAuthorityRuntime
} from "./runtime.js";
import {
  DEFAULT_AUTHORITY_PROTOCOL_ADAPTER,
  type AuthorityProtocolAdapter,
  type AuthorityOutboundEnvelope
} from "./protocol.js";

/** Node authority server 的最小启动参数。 */
export interface StartNodeAuthorityServerOptions
  extends CreateNodeAuthorityRuntimeOptions {
  /** HTTP / WebSocket 监听 host。 */
  host?: string;
  /** HTTP / WebSocket 监听端口。 */
  port?: number;
  /** 已存在的 runtime；未提供时使用默认内存态 runtime。 */
  runtime?: NodeAuthorityRuntime;
  /** 可选 authority 协议适配器。 */
  protocolAdapter?: AuthorityProtocolAdapter;
  /** 可选最小日志器。 */
  logger?: Pick<Console, "info">;
}

/** Node authority server 的最小健康快照。 */
export interface NodeAuthorityHealthSnapshot {
  ok: true;
  documentId: string;
  revision: string | number;
  connectionCount: number;
}

/** 已启动的 Node authority server 句柄。 */
export interface StartedNodeAuthorityServer {
  readonly host: string;
  readonly port: number;
  readonly authorityUrl: string;
  readonly healthUrl: string;
  readonly runtime: NodeAuthorityRuntime;
  getHealth(): NodeAuthorityHealthSnapshot;
  close(): Promise<void>;
}

function toPublicHost(host: string): string {
  if (host === "0.0.0.0" || host === "::") {
    return "127.0.0.1";
  }

  return host;
}

function sendEnvelope(socket: WebSocket, envelope: AuthorityOutboundEnvelope): void {
  if (socket.readyState !== 1) {
    return;
  }

  socket.send(JSON.stringify(envelope));
}

/**
 * 启动 Node WebSocket authority server。
 *
 * @remarks
 * 第一版只服务真实外部 bridge demo：
 * - HTTP `GET /health`
 * - WebSocket `/authority`
 * - 文本帧承载统一 authority envelope
 */
export async function startNodeAuthorityServer(
  options: StartNodeAuthorityServerOptions = {}
): Promise<StartedNodeAuthorityServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 5502;
  const runtime =
    options.runtime ??
    createNodeAuthorityRuntime({
      initialDocument: options.initialDocument,
      authorityName: options.authorityName
    });
  const protocolAdapter =
    options.protocolAdapter ?? DEFAULT_AUTHORITY_PROTOCOL_ADAPTER;
  const logger = options.logger ?? console;
  const sockets = new Set<WebSocket>();
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const health = getHealth();
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(JSON.stringify(health));
      return;
    }

    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(
      JSON.stringify({
        ok: false,
        error: "not-found"
      })
    );
  });
  const webSocketServer = new WebSocketServer({
    noServer: true
  });
  let closed = false;

  const getHealth = (): NodeAuthorityHealthSnapshot => {
    const document = runtime.getDocument();
    return {
      ok: true,
      documentId: document.documentId,
      revision: document.revision,
      connectionCount: sockets.size
    };
  };

  webSocketServer.on("connection", (socket: WebSocket) => {
    sockets.add(socket);
    logger.info(
      "[node-authority]",
      `ws connected (connections=${sockets.size})`
    );
    const disposeDocumentSubscription = runtime.subscribeDocument((document) => {
      const envelope = protocolAdapter.createEventEnvelope({
          type: "document",
          document
        });
      sendEnvelope(socket, envelope);
    });
    const disposeRuntimeSubscription = runtime.subscribe((event) => {
      const envelope = protocolAdapter.createEventEnvelope({
          type: "runtimeFeedback",
          event
        });
      sendEnvelope(socket, envelope);
    });

    socket.on("message", (rawData: RawData) => {
      const payload = rawData.toString();
      let message: unknown;
      try {
        message = JSON.parse(payload);
      } catch (error) {
        sendEnvelope(
          socket,
          protocolAdapter.createFailureEnvelope(
            "invalid-json",
            error instanceof Error ? error.message : "无法解析 authority 请求"
          )
        );
        return;
      }

      const envelope = protocolAdapter.parseRequestEnvelope(message);
      if (!envelope) {
        sendEnvelope(
          socket,
          protocolAdapter.createFailureEnvelope("unknown-request", "未知 authority 请求")
        );
        return;
      }

      try {
        switch (envelope.request.action) {
          case "getDocument": {
            logger.info(
              "[node-authority]",
              `request getDocument (connections=${sockets.size})`
            );
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              envelope.requestId,
              {
                action: "getDocument",
                document: runtime.getDocument()
              }
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          case "submitOperation": {
            logger.info(
              "[node-authority]",
              `request submitOperation:${envelope.request.operation.type} (connections=${sockets.size})`
            );
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              envelope.requestId,
              {
                action: "submitOperation",
                result: runtime.submitOperation(envelope.request.operation)
              }
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          case "replaceDocument": {
            logger.info(
              "[node-authority]",
              `request replaceDocument (connections=${sockets.size})`
            );
            const nextDocument = runtime.replaceDocument(envelope.request.document);
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              envelope.requestId,
              {
                action: "replaceDocument",
                document: nextDocument
              }
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
        }
      } catch (error) {
        sendEnvelope(
          socket,
          protocolAdapter.createFailureEnvelope(
            envelope.requestId,
            error instanceof Error ? error.message : "authority 请求处理失败"
          )
        );
      }
    });

    socket.on("close", () => {
      disposeDocumentSubscription();
      disposeRuntimeSubscription();
      sockets.delete(socket);
      logger.info(
        "[node-authority]",
        `ws closed (connections=${sockets.size})`
      );
    });

    socket.on("error", () => {
      disposeDocumentSubscription();
      disposeRuntimeSubscription();
      sockets.delete(socket);
      logger.info(
        "[node-authority]",
        `ws errored (connections=${sockets.size})`
      );
    });
  });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/authority") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("无法解析 authority server 监听地址");
  }

  const publicHost = toPublicHost(host);
  const actualPort = (address as AddressInfo).port;

  return {
    host,
    port: actualPort,
    authorityUrl: `ws://${publicHost}:${actualPort}/authority`,
    healthUrl: `http://${publicHost}:${actualPort}/health`,
    runtime,
    getHealth,
    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;
      for (const socket of sockets) {
        socket.terminate();
      }
      sockets.clear();
      webSocketServer.close();
      server.close();
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  };
}
