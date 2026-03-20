import type { EditorAppBootstrap } from "../app/editor_app_bootstrap";
import type { GraphViewportHostBridge } from "../ui/viewport";
import {
  createPreviewRemoteAuthorityBootstrap,
  type PreviewRemoteAuthorityAdapterOptions
} from "./preview_remote_authority_bootstrap";

/** 浏览器宿主 demo 默认使用的 authority 名称。 */
export const PREVIEW_REMOTE_AUTHORITY_HOST_DEMO_AUTHORITY_NAME =
  "host-demo-service";

export interface PreviewRemoteAuthorityHostDemoState {
  readonly mode: "host-demo";
  bridge: GraphViewportHostBridge | null;
  readonly authorityLabel: string;
  readonly authorityName: string;
  readonly debugViewportBridgeLog: boolean;
}

interface PreviewRemoteAuthorityHostDemoGlobal {
  location?: {
    search?: string;
  };
  console?: Pick<Console, "info">;
  LeaferGraphEditorAppBootstrap?: EditorAppBootstrap;
  LeaferGraphEditorHostDemo?: PreviewRemoteAuthorityHostDemoState;
}

function readHostDemoAuthorityOptions(
  host: PreviewRemoteAuthorityHostDemoGlobal
): Required<PreviewRemoteAuthorityAdapterOptions> {
  const params = new URLSearchParams(host.location?.search ?? "");

  return {
    label: params.get("authorityLabel")?.trim() || "Host Demo Authority",
    description:
      params.get("authorityDescription")?.trim() ||
      "通过 authority-host-demo.html 在宿主侧预注入的 authority adapter",
    authorityName:
      params.get("authorityName")?.trim() ||
      PREVIEW_REMOTE_AUTHORITY_HOST_DEMO_AUTHORITY_NAME
  };
}

function readViewportBridgeDebugEnabled(
  host: PreviewRemoteAuthorityHostDemoGlobal
): boolean {
  const params = new URLSearchParams(host.location?.search ?? "");
  return (
    params.get("debugViewportBridge") === "1" ||
    params.get("debugViewportBridge") === "true"
  );
}

/**
 * 安装浏览器宿主示例使用的 bootstrap。
 *
 * @remarks
 * 这层模拟“真实外部宿主在 editor 启动前预注入 bootstrap”：
 * - 先在宿主侧写入 `remoteAuthorityAdapter`
 * - 再加载 editor 主入口
 * - 同时把 `GraphViewportHostBridge` 暴露给宿主调试对象
 */
export function installPreviewRemoteAuthorityHostDemoBootstrap(
  host: PreviewRemoteAuthorityHostDemoGlobal =
    globalThis as PreviewRemoteAuthorityHostDemoGlobal
): void {
  const currentBootstrap = host.LeaferGraphEditorAppBootstrap ?? {};
  const authorityOptions = readHostDemoAuthorityOptions(host);
  const debugViewportBridgeLog = readViewportBridgeDebugEnabled(host);
  const previewBootstrap = createPreviewRemoteAuthorityBootstrap(authorityOptions);
  const previousListener = currentBootstrap.onViewportHostBridgeChange;
  const hostDemoState: PreviewRemoteAuthorityHostDemoState = {
    mode: "host-demo",
    bridge: null,
    authorityLabel: authorityOptions.label,
    authorityName: authorityOptions.authorityName,
    debugViewportBridgeLog
  };

  host.LeaferGraphEditorHostDemo = hostDemoState;
  host.LeaferGraphEditorAppBootstrap = {
    ...currentBootstrap,
    ...previewBootstrap,
    onViewportHostBridgeChange(bridge) {
      hostDemoState.bridge = bridge;
      previousListener?.(bridge);
      if (debugViewportBridgeLog) {
        host.console?.info(
          "[authority-host-demo]",
          bridge
            ? `viewport bridge ready for ${authorityOptions.authorityName}`
            : `viewport bridge disposed for ${authorityOptions.authorityName}`
        );
      }
    }
  };
}

declare global {
  var LeaferGraphEditorHostDemo: PreviewRemoteAuthorityHostDemoState | undefined;
}
