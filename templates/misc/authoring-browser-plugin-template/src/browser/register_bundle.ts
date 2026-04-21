import type { LeaferGraphNodePlugin } from "@leafergraph/core/contracts";
import type { GraphDocument } from "@leafergraph/core/node";

type AuthoringBrowserTemplateBundleSlot = "demo" | "node" | "widget";

interface AuthoringBrowserTemplateBundleManifestBase {
  id: string;
  name: string;
  kind: AuthoringBrowserTemplateBundleSlot;
  version?: string;
  requires?: string[];
}

interface AuthoringBrowserTemplateDemoBundleManifest
  extends AuthoringBrowserTemplateBundleManifestBase {
  kind: "demo";
  document: GraphDocument;
}

interface AuthoringBrowserTemplatePluginBundleManifest
  extends AuthoringBrowserTemplateBundleManifestBase {
  kind: "node" | "widget";
  plugin: LeaferGraphNodePlugin;
  quickCreateNodeType?: string;
}

type AuthoringBrowserTemplateBundleManifest =
  | AuthoringBrowserTemplateDemoBundleManifest
  | AuthoringBrowserTemplatePluginBundleManifest;

interface AuthoringBrowserTemplateBundleBridge {
  registerBundle(manifest: AuthoringBrowserTemplateBundleManifest): void;
}

/**
 * 获取Bundle 桥接层。
 *
 * @returns 获取Bundle 桥接层的结果。
 */
function requireBundleBridge(): AuthoringBrowserTemplateBundleBridge {
  const bridge = (
    globalThis as typeof globalThis & {
      LeaferGraphEditorBundleBridge?: AuthoringBrowserTemplateBundleBridge;
    }
  ).LeaferGraphEditorBundleBridge;

  if (!bridge || typeof bridge.registerBundle !== "function") {
    throw new Error(
      "LeaferGraphEditorBundleBridge 不存在，请先在 editor 页面里加载本地 bundle"
    );
  }

  return bridge;
}

/**
 * 注册`Authoring` 浏览器模板 Bundle。
 *
 * @param manifest - `manifest`。
 * @returns 无返回值。
 */
export function registerAuthoringBrowserTemplateBundle(
  manifest: AuthoringBrowserTemplateBundleManifest
): void {
  requireBundleBridge().registerBundle(manifest);
}
