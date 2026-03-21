import type { LeaferGraphNodePlugin } from "leafergraph";

import { templateWidgetCompanionModule } from "../core/module";
import {
  TEMPLATE_EXTERNAL_WIDGET_NODE_TYPE,
  TEMPLATE_PLUGIN_NAME,
  TEMPLATE_PLUGIN_VERSION
} from "../core/shared";
import { templateExternalStatusWidget } from "../core/widgets";
import { registerTemplateBundle } from "./register_bundle";

/** 只安装外部 widget 及其伴生节点的 browser 插件。 */
const templateWidgetBrowserPlugin: LeaferGraphNodePlugin = {
  name: `${TEMPLATE_PLUGIN_NAME}/browser-widget`,
  version: TEMPLATE_PLUGIN_VERSION,
  install(ctx) {
    ctx.registerWidget(templateExternalStatusWidget, { overwrite: true });
    ctx.installModule(templateWidgetCompanionModule, { overwrite: true });
  }
};

/**
 * widget bundle 会先注册外部 widget，再安装消费该 widget 的伴生节点。
 * 这样即使 editor 只启用 widget 槽位，也能马上看到渲染结果。
 */
registerTemplateBundle({
  id: `${TEMPLATE_PLUGIN_NAME}/widget`,
  name: "Template Widget Bundle",
  kind: "widget",
  version: TEMPLATE_PLUGIN_VERSION,
  plugin: templateWidgetBrowserPlugin,
  quickCreateNodeType: TEMPLATE_EXTERNAL_WIDGET_NODE_TYPE
});
