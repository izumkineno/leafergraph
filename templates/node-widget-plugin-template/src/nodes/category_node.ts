import type { NodeDefinition } from "@leafergraph/node";

import {
  TEMPLATE_CATEGORY_NODE_LOCAL_TYPE,
  TEMPLATE_NODE_MIN_HEIGHT,
  TEMPLATE_NODE_WIDTH,
  createTemplateControlWidget
} from "../shared";

/**
 * 一个最小的“分类节点”示例。
 *
 * 这个节点保留了 editor demo 中最常见的几类字段：
 * - 标题和副标题
 * - accent 色
 * - 状态文本
 * - 一组基础输入 / 输出槽位
 * - 一个简单的 slider widget
 *
 * 这里刻意不写 `category`，
 * 是为了演示模块安装时如何通过 `scope.group` 批量继承默认分组。
 */
export const templateCategoryNodeDefinition: NodeDefinition = {
  type: TEMPLATE_CATEGORY_NODE_LOCAL_TYPE,
  title: "Category Node",
  size: [TEMPLATE_NODE_WIDTH, TEMPLATE_NODE_MIN_HEIGHT],
  resize: {
    enabled: true,
    minWidth: TEMPLATE_NODE_WIDTH,
    minHeight: TEMPLATE_NODE_MIN_HEIGHT,
    snap: 4
  },
  properties: [
    { name: "subtitle", type: "string" },
    { name: "accent", type: "string", default: "#8B5CF6" },
    { name: "status", type: "string", default: "READY" }
  ],
  inputs: [{ name: "Input", type: "number" }],
  outputs: [{ name: "Output", type: "number" }],
  widgets: [createTemplateControlWidget("Value", 0.5, "0.50")]
};
