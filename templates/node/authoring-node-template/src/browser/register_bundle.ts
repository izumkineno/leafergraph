import type { LeaferGraphNodePlugin } from "@leafergraph/contracts";

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

/**
 * 获取Bundle 桥接层。
 *
 * @returns 获取Bundle 桥接层的结果。
 */
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

/**
 * 注册`Authoring` 节点模板 Bundle。
 *
 * @param manifest - `manifest`。
 * @returns 无返回值。
 */
export function registerAuthoringNodeTemplateBundle(
  manifest: AuthoringNodeTemplateNodeBundleManifest
): void {
  requireBundleBridge().registerBundle(manifest);
}
