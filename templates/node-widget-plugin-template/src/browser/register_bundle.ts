import type { GraphDocument, LeaferGraphNodePlugin } from "leafergraph";

/** browser bundle 可使用的固定槽位。 */
type TemplateBrowserBundleSlot = "demo" | "node" | "widget";

/** browser bundle manifest 的公共字段。 */
interface TemplateBrowserBundleManifestBase {
  id: string;
  name: string;
  kind: TemplateBrowserBundleSlot;
  version?: string;
  requires?: string[];
}

/** demo bundle manifest。 */
export interface TemplateBrowserDemoBundleManifest
  extends TemplateBrowserBundleManifestBase {
  kind: "demo";
  document: GraphDocument;
}

/** node / widget bundle manifest。 */
export interface TemplateBrowserPluginBundleManifest
  extends TemplateBrowserBundleManifestBase {
  kind: "node" | "widget";
  plugin: LeaferGraphNodePlugin;
  quickCreateNodeType?: string;
}

/** 模板 browser 入口支持的全部 manifest。 */
export type TemplateBrowserBundleManifest =
  | TemplateBrowserDemoBundleManifest
  | TemplateBrowserPluginBundleManifest;

/** editor 在浏览器全局上暴露的最小桥接接口。 */
interface TemplateBundleBridge {
  registerBundle(manifest: TemplateBrowserBundleManifest): void;
}

/** 读取 editor 提供的 bundle bridge。 */
function requireTemplateBundleBridge(): TemplateBundleBridge {
  const bridge = (
    globalThis as typeof globalThis & {
      LeaferGraphEditorBundleBridge?: TemplateBundleBridge;
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
 * 将模板 manifest 注册到 editor。
 * IIFE bundle 顶层只做这一件事，避免把宿主状态控制逻辑散落到模板里。
 */
export function registerTemplateBundle(
  manifest: TemplateBrowserBundleManifest
): void {
  requireTemplateBundleBridge().registerBundle(manifest);
}
