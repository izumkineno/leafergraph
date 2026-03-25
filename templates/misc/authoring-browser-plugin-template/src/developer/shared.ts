import type { GraphDocument } from "leafergraph";

/**
 * 这份文件集中放“项目级信息”。
 *
 * 开发者如果只是想改：
 * - 包名、版本
 * - 节点命名空间
 * - Widget 类型
 * - bundle id / 展示名
 * - demo 文档 id
 *
 * 优先修改这里即可，不需要先进入节点或 Widget 代码。
 */
export const AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME =
  "@template/authoring-browser-plugin-template";

/** 模板默认版本号，同时用于 ESM 导出和 browser bundle manifest。 */
export const AUTHORING_BROWSER_TEMPLATE_VERSION = "0.1.0";

/** 模块安装时使用的命名空间与分组。 */
export const AUTHORING_BROWSER_TEMPLATE_SCOPE = {
  namespace: "authoring-browser-template",
  group: "Authoring Browser Template"
} as const;

/** 模板内置节点的默认宽度。 */
export const AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH = 288;

/** 模板内置节点的默认最小高度。 */
export const AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT = 184;

/** `SumNode` 的局部类型名。 */
export const AUTHORING_BROWSER_TEMPLATE_SUM_LOCAL_TYPE = "sum";

/** `PulseCounterNode` 的局部类型名。 */
export const AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_LOCAL_TYPE =
  "pulse-counter";

/** `WatchNode` 的局部类型名。 */
export const AUTHORING_BROWSER_TEMPLATE_WATCH_LOCAL_TYPE = "watch";

/** `TextReadoutWidget` 的最终 Widget 类型。 */
export const AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE =
  "authoring-browser-template/text-readout";

/** `WatchNode` 内部引用的 Widget 名称。 */
export const AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME = "readout";

/** browser `widget.iife.js` 的 bundle id。 */
export const AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_ID =
  `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/widget`;

/** browser `node.iife.js` 的 bundle id。 */
export const AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_ID =
  `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/node`;

/** browser `demo.iife.js` 的 bundle id。 */
export const AUTHORING_BROWSER_TEMPLATE_DEMO_BUNDLE_ID =
  `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/demo`;

/** browser `widget.iife.js` 的展示名。 */
export const AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_NAME =
  "Authoring Browser Widget Bundle";

/** browser `node.iife.js` 的展示名。 */
export const AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_NAME =
  "Authoring Browser Node Bundle";

/** browser `demo.iife.js` 的展示名。 */
export const AUTHORING_BROWSER_TEMPLATE_DEMO_BUNDLE_NAME =
  "Authoring Browser Demo";

/** demo 文档默认使用的 document id。 */
export const AUTHORING_BROWSER_TEMPLATE_DEMO_DOCUMENT_ID =
  "authoring-browser-template-demo-document";

/**
 * 把局部类型名提升为宿主真实消费的最终节点类型。
 *
 * 节点实现本身只依赖局部类型名，
 * 但 document 恢复与 bundle quick create 需要稳定最终类型。
 */
export function resolveAuthoringBrowserTemplateType(localType: string): string {
  return `${AUTHORING_BROWSER_TEMPLATE_SCOPE.namespace}/${localType}`;
}

/** `SumNode` 的最终节点类型。 */
export const AUTHORING_BROWSER_TEMPLATE_SUM_TYPE =
  resolveAuthoringBrowserTemplateType(
    AUTHORING_BROWSER_TEMPLATE_SUM_LOCAL_TYPE
  );

/** `PulseCounterNode` 的最终节点类型。 */
export const AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_TYPE =
  resolveAuthoringBrowserTemplateType(
    AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_LOCAL_TYPE
  );

/** `WatchNode` 的最终节点类型。 */
export const AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE =
  resolveAuthoringBrowserTemplateType(
    AUTHORING_BROWSER_TEMPLATE_WATCH_LOCAL_TYPE
  );

/** browser bundle 在 editor 中默认快速创建的节点类型。 */
export const authoringBrowserTemplateQuickCreateNodeType =
  AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE;

/** `node.iife.js` 需要先加载的依赖 bundle。 */
export const authoringBrowserTemplateNodeBundleRequires = [
  AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_ID
] as const;

/** `demo.iife.js` 需要先加载的依赖 bundle。 */
export const authoringBrowserTemplateDemoBundleRequires = [
  AUTHORING_BROWSER_TEMPLATE_WIDGET_BUNDLE_ID,
  AUTHORING_BROWSER_TEMPLATE_NODE_BUNDLE_ID
] as const;

/** 供开发者配置 demo 图内容的最小预设结构。 */
export interface AuthoringBrowserTemplateDemoPreset {
  documentId: string;
  nodes: GraphDocument["nodes"];
  links: GraphDocument["links"];
}
