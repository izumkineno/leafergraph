import type { GraphDocument } from "leafergraph";

import {
  TEMPLATE_BASIC_WIDGET_NODE_TYPE,
  TEMPLATE_CATEGORY_NODE_TYPE,
  TEMPLATE_EXECUTE_COUNTER_NODE_TYPE,
  TEMPLATE_EXECUTE_DISPLAY_NODE_TYPE,
  TEMPLATE_EXTERNAL_WIDGET_NODE_TYPE,
  createTemplateControlWidget
} from "./shared";

/**
 * 这份 document 数据是给宿主项目快速验证模板接入是否成功的。
 *
 * 用法通常是：
 * 1. 先安装模板插件
 * 2. 再把这份 document 作为初始化图数据传给宿主
 *
 * 注意这里的 `type` 必须写“安装后的最终类型”，
 * 也就是带 namespace 的那一套值。
 */
export const templateDemoDocument: GraphDocument = {
  documentId: "template-demo-document",
  revision: 1,
  appKind: "leafergraph-local",
  nodes: [
    {
      id: "template-on-play",
      type: "system/on-play",
      title: "On Play",
      layout: {
        x: 452,
        y: 96
      }
    },
    {
      id: "template-source",
      type: TEMPLATE_CATEGORY_NODE_TYPE,
      title: "Texture",
      layout: {
        x: 44,
        y: 112
      },
      properties: {
        subtitle: "Template source",
        accent: "#3B82F6",
        status: "LIVE"
      },
      inputs: [{ name: "Seed", type: "number" }],
      outputs: [{ name: "Texture", type: "image" }],
      widgets: [createTemplateControlWidget("Exposure", 0.58, "1.10")]
    },
    {
      id: "template-math",
      type: TEMPLATE_CATEGORY_NODE_TYPE,
      title: "Multiply",
      layout: {
        x: 344,
        y: 248
      },
      properties: {
        subtitle: "Template math",
        accent: "#6366F1",
        status: "LIVE"
      },
      inputs: [
        { name: "A", type: "image" },
        { name: "B", type: "image" }
      ],
      outputs: [{ name: "Result", type: "image" }],
      widgets: [createTemplateControlWidget("Factor", 0.5, "2.50")]
    },
    {
      id: "template-widget-kit",
      type: TEMPLATE_BASIC_WIDGET_NODE_TYPE,
      title: "Widgets",
      layout: {
        x: 120,
        y: 372
      },
      properties: {
        subtitle: "Template widget set",
        accent: "#22C55E",
        status: "READY"
      }
    },
    {
      id: "template-external-widget",
      type: TEMPLATE_EXTERNAL_WIDGET_NODE_TYPE,
      title: "External Widget",
      layout: {
        x: 486,
        y: 348
      },
      properties: {
        subtitle: "Template plugin widget",
        status: "PLUGIN"
      }
    },
    {
      id: "template-execute-source",
      type: TEMPLATE_EXECUTE_COUNTER_NODE_TYPE,
      title: "Counter Source",
      layout: {
        x: 736,
        y: 96
      },
      properties: {
        subtitle: "可由 On Play 驱动，也可从节点菜单单独起跑",
        accent: "#F97316",
        status: "READY",
        count: 0
      }
    },
    {
      id: "template-execute-display",
      type: TEMPLATE_EXECUTE_DISPLAY_NODE_TYPE,
      title: "Display",
      layout: {
        x: 1012,
        y: 96
      },
      properties: {
        subtitle: "等待上游执行传播",
        accent: "#0EA5E9",
        status: "WAITING"
      }
    }
  ],
  links: [
    {
      id: "template-link:source->math",
      source: {
        nodeId: "template-source",
        slot: 0
      },
      target: {
        nodeId: "template-math",
        slot: 0
      }
    },
    {
      id: "template-link:execute-source->display",
      source: {
        nodeId: "template-execute-source",
        slot: 0
      },
      target: {
        nodeId: "template-execute-display",
        slot: 0
      }
    },
    {
      id: "template-link:on-play->execute-source",
      source: {
        nodeId: "template-on-play",
        slot: 0
      },
      target: {
        nodeId: "template-execute-source",
        slot: 0
      }
    }
  ]
};
