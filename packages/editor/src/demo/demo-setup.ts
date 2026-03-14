import type {
  LeaferGraphContextMenuContext,
  LeaferGraphCreateNodeInput,
  LeaferGraphData,
  LeaferGraphOptions
} from "leafergraph";
import { EDITOR_EXTERNAL_WIDGET_NODE_TYPE } from "./external-widget-demo";

const DEMO_NODE_WIDTH = 288;
const DEMO_NODE_MIN_HEIGHT = 184;

export const EDITOR_DEMO_CATEGORY_NODE_TYPE = "demo/category-node";
export const EDITOR_DEMO_BASIC_WIDGET_NODE_TYPE = "demo/basic-widgets";
export const EDITOR_DEMO_CONTROL_WIDGET = "primary-control";
export const EDITOR_DEMO_MISSING_NODE_TYPE = "missing/demo-node";
export const EDITOR_DEMO_MISSING_WIDGET_TYPE = "missing/widget";

/**
 * 创建 editor 示例节点使用的标准 slider widget。
 * 这样“默认节点”和“右键快速创建”可以共用同一套演示数据。
 */
function createDemoControlWidget(
  label: string,
  progress: number,
  displayValue?: string
) {
  return {
    type: "slider" as const,
    name: EDITOR_DEMO_CONTROL_WIDGET,
    value: progress,
    options: {
      label,
      ...(displayValue !== undefined ? { displayValue } : {})
    }
  };
}

/**
 * editor 专属 demo 节点模块。
 * 主包不再内建这些演示节点定义，而是由 editor 在启动时主动安装。
 */
export const editorDemoModules = [
  {
    nodes: [
      {
        type: EDITOR_DEMO_CATEGORY_NODE_TYPE,
        title: "Category Node",
        category: "Demo",
        size: [DEMO_NODE_WIDTH, DEMO_NODE_MIN_HEIGHT] as [number, number],
        resize: {
          enabled: true,
          minWidth: DEMO_NODE_WIDTH,
          minHeight: DEMO_NODE_MIN_HEIGHT,
          snap: 4
        },
        properties: [
          { name: "subtitle", type: "string" },
          { name: "accent", type: "string", default: "#8B5CF6" },
          { name: "category", type: "string" },
          { name: "status", type: "string", default: "READY" }
        ],
        widgets: [createDemoControlWidget("Value", 0.5)]
      },
      {
        type: EDITOR_DEMO_BASIC_WIDGET_NODE_TYPE,
        title: "Basic Widgets",
        category: "Demo",
        size: [DEMO_NODE_WIDTH, DEMO_NODE_MIN_HEIGHT] as [number, number],
        resize: {
          enabled: true,
          minWidth: DEMO_NODE_WIDTH,
          minHeight: DEMO_NODE_MIN_HEIGHT,
          snap: 4
        },
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
            value: "LeaferGraph",
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
      }
    ]
  }
] satisfies NonNullable<LeaferGraphOptions["modules"]>;

/**
 * editor 默认展示的图数据。
 * 连线、节点类型和 widget 示例全部在这里显式定义，避免主包再承担演示职责。
 */
