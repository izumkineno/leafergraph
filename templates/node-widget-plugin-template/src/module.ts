import type { NodeModule } from "@leafergraph/node";

import {
  templateBasicWidgetsNodeDefinition,
  templateCategoryNodeDefinition,
  templateExternalStatusNodeDefinition
} from "./nodes";
import { TEMPLATE_MODULE_SCOPE } from "./shared";

/**
 * 模板模块本身只负责“批量提供节点定义”。
 *
 * 这里刻意不把 widget 混进来，
 * 是因为当前架构里 widget 已经是主包正式注册表的一部分，
 * 必须通过 `ctx.registerWidget(...)` 单独显式注册。
 */
export const templateNodeWidgetDemoModule: NodeModule = {
  scope: TEMPLATE_MODULE_SCOPE,
  nodes: [
    templateCategoryNodeDefinition,
    templateBasicWidgetsNodeDefinition,
    templateExternalStatusNodeDefinition
  ]
};

/**
 * 只包含“可独立成立”的模板节点模块。
 * browser `node.iife.js` 会使用它，确保单独加载 node bundle 时不会依赖外部 widget。
 */
export const templateNodeOnlyDemoModule: NodeModule = {
  scope: TEMPLATE_MODULE_SCOPE,
  nodes: [templateCategoryNodeDefinition, templateBasicWidgetsNodeDefinition]
};

/**
 * 只包含“依赖外部 widget”的伴生节点模块。
 * browser `widget.iife.js` 会先注册 widget，再安装这个模块。
 */
export const templateWidgetCompanionModule: NodeModule = {
  scope: TEMPLATE_MODULE_SCOPE,
  nodes: [templateExternalStatusNodeDefinition]
};
