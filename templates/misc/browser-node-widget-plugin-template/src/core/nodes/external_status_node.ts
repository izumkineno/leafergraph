import type { NodeDefinition } from "@leafergraph/node";

import {
  TEMPLATE_EXTERNAL_STATUS_WIDGET_TYPE,
  TEMPLATE_EXTERNAL_WIDGET_NODE_LOCAL_TYPE,
  TEMPLATE_NODE_WIDTH
} from "../shared";

/**
 * 这个节点专门用来演示“节点依赖一个外部自定义 widget”。
 *
 * 和 `Basic Widgets` 节点不同，它依赖的不是主包内建控件，
 * 而是本模板自己提供的 `template/external-status`。
 *
 * 这也是为什么插件安装顺序必须是：
 * 1. 先注册 widget
 * 2. 再安装 node module
 */
export const templateExternalStatusNodeDefinition: NodeDefinition = {
  type: TEMPLATE_EXTERNAL_WIDGET_NODE_LOCAL_TYPE,
  title: "External Widget",
  size: [TEMPLATE_NODE_WIDTH, 212],
  resize: {
    enabled: true,
    minWidth: TEMPLATE_NODE_WIDTH,
    minHeight: 212,
    snap: 4
  },
  properties: [
    { name: "subtitle", type: "string" },
    { name: "status", type: "string", default: "PLUGIN" }
  ],
  inputs: [{ name: "Signal", type: "event" }],
  outputs: [{ name: "State", type: "string" }],
  widgets: [
    {
      type: TEMPLATE_EXTERNAL_STATUS_WIDGET_TYPE,
      name: "external-status",
      value: "live",
      options: {
        label: "Package Status",
        description: "来自模板外部 widget"
      }
    }
  ]
};