export const editorDemoGraph = {
  nodes: [
    {
      id: "texture-source",
      type: EDITOR_DEMO_CATEGORY_NODE_TYPE,
      title: "Texture",
      subtitle: "Seeded source",
      x: 44,
      y: 112,
      accent: "#3B82F6",
      category: "Source / Image",
      status: "LIVE",
      inputs: [{ name: "Seed", type: "number" }],
      outputs: [{ name: "Texture", type: "image" }],
      widgets: [createDemoControlWidget("Exposure", 0.58, "1.10")]
    },
    {
      id: "multiply",
      type: EDITOR_DEMO_CATEGORY_NODE_TYPE,
      title: "Multiply",
      subtitle: "Math control",
      x: 344,
      y: 248,
      accent: "#6366F1",
      category: "Math / Float",
      status: "LIVE",
      inputs: [
        { name: "A", type: "float" },
        { name: "B", type: "float" }
      ],
      outputs: [{ name: "Result", type: "float" }],
      widgets: [createDemoControlWidget("Factor", 0.5, "2.50")]
    },
    {
      id: "preview",
      type: EDITOR_DEMO_CATEGORY_NODE_TYPE,
      title: "Preview",
      subtitle: "Viewport target",
      x: 644,
      y: 130,
      accent: "#8B5CF6",
      category: "Output / View",
      status: "SYNC",
      inputs: [{ name: "Image", type: "image" }],
      outputs: [{ name: "Panel", type: "event" }],
      widgets: [
        createDemoControlWidget("Zoom", 0.32, "1.00"),
        {
          type: "toggle",
          name: "live-preview",
          value: true,
          options: {
            label: "Live Preview",
            onText: "ON",
            offText: "OFF"
          }
        }
      ]
    },
    {
      id: "widget-kit",
      type: EDITOR_DEMO_BASIC_WIDGET_NODE_TYPE,
      title: "Widgets",
      subtitle: "Base components",
      x: 120,
      y: 360,
      accent: "#22C55E",
      category: "Demo / Widgets",
      status: "READY"
    },
    {
      id: "external-widget-demo",
      type: EDITOR_EXTERNAL_WIDGET_NODE_TYPE,
      title: "External Widget",
      subtitle: "Plugin registered",
      x: 468,
      y: 330,
      category: "Plugin / External",
      status: "PLUGIN"
    },
    {
      id: "missing-node-demo",
      type: EDITOR_DEMO_MISSING_NODE_TYPE,
      title: "Missing Node",
      x: 468,
      y: 548,
      width: DEMO_NODE_WIDTH,
      height: DEMO_NODE_MIN_HEIGHT
    },
    {
      id: "missing-widget-demo",
      type: EDITOR_DEMO_CATEGORY_NODE_TYPE,
      title: "Missing Widget",
      subtitle: "Known node with lost widget",
      x: 760,
      y: 362,
      accent: "#F97316",
      category: "Demo / Missing",
      status: "WARN",
      inputs: [{ name: "Input", type: "number" }],
      outputs: [{ name: "Output", type: "number" }],
      widgets: [
        createDemoControlWidget("Amount", 0.46, "0.46"),
        {
          type: EDITOR_DEMO_MISSING_WIDGET_TYPE,
          name: "missing-widget",
          value: "Unavailable"
        }
      ]
    }
  ],
  links: [
    {
      id: "demo-link:texture-source->multiply",
      source: {
        nodeId: "texture-source",
        slot: 0
      },
      target: {
        nodeId: "multiply",
        slot: 0
      }
    },
    {
      id: "demo-link:multiply->preview",
      source: {
        nodeId: "multiply",
        slot: 0
      },
      target: {
        nodeId: "preview",
        slot: 0
      }
    }
  ]
} satisfies LeaferGraphData;

/**
 * editor 右键菜单的快速创建节点输入。
 * 它同样留在 editor 内部，避免主包继续持有任何演示节点模板。
 */
export function createQuickCreateDemoNodeInput(
  context: LeaferGraphContextMenuContext,
  index: number
): LeaferGraphCreateNodeInput {
  return {
    type: EDITOR_DEMO_CATEGORY_NODE_TYPE,
    title: `节点 ${index}`,
    subtitle: "Context menu quick create",
    x: Math.round(context.pagePoint.x),
    y: Math.round(context.pagePoint.y),
    accent: index % 2 === 0 ? "#6366F1" : "#3B82F6",
    category: "Demo / Quick",
    status: "READY",
    inputs: ["Input"],
    outputs: ["Output"],
    widgets: [createDemoControlWidget("Value", 0.5, "0.50")]
  };
}
