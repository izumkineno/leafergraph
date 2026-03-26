/**
 * bootstrap 模块。
 *
 * @remarks
 * 负责解析页面级启动参数或 demo 宿主配置，并把结果整理成 editor 可直接消费的初始化输入。
 */
import type { EditorAppBootstrap } from "../app/editor_app_bootstrap";
import {
  createWebSocketHostDemoBootstrap,
  createWebSocketHostDemoRemoteAuthorityHostAdapter,
  installWebSocketHostDemoBootstrap,
  resolveWebSocketHostDemoHealthUrl,
  type WebSocketHostDemoBootstrapOptions,
  type WebSocketHostDemoConfig,
  type WebSocketHostDemoState
} from "./websocket_host_demo_bootstrap";

/** Python host demo 默认使用的 authority 宿主地址。 */
export const DEFAULT_PYTHON_WEBSOCKET_AUTHORITY_URL =
  "http://localhost:5503";
/** Python host demo 自定义 authority adapter 标识。 */
export const PYTHON_WEBSOCKET_HOST_DEMO_ADAPTER_ID =
  "python-websocket-host-demo";

export interface PythonWebSocketHostDemoBootstrapOptions
  extends WebSocketHostDemoBootstrapOptions {}

export type PythonWebSocketHostDemoState =
  WebSocketHostDemoState<"python-host-demo">;

interface PythonWebSocketHostDemoGlobal {
  location?: {
    search?: string;
  };
  console?: Pick<Console, "info">;
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
  LeaferGraphEditorPythonHostDemo?: PythonWebSocketHostDemoState;
}

const PYTHON_WEBSOCKET_HOST_DEMO_CONFIG: WebSocketHostDemoConfig<"python-host-demo"> =
  {
    defaultAuthorityUrl: DEFAULT_PYTHON_WEBSOCKET_AUTHORITY_URL,
    defaultAuthorityLabel: "Python FastAPI Authority",
    defaultAuthorityName: "python-websocket-host-demo",
    adapterId: PYTHON_WEBSOCKET_HOST_DEMO_ADAPTER_ID,
    mode: "python-host-demo",
    logPrefix: "[authority-python-host-demo]",
    authorityDescription: "通过 Python FastAPI authority server 接入",
    authorityServerLabel: "Python authority server",
    globalStateKey: "LeaferGraphEditorPythonHostDemo"
  };

export function resolvePythonWebSocketHealthUrl(authorityUrl: string): string {
  return resolveWebSocketHostDemoHealthUrl(authorityUrl);
}

export function createPythonWebSocketHostDemoRemoteAuthorityHostAdapter() {
  return createWebSocketHostDemoRemoteAuthorityHostAdapter(
    PYTHON_WEBSOCKET_HOST_DEMO_CONFIG
  );
}

export function createPythonWebSocketHostDemoBootstrap(
  options: PythonWebSocketHostDemoBootstrapOptions = {}
): Pick<
  EditorAppBootstrap,
  "remoteAuthorityAdapter" | "remoteAuthorityHostAdapters"
> {
  return createWebSocketHostDemoBootstrap(
    PYTHON_WEBSOCKET_HOST_DEMO_CONFIG,
    options
  );
}

export function installPythonWebSocketHostDemoBootstrap(
  host: PythonWebSocketHostDemoGlobal =
    globalThis as PythonWebSocketHostDemoGlobal
): void {
  installWebSocketHostDemoBootstrap(PYTHON_WEBSOCKET_HOST_DEMO_CONFIG, host);
}

declare global {
  var LeaferGraphEditorPythonHostDemo:
    | PythonWebSocketHostDemoState
    | undefined;
}
