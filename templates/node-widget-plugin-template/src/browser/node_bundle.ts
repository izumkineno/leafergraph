import type { LeaferGraphNodePlugin } from "leafergraph";

import { templateNodeOnlyDemoModule } from "../module";
import {
  TEMPLATE_CATEGORY_NODE_TYPE,
  TEMPLATE_PLUGIN_NAME,
  TEMPLATE_PLUGIN_VERSION
} from "../shared";
import { registerTemplateBundle } from "./register_bundle";

/** 只安装可独立成立模板节点的 browser 插件。 */
const templateNodeBrowserPlugin: LeaferGraphNodePlugin = {
  name: `${TEMPLATE_PLUGIN_NAME}/browser-node`,
  version: TEMPLATE_PLUGIN_VERSION,
  install(ctx) {
    ctx.installModule(templateNodeOnlyDemoModule, { overwrite: true });
  }
};

/**
 * 节点 bundle 只负责节点模块，不依赖外部 widget。
 * 这样 editor 单独加载 node bundle 时，右键菜单依然能创建基础节点。
 */
registerTemplateBundle({
  id: `${TEMPLATE_PLUGIN_NAME}/node`,
  name: "Template Node Bundle",
  kind: "node",
  version: TEMPLATE_PLUGIN_VERSION,
  plugin: templateNodeBrowserPlugin,
  quickCreateNodeType: TEMPLATE_CATEGORY_NODE_TYPE
});
