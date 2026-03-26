/**
 * 浏览器启动入口模块。
 */
import { render } from "preact";

import { resolveEditorAppBootstrap } from "./app/editor_app_bootstrap";
import { installPreviewRemoteAuthorityBootstrap } from "./demo/preview_remote_authority_bootstrap";
import { App } from "./index";
import "./styles.css";

/** 浏览器侧 editor 宿主挂载点。 */
const host = document.querySelector<HTMLDivElement>("#app");

if (!host) {
  throw new Error("LeaferGraph editor host not found.");
}

// 先安装预览 bootstrap，再解析最终启动参数，保证静态页面和 demo 页面共用同一入口。
installPreviewRemoteAuthorityBootstrap();

const bootstrap = resolveEditorAppBootstrap();

render(
  <App
    preloadedBundles={bootstrap.preloadedBundles}
    remoteAuthoritySource={bootstrap.remoteAuthoritySource}
    onViewportHostBridgeChange={bootstrap.onViewportHostBridgeChange}
  />,
  host
);
