import type { LeaferGraphNodePlugin } from "@leafergraph/contracts";

interface AuthoringTextWidgetTemplateBundleManifest {
  id: string;
  name: string;
  kind: "widget";
  version?: string;
  requires?: string[];
  plugin: LeaferGraphNodePlugin;
}

interface AuthoringTextWidgetTemplateBundleBridge {
  registerBundle(manifest: AuthoringTextWidgetTemplateBundleManifest): void;
}

function requireBundleBridge(): AuthoringTextWidgetTemplateBundleBridge {
  const bridge = (
    globalThis as typeof globalThis & {
      LeaferGraphEditorBundleBridge?: AuthoringTextWidgetTemplateBundleBridge;
    }
  ).LeaferGraphEditorBundleBridge;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error(
      "LeaferGraphEditorBundleBridge 不存在，请先在 editor 页面里加载本地 bundle"
    );
  }

  return bridge;
}

export function registerAuthoringTextWidgetTemplateBundle(
  manifest: AuthoringTextWidgetTemplateBundleManifest
): void {
  requireBundleBridge().registerBundle(manifest);
}
