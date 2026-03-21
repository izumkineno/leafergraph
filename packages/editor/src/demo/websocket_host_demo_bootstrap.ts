import type {
  EditorAppBootstrap
} from "../app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../ui/viewport";
import type { EditorRemoteAuthorityHostAdapter } from "../backend/authority/remote_authority_host_adapter";
import { createWebSocketRemoteAuthorityTransport } from "../session/websocket_remote_authority_transport";

export interface WebSocketHostDemoBootstrapOptions {
  authorityUrl?: string;
  authorityLabel?: string;
  authorityName?: string;
  debugViewportBridgeLog?: boolean;
}

export interface WebSocketHostDemoState<TMode extends string> {
  readonly mode: TMode;
  bridge: GraphViewportHostBridge | null;
  readonly authorityUrl: string;
  readonly authorityLabel: string;
  readonly authorityName: string;
  readonly debugViewportBridgeLog: boolean;
}

interface WebSocketHostDemoGlobal {
  location?: {
    search?: string;
  };
  console?: Pick<Console, "info">;
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
}

export interface WebSocketHostDemoConfig<TMode extends string> {
  defaultAuthorityUrl: string;
  defaultAuthorityLabel: string;
  defaultAuthorityName: string;
  adapterId: string;
  mode: TMode;
  logPrefix: string;
  authorityDescription: string;
  authorityServerLabel: string;
  globalStateKey: string;
}

function normalizeWebSocketHostDemoBootstrapOptions(
  options: WebSocketHostDemoBootstrapOptions,
  config: WebSocketHostDemoConfig<string>
): Required<WebSocketHostDemoBootstrapOptions> {
  return {
    authorityUrl:
      typeof options.authorityUrl === "string" &&
      options.authorityUrl.trim().length > 0
        ? options.authorityUrl.trim()
        : config.defaultAuthorityUrl,
    authorityLabel:
      typeof options.authorityLabel === "string" &&
      options.authorityLabel.trim().length > 0
        ? options.authorityLabel.trim()
        : config.defaultAuthorityLabel,
    authorityName:
      typeof options.authorityName === "string" &&
      options.authorityName.trim().length > 0
        ? options.authorityName.trim()
        : config.defaultAuthorityName,
    debugViewportBridgeLog: options.debugViewportBridgeLog === true
  };
}

function readWebSocketHostDemoBootstrapOptions(
  host: WebSocketHostDemoGlobal,
  config: WebSocketHostDemoConfig<string>
): Required<WebSocketHostDemoBootstrapOptions> {
  const params = new URLSearchParams(host.location?.search ?? "");

  return normalizeWebSocketHostDemoBootstrapOptions(
    {
      authorityUrl: params.get("authorityUrl") ?? undefined,
      authorityLabel: params.get("authorityLabel") ?? undefined,
      authorityName: params.get("authorityName") ?? undefined,
      debugViewportBridgeLog:
        params.get("debugViewportBridge") === "1" ||
        params.get("debugViewportBridge") === "true"
    },
    config
  );
}

export function resolveWebSocketHostDemoTransportUrl(
  authorityUrl: string
): string {
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

export function resolveWebSocketHostDemoHealthUrl(authorityUrl: string): string {
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
    case "https:":
      break;
    case "ws:":
      parsedAuthorityUrl.protocol = "http:";
      break;
    case "wss:":
      parsedAuthorityUrl.protocol = "https:";
      break;
    default:
      throw new Error(
        `authorityUrl 仅支持 http(s) 或 ws(s) 协议：${authorityUrl}`
      );
  }

  if (parsedAuthorityUrl.hostname === "localhost") {
    parsedAuthorityUrl.hostname = "127.0.0.1";
  }

  if (
    parsedAuthorityUrl.pathname.length === 0 ||
    parsedAuthorityUrl.pathname === "/"
  ) {
    parsedAuthorityUrl.pathname = "/health";
  } else if (parsedAuthorityUrl.pathname === "/authority") {
    parsedAuthorityUrl.pathname = "/health";
  }

  return parsedAuthorityUrl.toString();
}

