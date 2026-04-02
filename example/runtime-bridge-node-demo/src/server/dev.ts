import {
  RUNTIME_BRIDGE_NODE_DEMO_WS_HOST,
  RUNTIME_BRIDGE_NODE_DEMO_WS_PORT
} from "../shared/protocol";
import { startRuntimeBridgeNodeDemoServer } from "./websocket_server";

const host =
  process.env.RUNTIME_BRIDGE_NODE_DEMO_HOST ?? RUNTIME_BRIDGE_NODE_DEMO_WS_HOST;
const port = Number(
  process.env.RUNTIME_BRIDGE_NODE_DEMO_PORT ?? RUNTIME_BRIDGE_NODE_DEMO_WS_PORT
);

const server = await startRuntimeBridgeNodeDemoServer({
  host,
  port
});

console.log(
  `[runtime-bridge-node-demo] authority listening on ws://${server.host}:${server.port}`
);

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
