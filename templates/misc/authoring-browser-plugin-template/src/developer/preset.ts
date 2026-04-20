import type { AuthoringBrowserTemplateDemoPreset } from "./shared";
import {
  AUTHORING_BROWSER_TEMPLATE_DEMO_DOCUMENT_ID,
  AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_TYPE,
  AUTHORING_BROWSER_TEMPLATE_SUM_TYPE,
  AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME,
  AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE,
  AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE
} from "./shared";

/**
 * 供 `src/presets/demo_document.ts` 消费的最小 demo 预设。
 *
 * 这里仍然放在 `developer/` 里，
 * 是为了让开发者可以直接在同一层级下调整 demo 节点与连线，
 * 而不用改真正的 GraphDocument 组装文件。
 */
export const authoringBrowserTemplateDemoPreset: AuthoringBrowserTemplateDemoPreset =
  {
    documentId: AUTHORING_BROWSER_TEMPLATE_DEMO_DOCUMENT_ID,
    nodes: [
      {
        id: "template-on-play",
        type: "system/on-play",
        title: "On Play",
        layout: {
          x: 80,
          y: 120
        }
      },
      {
        id: "template-pulse",
        type: AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_TYPE,
        title: "Pulse Counter",
        layout: {
          x: 320,
          y: 120
        },
        properties: {
          runCount: 0,
          subtitle: "可由 system/on-play 直接触发",
          status: "READY"
        }
      },
      {
        id: "template-watch",
        type: AUTHORING_BROWSER_TEMPLATE_WATCH_TYPE,
        title: "Watch",
        layout: {
          x: 620,
          y: 120
        },
        properties: {
          subtitle: "等待输入",
          status: "WAITING"
        },
        widgets: [
          {
            type: AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE,
            name: AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_NAME,
            value: "EMPTY",
            options: {
              label: "Watch Text",
              description: "运行后会在这里看到最新计数值",
              emptyText: "EMPTY"
            }
          }
        ]
      },
      {
        id: "template-sum",
        type: AUTHORING_BROWSER_TEMPLATE_SUM_TYPE,
        title: "Sum",
        layout: {
          x: 320,
          y: 360
        },
        properties: {
          precision: 2,
          subtitle: "可手动接到 Watch 节点验证计算结果",
          status: "READY"
        }
      }
    ],
    links: [
      {
        id: "template-link:on-play->pulse",
        source: {
          nodeId: "template-on-play",
          slot: 0
        },
        target: {
          nodeId: "template-pulse",
          slot: 0
        }
      },
      {
        id: "template-link:pulse->watch",
        source: {
          nodeId: "template-pulse",
          slot: 0
        },
        target: {
          nodeId: "template-watch",
          slot: 0
        }
      }
    ]
  };
