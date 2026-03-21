import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

import {
  createNodeAuthorityRuntime,
  type CreateNodeAuthorityRuntimeOptions,
  type NodeAuthorityRuntime
} from "../core/runtime.js";
import {
  AUTHORITY_CONTROL_RUNTIME_METHOD,
  AUTHORITY_GET_DOCUMENT_METHOD,
  AUTHORITY_JSON_RPC_ERROR_CODES,
  AUTHORITY_JSON_RPC_VERSION,
  AUTHORITY_REPLACE_DOCUMENT_METHOD,
  AUTHORITY_RPC_DISCOVER_METHOD,
  AUTHORITY_SUBMIT_OPERATION_METHOD,
  createDiscoverResult,
  DEFAULT_AUTHORITY_PROTOCOL_ADAPTER,
  type AuthorityProtocolAdapter,
  type AuthorityOutboundEnvelope
} from "../core/protocol.js";

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
  logger?: Pick<Console, "info" | "warn" | "error">;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJsonRpcRequestId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function readRequestId(value: unknown): string | number | null {
  if (!isRecord(value)) {
    return null;
  }

  return isJsonRpcRequestId(value.id) ? value.id : null;
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
      authorityName: options.authorityName,
      packageDir: options.packageDir,
      logger: options.logger
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
      "[nodejs-authority-template]",
      `ws connected (connections=${sockets.size})`
    );
    const disposeDocumentSubscription = runtime.subscribeDocument((document) => {
      const envelope = protocolAdapter.createNotificationEnvelope({
        type: "document",
        document
      });
      sendEnvelope(socket, envelope);
    });
    const disposeRuntimeSubscription = runtime.subscribe((event) => {
      const envelope = protocolAdapter.createNotificationEnvelope({
        type: "runtimeFeedback",
        event
      });
      sendEnvelope(socket, envelope);
    });
    const disposeFrontendBundlesSubscription = runtime.subscribeFrontendBundles(
      (event) => {
        const envelope = protocolAdapter.createNotificationEnvelope({
          type: "frontendBundles.sync",
          event
        });
        sendEnvelope(socket, envelope);
      }
    );
    const initialFrontendBundlesEnvelope =
      protocolAdapter.createNotificationEnvelope({
      type: "frontendBundles.sync",
      event: runtime.getFrontendBundlesSnapshot()
    });
    sendEnvelope(socket, initialFrontendBundlesEnvelope);

    socket.on("message", (rawData: RawData) => {
      const payload = rawData.toString();
      let message: unknown;
      try {
        message = JSON.parse(payload);
      } catch (error) {
        sendEnvelope(
          socket,
          protocolAdapter.createErrorEnvelope(
            null,
            AUTHORITY_JSON_RPC_ERROR_CODES.parseError,
            error instanceof Error ? error.message : "无法解析 authority 请求"
          )
        );
        return;
      }

      if (
        !isRecord(message) ||
        message.jsonrpc !== AUTHORITY_JSON_RPC_VERSION ||
        !isJsonRpcRequestId(message.id) ||
        typeof message.method !== "string"
      ) {
        sendEnvelope(
          socket,
          protocolAdapter.createErrorEnvelope(
            null,
            AUTHORITY_JSON_RPC_ERROR_CODES.invalidRequest,
            "非法 JSON-RPC request"
          )
        );
        return;
      }

      const requestId = message.id;
      const methodName = message.method;
      const params = message.params;

      try {
        switch (methodName) {
          case AUTHORITY_RPC_DISCOVER_METHOD: {
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              requestId,
              createDiscoverResult()
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          case AUTHORITY_GET_DOCUMENT_METHOD: {
            logger.info(
              "[nodejs-authority-template]",
              `request getDocument (connections=${sockets.size})`
            );
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              requestId,
              runtime.getDocument()
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          case AUTHORITY_SUBMIT_OPERATION_METHOD: {
            if (!isRecord(params) || !("operation" in params) || !("context" in params)) {
              sendEnvelope(
                socket,
                protocolAdapter.createErrorEnvelope(
                  requestId,
                  AUTHORITY_JSON_RPC_ERROR_CODES.invalidParams,
                  "submitOperation params 非法"
                )
              );
              return;
            }
            logger.info(
              "[nodejs-authority-template]",
              `request submitOperation:${String((params.operation as { type?: unknown }).type ?? "unknown")} (connections=${sockets.size})`
            );
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              requestId,
              runtime.submitOperation(
                params.operation as Parameters<typeof runtime.submitOperation>[0]
              )
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          case AUTHORITY_REPLACE_DOCUMENT_METHOD: {
            if (!isRecord(params) || !("document" in params)) {
              sendEnvelope(
                socket,
                protocolAdapter.createErrorEnvelope(
                  requestId,
                  AUTHORITY_JSON_RPC_ERROR_CODES.invalidParams,
                  "replaceDocument params 非法"
                )
              );
              return;
            }
            logger.info(
              "[nodejs-authority-template]",
              `request replaceDocument (connections=${sockets.size})`
            );
            const nextDocument = runtime.replaceDocument(
              params.document as Parameters<typeof runtime.replaceDocument>[0]
            );
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              requestId,
              nextDocument
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          case AUTHORITY_CONTROL_RUNTIME_METHOD: {
            if (!isRecord(params) || !("request" in params)) {
              sendEnvelope(
                socket,
                protocolAdapter.createErrorEnvelope(
                  requestId,
                  AUTHORITY_JSON_RPC_ERROR_CODES.invalidParams,
                  "controlRuntime params 非法"
                )
              );
              return;
            }
            logger.info(
              "[nodejs-authority-template]",
              `request controlRuntime:${String((params.request as { type?: unknown }).type ?? "unknown")} (connections=${sockets.size})`
            );
            const successEnvelope = protocolAdapter.createSuccessEnvelope(
              requestId,
              runtime.controlRuntime(
                params.request as Parameters<typeof runtime.controlRuntime>[0]
              )
            );
            sendEnvelope(socket, successEnvelope);
            return;
          }
          default: {
            sendEnvelope(
              socket,
              protocolAdapter.createErrorEnvelope(
                requestId,
                AUTHORITY_JSON_RPC_ERROR_CODES.methodNotFound,
                `未知 method: ${methodName}`
              )
            );
            return;
          }
        }
      } catch (error) {
        sendEnvelope(
          socket,
          protocolAdapter.createErrorEnvelope(
            readRequestId(message),
            AUTHORITY_JSON_RPC_ERROR_CODES.internalError,
            error instanceof Error ? error.message : "authority 请求处理失败"
          )
        );
      }
    });

    socket.on("close", () => {
      disposeDocumentSubscription();
      disposeRuntimeSubscription();
      disposeFrontendBundlesSubscription();
      sockets.delete(socket);
      logger.info(
        "[nodejs-authority-template]",
        `ws closed (connections=${sockets.size})`
      );
    });

    socket.on("error", () => {
      disposeDocumentSubscription();
      disposeRuntimeSubscription();
      disposeFrontendBundlesSubscription();
      sockets.delete(socket);
      logger.info(
        "[nodejs-authority-template]",
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
