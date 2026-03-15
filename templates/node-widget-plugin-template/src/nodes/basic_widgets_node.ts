import type { NodeDefinition } from "@leafergraph/node";

import {
  TEMPLATE_BASIC_WIDGET_NODE_LOCAL_TYPE,
  TEMPLATE_NODE_MIN_HEIGHT,
  TEMPLATE_NODE_WIDTH
} from "../shared";

/**
 * 一个“基础组件全集节点”示例。
 *
 * 它的作用是让外部插件作者快速确认：
 * 1. 主包内建 widget 是否已经全部接入
 * 2. 节点缩放时 widget 布局是否稳定
 * 3. 数据序列化后，每种 widget 的值是否能保持
 *
 * 这个节点尽量覆盖目前主包已经提供的基础 widget 类型。
 */
export const templateBasicWidgetsNodeDefinition: NodeDefinition = {
  type: TEMPLATE_BASIC_WIDGET_NODE_LOCAL_TYPE,
  title: "Basic Widgets",
  size: [TEMPLATE_NODE_WIDTH, TEMPLATE_NODE_MIN_HEIGHT],
  resize: {
    enabled: true,
    minWidth: TEMPLATE_NODE_WIDTH,
    minHeight: TEMPLATE_NODE_MIN_HEIGHT,
    snap: 4
  },
  inputs: [{ name: "Input", type: "string" }],
  outputs: [{ name: "Output", type: "event" }],
  widgets: [
    {
      type: "number",
      name: "number",
      value: 42,
      options: { label: "Number" }
    },
    {
      type: "string",
      name: "string",
      value: "Readonly text",
      options: { label: "String" }
    },
    {
      type: "input",
      name: "input",
      value: "Template Input",
      options: { label: "Input", placeholder: "Input text" }
    },
    {
      type: "textarea",
      name: "textarea",
      value: "Line 1\nLine 2\nLine 3",
      options: { label: "Textarea", placeholder: "Textarea" }
    },
    {
      type: "slider",
      name: "slider",
      value: 0.42,
      options: { label: "Slider" }
    },
    {
      type: "toggle",
      name: "toggle",
      value: true,
      options: { label: "Toggle", onText: "ON", offText: "OFF" }
    },
    {
      type: "select",
      name: "select",
      value: "Overlay",
      options: {
        label: "Select",
        items: ["Multiply", "Screen", "Overlay"]
      }
    },
    {
      type: "button",
      name: "button",
      value: "Apply",
      options: { label: "Button", text: "Apply", action: "apply" }
    },
    {
      type: "checkbox",
      name: "checkbox",
      value: true,
      options: { label: "Checkbox", onText: "Enabled", offText: "Disabled" }
    },
    {
      type: "radio",
      name: "radio",
      value: "High",
      options: { label: "Radio", items: ["Low", "Medium", "High"] }
    },
    {
      type: "custom",
      name: "custom",
      value: {
        mode: "advanced",
        seed: 12
      },
      options: { label: "Custom" }
    }
  ]
};
