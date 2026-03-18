import type {
  EditorAppBootstrap,
  EditorAppBootstrapPreloadedBundle
} from "../app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../app/GraphViewport";
import type { EditorRemoteAuthorityHostAdapter } from "../app/remote_authority_host_adapter";
import { createWebSocketRemoteAuthorityTransport } from "../session/websocket_remote_authority_transport";

/** Node host demo 默认使用的 authority 宿主地址。 */
export const DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL =
  "http://localhost:5502";
/** Node host demo 自定义 authority adapter 标识。 */
export const NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID = "node-websocket-host-demo";
/** Node host demo 可选预装的本地 test bundle 列表。 */
export const NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES: readonly EditorAppBootstrapPreloadedBundle[] =
  [
    {
      slot: "widget",
      url: "/__testbundles/widget.iife.js",
      fileName: "widget.iife.js",
      enabled: true
    },
    {
      slot: "node",
      url: "/__testbundles/node.iife.js",
      fileName: "node.iife.js",
      enabled: true
    },
    {
      slot: "demo",
      url: "/__testbundles/demo.iife.js",
      fileName: "demo.iife.js",
      enabled: true
    }
  ] as const;

export interface NodeWebSocketHostDemoBootstrapOptions {
  authorityUrl?: string;
  authorityLabel?: string;
  authorityName?: string;
  preloadTestBundles?: boolean;
}

export interface NodeWebSocketHostDemoState {
  readonly mode: "node-host-demo";
  bridge: GraphViewportHostBridge | null;
  readonly authorityUrl: string;
  readonly authorityLabel: string;
  readonly authorityName: string;
  readonly preloadTestBundles: boolean;
}

interface NodeWebSocketHostDemoGlobal {
  location?: {
    search?: string;
  };
  console?: Pick<Console, "info">;
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
  LeaferGraphEditorNodeHostDemo?: NodeWebSocketHostDemoState;
}

function resolveNodeWebSocketTransportUrl(authorityUrl: string): string {
  const trimmedAuthorityUrl = authorityUrl.trim();
  const normalizedAuthorityUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(
    trimmedAuthorityUrl
  )
    ? trimmedAuthorityUrl
    : `http://${trimmedAuthorityUrl}`;
  let parsedAuthorityUrl: URL;

  try {
    parsedAuthorityUrl = new URL(normalizedAuthorityUrl);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `无效的 authorityUrl：${error.message}`
        : "无效的 authorityUrl"
    );
  }

  switch (parsedAuthorityUrl.protocol) {
    case "http:":
      parsedAuthorityUrl.protocol = "ws:";
      break;
    case "https:":
      parsedAuthorityUrl.protocol = "wss:";
      break;
    case "ws:":
    case "wss:":
      break;
    default:
      throw new Error(
        `authorityUrl 仅支持 http(s) 或 ws(s) 协议：${authorityUrl}`
      );
  }

  // Windows 浏览器在 demo 场景下偶发会把 localhost WebSocket 卡在握手超时；
  // 这里保留宿主输入值不变，但把 transport 实际连接统一收敛到稳定的 IPv4 loopback。
  if (parsedAuthorityUrl.hostname === "localhost") {
    parsedAuthorityUrl.hostname = "127.0.0.1";
  }

  if (
    parsedAuthorityUrl.pathname.length === 0 ||
    parsedAuthorityUrl.pathname === "/"
  ) {
    parsedAuthorityUrl.pathname = "/authority";
  }

  return parsedAuthorityUrl.toString();
}

function normalizeNodeWebSocketHostDemoBootstrapOptions(
  options: NodeWebSocketHostDemoBootstrapOptions = {}
): Required<NodeWebSocketHostDemoBootstrapOptions> {
  return {
    authorityUrl:
      typeof options.authorityUrl === "string" &&
      options.authorityUrl.trim().length > 0
        ? options.authorityUrl.trim()
        : DEFAULT_NODE_WEBSOCKET_AUTHORITY_URL,
    authorityLabel:
      typeof options.authorityLabel === "string" &&
      options.authorityLabel.trim().length > 0
        ? options.authorityLabel.trim()
        : "Node WebSocket Authority",
    authorityName:
      typeof options.authorityName === "string" &&
      options.authorityName.trim().length > 0
        ? options.authorityName.trim()
        : "node-websocket-host-demo",
    preloadTestBundles: options.preloadTestBundles === true
  };
}

