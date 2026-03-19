import type {
  EditorAppBootstrap
} from "../app/editor_app_bootstrap";
import {
  createWebSocketHostDemoBootstrap,
  createWebSocketHostDemoRemoteAuthorityHostAdapter,
  installWebSocketHostDemoBootstrap,
  resolveWebSocketHostDemoHealthUrl,
  WEBSOCKET_HOST_DEMO_TEST_BUNDLES,
  type WebSocketHostDemoBootstrapOptions,
  type WebSocketHostDemoConfig,
  type WebSocketHostDemoState
} from "./websocket_host_demo_bootstrap";

/** Node host demo 默认使用的 authority 宿主地址。 */
export const DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL =
  "http://localhost:5502";
/** Node host demo 自定义 authority adapter 标识。 */
export const NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID = "node-websocket-host-demo";
/** Node host demo 可选预装的本地 test bundle 列表。 */
export const NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES =
  WEBSOCKET_HOST_DEMO_TEST_BUNDLES;

export interface NodeWebSocketHostDemoBootstrapOptions
  extends WebSocketHostDemoBootstrapOptions {}

export type NodeWebSocketHostDemoState =
  WebSocketHostDemoState<"node-host-demo">;

interface NodeWebSocketHostDemoGlobal {
  location?: {
    search?: string;
  };
  console?: Pick<Console, "info">;
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
  LeaferGraphEditorNodeHostDemo?: NodeWebSocketHostDemoState;
}

const NODE_WEBSOCKET_HOST_DEMO_CONFIG: WebSocketHostDemoConfig<"node-host-demo"> =
  {
    defaultAuthorityUrl: DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL,
    defaultAuthorityLabel: "Node WebSocket Authority",
    defaultAuthorityName: "node-websocket-host-demo",
    adapterId: NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
    mode: "node-host-demo",
    logPrefix: "[authority-node-host-demo]",
    authorityDescription: "通过 Node WebSocket authority server 接入",
    authorityServerLabel: "Node authority server",
    globalStateKey: "LeaferGraphEditorNodeHostDemo"
  };

export function resolveNodeWebSocketHealthUrl(authorityUrl: string): string {
  return resolveWebSocketHostDemoHealthUrl(authorityUrl);
}

export function createNodeWebSocketHostDemoRemoteAuthorityHostAdapter() {
  return createWebSocketHostDemoRemoteAuthorityHostAdapter(
    NODE_WEBSOCKET_HOST_DEMO_CONFIG
  );
}

export function createNodeWebSocketHostDemoBootstrap(
  options: NodeWebSocketHostDemoBootstrapOptions = {}
): Pick<
  EditorAppBootstrap,
  "remoteAuthorityAdapter" | "remoteAuthorityHostAdapters" | "preloadedBundles"
> {
  return createWebSocketHostDemoBootstrap(
    NODE_WEBSOCKET_HOST_DEMO_CONFIG,
    options
  );
}

/**
 * 安装 Node host demo 使用的浏览器 bootstrap。
 *
 * @remarks
 * 这层模拟“浏览器宿主通过 WebSocket 直连真实 Node authority server”：
 * - 在 editor 启动前预注入自定义 host adapter
 * - 保持 editor 主入口仍只读取标准 bootstrap
 * - 把 `GraphViewportHostBridge` 暴露到宿主调试对象
 */
export function installNodeWebSocketHostDemoBootstrap(
  host: NodeWebSocketHostDemoGlobal =
    globalThis as NodeWebSocketHostDemoGlobal
): void {
  installWebSocketHostDemoBootstrap(NODE_WEBSOCKET_HOST_DEMO_CONFIG, host);
}

declare global {
  var LeaferGraphEditorNodeHostDemo: NodeWebSocketHostDemoState | undefined;
}
