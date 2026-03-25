/**
 * 这份文件集中放“项目级信息”。
 *
 * 开发者如果只是想改包名、命名空间、默认尺寸或 bundle 展示名，
 * 优先只改这里，不需要先进入节点实现文件。
 */
export const AUTHORING_NODE_TEMPLATE_PACKAGE_NAME =
  "@template/authoring-node-template";

/** 模板默认版本号，同时会用于 ESM 导出和 browser bundle manifest。 */
export const AUTHORING_NODE_TEMPLATE_VERSION = "0.1.0";

/** 节点模块安装时使用的命名空间与分组。 */
export const AUTHORING_NODE_TEMPLATE_SCOPE = {
  namespace: "authoring-node-template",
  group: "Authoring Node Template"
} as const;

/** 模板内置节点的默认宽度。 */
export const AUTHORING_NODE_TEMPLATE_NODE_WIDTH = 288;

/** 模板内置节点的默认最小高度。 */
export const AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT = 184;

/** `BasicSumNode` 的局部类型名。 */
export const AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE = "basic-sum";

/** `WatchNode` 的局部类型名。 */
export const AUTHORING_NODE_TEMPLATE_WATCH_LOCAL_TYPE = "watch";

/** `WatchNode` 内部只读文字 Widget 的名称。 */
export const AUTHORING_NODE_TEMPLATE_WATCH_WIDGET_NAME = "watch-text";

/** browser `node.iife.js` 的 bundle id。 */
export const AUTHORING_NODE_TEMPLATE_NODE_BUNDLE_ID =
  `${AUTHORING_NODE_TEMPLATE_PACKAGE_NAME}/node`;

/** browser `node.iife.js` 的展示名。 */
export const AUTHORING_NODE_TEMPLATE_NODE_BUNDLE_NAME =
  "Authoring Node Template Bundle";

/**
 * 把局部类型名提升为宿主真实消费的最终类型。
 *
 * 这样节点实现里只需要关心本地 `localType`，
 * 而 ESM / browser / document 恢复时都能拿到稳定的最终类型。
 */
export function resolveAuthoringNodeTemplateType(localType: string): string {
  return `${AUTHORING_NODE_TEMPLATE_SCOPE.namespace}/${localType}`;
}

/** `BasicSumNode` 的最终节点类型。 */
export const AUTHORING_NODE_TEMPLATE_BASIC_SUM_TYPE =
  resolveAuthoringNodeTemplateType(
    AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE
  );

/** `WatchNode` 的最终节点类型。 */
export const AUTHORING_NODE_TEMPLATE_WATCH_TYPE =
  resolveAuthoringNodeTemplateType(AUTHORING_NODE_TEMPLATE_WATCH_LOCAL_TYPE);

/** browser bundle 在 editor 中默认快速创建的节点类型。 */
export const authoringNodeTemplateQuickCreateNodeType =
  AUTHORING_NODE_TEMPLATE_WATCH_TYPE;
