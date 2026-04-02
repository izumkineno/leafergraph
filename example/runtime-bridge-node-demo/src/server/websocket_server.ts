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
  stop(): Promise<void>;
}

/**
 * 启动 demo 使用的 WebSocket bridge server。
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
  const webSocketServer = new WebSocketServer({
    host,
    port: options.port ?? RUNTIME_BRIDGE_NODE_DEMO_WS_PORT
  });
  let socketSeed = 1;

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

    socketSubscriptions.set(socket, unsubscribe);

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
        sendServerMessage(socket, {
          type: "bridge.error",
          requestId,
          message: toErrorMessage(error)
        }, socketId);
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
    webSocketServer.on("listening", () => resolve());
  });

  const address = webSocketServer.address();
  const resolvedPort =
    typeof address === "object" && address !== null ? address.port : 0;

  return {
    authority,
    host,
    port: resolvedPort,
    async stop() {
      logRuntimeBridgeServer("ws", "server.stop");
      for (const [socket, unsubscribe] of socketSubscriptions) {
        unsubscribe();
        socketSubscriptions.delete(socket);
        socket.close();
      }

      await new Promise<void>((resolve, reject) => {
        webSocketServer.close((error) => {
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
    case "control.send":
      authority.sendControl(message.command);
      sendServerMessage(socket, {
        type: "control.response",
        requestId: message.requestId
      }, socketId);
      return;
    default:
      throw new Error("Unsupported client message.");
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
