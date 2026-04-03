import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { WebSocket, WebSocketServer } from "ws";
import type {
  DemoBridgeClientMessage,
  DemoBridgeServerMessage
} from "../shared/protocol";
import {
  parseDemoBridgeMessage,
  serializeDemoBridgeMessage,
  RUNTIME_BRIDGE_NODE_DEMO_WS_HOST,
  RUNTIME_BRIDGE_NODE_DEMO_WS_PORT
} from "../shared/protocol";
import { RuntimeBridgeNodeAuthority } from "./authority";
import {
  formatClientMessageBehavior,
  formatServerMessageBehavior,
  logRuntimeBridgeServer,
  logRuntimeBridgeServerError
} from "./logging";

export interface RuntimeBridgeNodeDemoServerOptions {
  host?: string;
  port?: number;
  authority?: RuntimeBridgeNodeAuthority;
}

export interface RuntimeBridgeNodeDemoServer {
  readonly authority: RuntimeBridgeNodeAuthority;
  readonly host: string;
  readonly port: number;
  readonly httpOrigin: string;
  stop(): Promise<void>;
}

/**
 * 启动 demo 使用的 WebSocket + HTTP bridge server。
 *
 * @param options - 服务端选项。
 * @returns 服务端句柄。
 */
export async function startRuntimeBridgeNodeDemoServer(
  options: RuntimeBridgeNodeDemoServerOptions = {}
): Promise<RuntimeBridgeNodeDemoServer> {
  const host = options.host ?? RUNTIME_BRIDGE_NODE_DEMO_WS_HOST;
  const authority = options.authority ?? (await RuntimeBridgeNodeAuthority.create());
  const ownsAuthority = !options.authority;
  const socketSubscriptions = new Map<WebSocket, () => void>();
  const httpServer = createServer((request, response) => {
    void handleHttpRequest(authority, request, response);
  });
  const webSocketServer = new WebSocketServer({
    noServer: true
  });
  let socketSeed = 1;

  httpServer.on("upgrade", (request, socket, head) => {
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });

  webSocketServer.on("connection", (socket, request) => {
    const socketId = `client-${socketSeed}`;
    socketSeed += 1;
    logRuntimeBridgeServer(
      "ws",
      `${socketId}.connected`,
      `peer=${request.socket.remoteAddress ?? "unknown"}:${String(request.socket.remotePort ?? "unknown")}`
    );

    const unsubscribe = authority.subscribe((event) => {
      if (socket.readyState === WebSocket.OPEN) {
        const message: DemoBridgeServerMessage = {
          type: "bridge.event",
          event
        };
        logRuntimeBridgeServer(
          "ws",
          `${socketId}.broadcast`,
          formatServerMessageBehavior(message)
        );
        sendServerMessage(socket, message, socketId);
      }
    });
    const unsubscribeStream = authority.subscribeStream((frame) => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      sendServerMessage(
        socket,
        {
          type: "stream.frame",
          frame
        },
        socketId
      );
    });

    socketSubscriptions.set(socket, () => {
      unsubscribe();
      unsubscribeStream();
    });

    for (const frame of authority.getLatestStreamFrames()) {
      if (socket.readyState !== WebSocket.OPEN) {
        break;
      }

      sendServerMessage(
        socket,
        {
          type: "stream.frame",
          frame
        },
        socketId
      );
    }

    socket.on("message", async (payload) => {
      let requestId: string | undefined;

      try {
        const message = parseDemoBridgeMessage(payload) as DemoBridgeClientMessage;
        requestId = message.requestId;
        logRuntimeBridgeServer(
          "ws",
          `${socketId}.receive`,
          formatClientMessageBehavior(message)
        );
        await handleClientMessage(authority, socket, socketId, message);
      } catch (error) {
        logRuntimeBridgeServerError(
          "ws",
          `${socketId}.error`,
          toErrorMessage(error)
        );
        sendServerMessage(
          socket,
          {
            type: "bridge.error",
            requestId,
            message: toErrorMessage(error)
          },
          socketId
        );
      }
    });

    const cleanup = () => {
      logRuntimeBridgeServer("ws", `${socketId}.disconnected`);
      socketSubscriptions.get(socket)?.();
      socketSubscriptions.delete(socket);
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(options.port ?? RUNTIME_BRIDGE_NODE_DEMO_WS_PORT, host, () => {
      resolve();
    });
  });

  const address = httpServer.address();
  const resolvedPort =
    typeof address === "object" && address !== null ? address.port : 0;
  const httpOrigin = `http://${host}:${resolvedPort}`;

  return {
    authority,
    host,
    port: resolvedPort,
    httpOrigin,
    async stop() {
      logRuntimeBridgeServer("ws", "server.stop");
      for (const [socket, unsubscribe] of socketSubscriptions) {
        unsubscribe();
        socketSubscriptions.delete(socket);
        socket.close();
      }

      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      if (ownsAuthority) {
        authority.destroy();
      }
    }
  };
}

async function handleClientMessage(
  authority: RuntimeBridgeNodeAuthority,
  socket: WebSocket,
  socketId: string,
  message: DemoBridgeClientMessage
): Promise<void> {
  switch (message.type) {
    case "snapshot.request": {
      const response: DemoBridgeServerMessage = {
        type: "snapshot.response",
        requestId: message.requestId,
        document: authority.requestSnapshot()
      };
      sendServerMessage(socket, response, socketId);
      return;
    }
    case "operations.submit": {
      const response: DemoBridgeServerMessage = {
        type: "operations.response",
        requestId: message.requestId,
        results: authority.submitOperations(message.operations)
      };
      sendServerMessage(socket, response, socketId);
      return;
    }
    case "command.request": {
      const result = await authority.requestCommand(message.command);
      sendServerMessage(
        socket,
        {
          type: "command.response",
          requestId: message.requestId,
          result
        },
        socketId
      );
      return;
    }
    default:
      throw new Error("Unsupported client message.");
  }
}

async function handleHttpRequest(
  authority: RuntimeBridgeNodeAuthority,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "POST" && requestUrl.pathname === "/artifacts") {
      const bytes = await readRequestBody(request);
      const ref = await authority.artifactStore.writeArtifact({
        bytes,
        contentType: request.headers["content-type"] || "application/octet-stream",
        suggestedName: readSuggestedNameHeader(request.headers["x-demo-filename"])
      });

      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8"
      });
      response.end(JSON.stringify({ ref }));
      return;
    }

    if (request.method === "GET" && requestUrl.pathname.startsWith("/artifacts/")) {
      const ref = decodeURIComponent(requestUrl.pathname.replace("/artifacts/", ""));
      const artifact = await authority.artifactStore.readArtifactResponse(ref);
      response.writeHead(200, {
        "content-type": artifact.contentType,
        "cache-control": "no-store"
      });
      response.end(Buffer.from(artifact.bytes));
      return;
    }

    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ message: "Not Found" }));
  } catch (error) {
    logRuntimeBridgeServerError("http", "request.error", toErrorMessage(error));
    response.writeHead(500, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ message: toErrorMessage(error) }));
  }
}

function sendServerMessage(
  socket: WebSocket,
  message: DemoBridgeServerMessage,
  socketId: string
): void {
  logRuntimeBridgeServer(
    "ws",
    `${socketId}.send`,
    formatServerMessageBehavior(message)
  );
  socket.send(serializeDemoBridgeMessage(message));
}

async function readRequestBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  return new Uint8Array(Buffer.concat(chunks));
}

function readSuggestedNameHeader(headerValue: string | string[] | undefined): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "content-type,x-demo-filename"
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
