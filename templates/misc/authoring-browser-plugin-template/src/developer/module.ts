import {
  createAuthoringModule,
  createAuthoringPlugin
} from "@leafergraph/extensions/authoring";

import { PulseCounterNode, SumNode, WatchNode } from "./nodes";
import {
  AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  AUTHORING_BROWSER_TEMPLATE_SCOPE,
  AUTHORING_BROWSER_TEMPLATE_VERSION
} from "./shared";
import { TextReadoutWidget } from "./widgets";

/** 模板默认导出的全部节点作者类。 */
export const authoringBrowserTemplateNodeClasses = [
  SumNode,
  PulseCounterNode,
  WatchNode
] as const;

/** 宿主可直接安装的节点模块。 */
export const authoringBrowserTemplateModule = createAuthoringModule({
  scope: AUTHORING_BROWSER_TEMPLATE_SCOPE,
  nodes: [...authoringBrowserTemplateNodeClasses]
});

/** 只注册 Widget 的 authoring 插件。 */
export const authoringBrowserTemplateWidgetPlugin = createAuthoringPlugin({
  name: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/widget-plugin`,
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  widgets: [TextReadoutWidget]
});

/** 只安装节点模块的 authoring 插件。 */
export const authoringBrowserTemplateNodePlugin = createAuthoringPlugin({
  name: `${AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME}/node-plugin`,
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  scope: AUTHORING_BROWSER_TEMPLATE_SCOPE,
  nodes: [...authoringBrowserTemplateNodeClasses]
});

/** 同时注册 Widget 与节点模块的完整插件。 */
export const authoringBrowserTemplatePlugin = createAuthoringPlugin({
  name: AUTHORING_BROWSER_TEMPLATE_PACKAGE_NAME,
  version: AUTHORING_BROWSER_TEMPLATE_VERSION,
  scope: AUTHORING_BROWSER_TEMPLATE_SCOPE,
  widgets: [TextReadoutWidget],
  nodes: [...authoringBrowserTemplateNodeClasses]
});