async function buildWebSocketAuthorityConnectionError(
  authorityUrl: string,
  error: unknown,
  authorityServerLabel: string,
  fetchImpl: typeof fetch = fetch
): Promise<Error> {
  const fallbackMessage =
    error instanceof Error ? error.message : "authority 连接失败";
  let healthUrl: string;

  try {
    healthUrl = resolveWebSocketHostDemoHealthUrl(authorityUrl);
  } catch {
    return error instanceof Error ? error : new Error(fallbackMessage);
  }

  try {
    const response = await fetchImpl(healthUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return new Error(
        `authority 健康检查失败：${response.status} ${response.statusText || "Unknown"}（${healthUrl}）。请确认 ${authorityServerLabel} 已在可见的 PowerShell 中启动，并且 /health 可访问。`
      );
    }

    return new Error(
      `authority 健康检查已通过，但 WebSocket 连接仍失败（${fallbackMessage}）。请确认 ${resolveWebSocketHostDemoTransportUrl(authorityUrl)} 可被浏览器直接访问。`
    );
  } catch (healthError) {
    const healthMessage =
      healthError instanceof Error ? healthError.message : "无法访问 health";
    return new Error(
      `authority 健康检查失败：${healthMessage}（${healthUrl}）。请确认 ${authorityServerLabel} 已在可见的 PowerShell 中启动。`
    );
  }
}

export function createWebSocketHostDemoRemoteAuthorityHostAdapter<TMode extends string>(
  config: WebSocketHostDemoConfig<TMode>
): EditorRemoteAuthorityHostAdapter {
  return {
    adapterId: config.adapterId,
    resolveSource(options) {
      const resolvedOptions = normalizeWebSocketHostDemoBootstrapOptions(
        typeof options === "object" && options !== null
          ? (options as WebSocketHostDemoBootstrapOptions)
          : {},
        config
      );

      return {
        label: resolvedOptions.authorityLabel,
        description: `${config.authorityDescription}：${resolvedOptions.authorityUrl}`,
        bundleProjectionMode: "skip",
        async createTransport() {
          const transport = createWebSocketRemoteAuthorityTransport({
            url: resolveWebSocketHostDemoTransportUrl(
              resolvedOptions.authorityUrl
            ),
            autoReconnect: true
          });

          try {
            await transport.ready;
            return transport;
          } catch (error) {
            transport.dispose?.();
            throw await buildWebSocketAuthorityConnectionError(
              resolvedOptions.authorityUrl,
              error,
              config.authorityServerLabel
            );
          }
        }
      };
    }
  };
}

export function createWebSocketHostDemoBootstrap<TMode extends string>(
  config: WebSocketHostDemoConfig<TMode>,
  options: WebSocketHostDemoBootstrapOptions = {}
): Pick<
  EditorAppBootstrap,
  "remoteAuthorityAdapter" | "remoteAuthorityHostAdapters"
> {
  const resolvedOptions = normalizeWebSocketHostDemoBootstrapOptions(
    options,
    config
  );
  const adapter = createWebSocketHostDemoRemoteAuthorityHostAdapter(config);

  return {
    remoteAuthorityAdapter: {
      adapterId: config.adapterId,
      options: resolvedOptions
    },
    remoteAuthorityHostAdapters: [adapter]
  };
}

export function installWebSocketHostDemoBootstrap<TMode extends string>(
  config: WebSocketHostDemoConfig<TMode>,
  host: WebSocketHostDemoGlobal = globalThis as WebSocketHostDemoGlobal
): void {
  const currentBootstrap = host.LeaferGraphEditorAppBootstrap ?? {};
  const authorityOptions = readWebSocketHostDemoBootstrapOptions(host, config);
  const nextBootstrap = createWebSocketHostDemoBootstrap(config, authorityOptions);
  const previousListener = currentBootstrap.onViewportHostBridgeChange;
  const hostDemoState: WebSocketHostDemoState<TMode> = {
    mode: config.mode,
    bridge: null,
    authorityUrl: authorityOptions.authorityUrl,
    authorityLabel: authorityOptions.authorityLabel,
    authorityName: authorityOptions.authorityName,
    debugViewportBridgeLog: authorityOptions.debugViewportBridgeLog
  };

  (host as Record<string, unknown>)[config.globalStateKey] = hostDemoState;
  host.LeaferGraphEditorAppBootstrap = {
    ...currentBootstrap,
    ...nextBootstrap,
    onViewportHostBridgeChange(bridge) {
      hostDemoState.bridge = bridge;
      previousListener?.(bridge);
      if (authorityOptions.debugViewportBridgeLog) {
        host.console?.info(
          config.logPrefix,
          bridge
            ? `viewport bridge ready for ${authorityOptions.authorityUrl}`
            : `viewport bridge disposed for ${authorityOptions.authorityUrl}`
        );
      }
    }
  };
}
