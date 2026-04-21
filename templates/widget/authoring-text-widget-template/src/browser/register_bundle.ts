import type { LeaferGraphNodePlugin } from "@leafergraph/core/contracts";

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

/**
 * 获取Bundle 桥接层。
 *
 * @returns 获取Bundle 桥接层的结果。
 */
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

/**
 * 注册`Authoring` 文本 Widget 模板 Bundle。
 *
 * @param manifest - `manifest`。
 * @returns 无返回值。
 */
export function registerAuthoringTextWidgetTemplateBundle(
  manifest: AuthoringTextWidgetTemplateBundleManifest
): void {
  requireBundleBridge().registerBundle(manifest);
}
