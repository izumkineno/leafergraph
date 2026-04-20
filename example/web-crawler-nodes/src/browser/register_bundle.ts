import type { LeaferGraphNodePlugin } from "@leafergraph/contracts";

interface WebCrawlerNodesBundleManifestBase {
  id: string;
  name: string;
  kind: "node";
  version?: string;
  requires?: string[];
}

interface WebCrawlerNodesNodeBundleManifest
  extends WebCrawlerNodesBundleManifestBase {
  kind: "node";
  plugin: LeaferGraphNodePlugin;
  quickCreateNodeType?: string;
}

interface WebCrawlerNodesBundleBridge {
  registerBundle(manifest: WebCrawlerNodesNodeBundleManifest): void;
}

function requireBundleBridge(): WebCrawlerNodesBundleBridge {
  const bridge = (
    globalThis as typeof globalThis & {
      LeaferGraphEditorBundleBridge?: WebCrawlerNodesBundleBridge;
    }
  ).LeaferGraphEditorBundleBridge;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error(
      "LeaferGraphEditorBundleBridge 不存在，请先在 editor 页面里加载本地 bundle"
    );
  }

  return bridge;
}

export function registerWebCrawlerNodesBundle(
  manifest: WebCrawlerNodesNodeBundleManifest
): void {
  requireBundleBridge().registerBundle(manifest);
}