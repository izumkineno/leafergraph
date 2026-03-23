import { render } from "preact";

import { resolveEditorAppBootstrap } from "./app/editor_app_bootstrap";
import { installPreviewRemoteAuthorityBootstrap } from "./demo/preview_remote_authority_bootstrap";
import { App } from "./index";
import "./styles.css";

const host = document.querySelector<HTMLDivElement>("#app");

if (!host) {
  throw new Error("LeaferGraph editor host not found.");
}

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
