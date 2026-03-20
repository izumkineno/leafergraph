import { templateDemoDocument } from "../presets/demo_document";
import {
  TEMPLATE_PLUGIN_NAME,
  TEMPLATE_PLUGIN_VERSION
} from "../core/shared";
import { registerTemplateBundle } from "./register_bundle";

/**
 * 演示 document bundle 只负责把默认图数据交给 editor。
 * 它本身不安装节点或 widget，因此显式依赖 node + widget 两个槽位。
 */
registerTemplateBundle({
  id: `${TEMPLATE_PLUGIN_NAME}/demo`,
  name: "Template Demo Document",
  kind: "demo",
  version: TEMPLATE_PLUGIN_VERSION,
  requires: [
    `${TEMPLATE_PLUGIN_NAME}/node`,
    `${TEMPLATE_PLUGIN_NAME}/widget`
  ],
  document: templateDemoDocument
});