function readNodeWebSocketHostDemoBootstrapOptions(
  host: NodeWebSocketHostDemoGlobal
): Required<NodeWebSocketHostDemoBootstrapOptions> {
  const params = new URLSearchParams(host.location?.search ?? "");

  return normalizeNodeWebSocketHostDemoBootstrapOptions({
    authorityUrl: params.get("authorityUrl") ?? undefined,
    authorityLabel: params.get("authorityLabel") ?? undefined,
    authorityName: params.get("authorityName") ?? undefined,
    preloadTestBundles:
      params.get("preloadTestBundles") === "1" ||
      params.get("preloadTestBundles") === "true"
  });
}

export function createNodeWebSocketHostDemoRemoteAuthorityHostAdapter(): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
    resolveSource(options) {
      const resolvedOptions = normalizeNodeWebSocketHostDemoBootstrapOptions(
        typeof options === "object" && options !== null
          ? (options as NodeWebSocketHostDemoBootstrapOptions)
          : undefined
      );

      return {
        label: resolvedOptions.authorityLabel,
        description: `通过 Node WebSocket authority server 接入：${resolvedOptions.authorityUrl}`,
        async createTransport() {
          const transport = createWebSocketRemoteAuthorityTransport({
            url: resolveNodeWebSocketTransportUrl(
              resolvedOptions.authorityUrl
            ),
            autoReconnect: true
          });

          try {
            await transport.ready;
            return transport;
          } catch (error) {
            transport.dispose?.();
            throw error;
          }
        }
      };
    }
  };
}

const NODE_WEBSOCKET_HOST_DEMO_REMOTE_AUTHORITY_ADAPTER =
  createNodeWebSocketHostDemoRemoteAuthorityHostAdapter();

export function createNodeWebSocketHostDemoBootstrap(
  options: NodeWebSocketHostDemoBootstrapOptions = {}
): Pick<
  EditorAppBootstrap,
  "remoteAuthorityAdapter" | "remoteAuthorityHostAdapters" | "preloadedBundles"
> {
  const resolvedOptions =
    normalizeNodeWebSocketHostDemoBootstrapOptions(options);

  return {
    remoteAuthorityAdapter: {
      adapterId: NODE_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
      options: resolvedOptions
    },
    remoteAuthorityHostAdapters: [
      NODE_WEBSOCKET_HOST_DEMO_REMOTE_AUTHORITY_ADAPTER
    ],
    preloadedBundles: resolvedOptions.preloadTestBundles
      ? NODE_WEBSOCKET_HOST_DEMO_TEST_BUNDLES.map((bundle) => ({
          ...bundle
        }))
      : undefined
  };
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
  const currentBootstrap = host.LeaferGraphEditorAppBootstrap ?? {};
  const authorityOptions = readNodeWebSocketHostDemoBootstrapOptions(host);
  const nextBootstrap = createNodeWebSocketHostDemoBootstrap(authorityOptions);
  const previousListener = currentBootstrap.onViewportHostBridgeChange;
  const hostDemoState: NodeWebSocketHostDemoState = {
    mode: "node-host-demo",
    bridge: null,
    authorityUrl: authorityOptions.authorityUrl,
    authorityLabel: authorityOptions.authorityLabel,
    authorityName: authorityOptions.authorityName,
    preloadTestBundles: authorityOptions.preloadTestBundles
  };

  host.LeaferGraphEditorNodeHostDemo = hostDemoState;
  host.LeaferGraphEditorAppBootstrap = {
    ...currentBootstrap,
    ...nextBootstrap,
    onViewportHostBridgeChange(bridge) {
      hostDemoState.bridge = bridge;
      previousListener?.(bridge);
      host.console?.info(
        "[authority-node-host-demo]",
        bridge
          ? `viewport bridge ready for ${authorityOptions.authorityUrl}`
          : `viewport bridge disposed for ${authorityOptions.authorityUrl}`
      );
    }
  };
}

declare global {
  var LeaferGraphEditorNodeHostDemo: NodeWebSocketHostDemoState | undefined;
}
