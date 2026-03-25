import type { LeaferGraphNodePlugin } from "leafergraph";

interface AuthoringNodeTemplateBundleManifestBase {
  id: string;
  name: string;
  kind: "node";
  version?: string;
  requires?: string[];
}

interface AuthoringNodeTemplateNodeBundleManifest
  extends AuthoringNodeTemplateBundleManifestBase {
  kind: "node";
  plugin: LeaferGraphNodePlugin;
  quickCreateNodeType?: string;
}

interface AuthoringNodeTemplateBundleBridge {
  registerBundle(manifest: AuthoringNodeTemplateNodeBundleManifest): void;
}

function requireBundleBridge(): AuthoringNodeTemplateBundleBridge {
  const bridge = (
    globalThis as typeof globalThis & {
      LeaferGraphEditorBundleBridge?: AuthoringNodeTemplateBundleBridge;
    }
  ).LeaferGraphEditorBundleBridge;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error(
      "LeaferGraphEditorBundleBridge 不存在，请先在 editor 页面里加载本地 bundle"
    );
  }

  return bridge;
}

export function registerAuthoringNodeTemplateBundle(
  manifest: AuthoringNodeTemplateNodeBundleManifest
): void {
  requireBundleBridge().registerBundle(manifest);
}
