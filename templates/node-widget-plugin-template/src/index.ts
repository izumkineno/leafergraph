import type { LeaferGraphNodePlugin } from "leafergraph";

import { templateDemoDocument } from "./presets";
import {
  templateNodeOnlyDemoModule,
  templateNodeWidgetDemoModule,
  templateWidgetCompanionModule
} from "./core";
import {
  TEMPLATE_PLUGIN_NAME,
  TEMPLATE_PLUGIN_VERSION
} from "./core";
import { templateExternalStatusWidget } from "./core";

export { templateDemoDocument } from "./presets";
export {
  templateNodeOnlyDemoModule,
  templateNodeWidgetDemoModule,
  templateWidgetCompanionModule
} from "./core";
export * from "./core";
export * from "./presets";

/**
 * 模板工程默认导出的插件对象。
 *
 * 这是宿主最直接的接入方式：
 *
 * ```ts
 * import { createLeaferGraph } from "leafergraph";
 * import templatePlugin, {
 *   templateDemoDocument
 * } from "@template/node-widget-demo";
 *
 * const graph = createLeaferGraph(container, {
 *   plugins: [templatePlugin],
 *   document: templateDemoDocument
 * });
 * ```
 *
 * 这里最重要的不是代码量，而是安装顺序：
 * 1. 先注册外部 widget
 * 2. 再安装 node module
 *
 * 因为模块中的某些节点已经引用了这个 widget，
 * 如果顺序反过来，节点注册阶段就可能遇到“widget 未注册”的校验失败。
 */
export const templateNodeWidgetDemoPlugin: LeaferGraphNodePlugin = {
  name: TEMPLATE_PLUGIN_NAME,
  version: TEMPLATE_PLUGIN_VERSION,
  install(ctx) {
    ctx.registerWidget(templateExternalStatusWidget, { overwrite: true });
    ctx.installModule(templateNodeWidgetDemoModule, { overwrite: true });
  }
};

/** 只安装可独立节点的插件。 */
export const templateNodeOnlyDemoPlugin: LeaferGraphNodePlugin = {
  name: `${TEMPLATE_PLUGIN_NAME}/nodes`,
  version: TEMPLATE_PLUGIN_VERSION,
  install(ctx) {
    ctx.installModule(templateNodeOnlyDemoModule, { overwrite: true });
  }
};

/** 只安装外部 widget 及其伴生节点的插件。 */
export const templateWidgetOnlyDemoPlugin: LeaferGraphNodePlugin = {
  name: `${TEMPLATE_PLUGIN_NAME}/widget`,
  version: TEMPLATE_PLUGIN_VERSION,
  install(ctx) {
    ctx.registerWidget(templateExternalStatusWidget, { overwrite: true });
    ctx.installModule(templateWidgetCompanionModule, { overwrite: true });
  }
};

/**
 * 额外导出一份默认 document 数据，方便宿主快速确认模板已接通。
 *
 * 这样一个最小接入示例只需要：
 * - `plugins: [templateNodeWidgetDemoPlugin]`
 * - `document: templateDemoDocument`
 */
export { templateDemoDocument as templateNodeWidgetDemoDocument };

export default templateNodeWidgetDemoPlugin;
