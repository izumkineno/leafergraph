import { BaseNode, type DevNodeContext, type NodeProps, type NodeInputs, type NodeOutputs, type NodeState } from "@leafergraph/authoring";
import {
  WEB_CRAWLER_PARSER_TYPE,
  WEB_CRAWLER_NODES_DEFAULT_WIDTH,
  WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT,
  readWidgetString,
  updateStatus
} from "../shared";

/**
 * 解析节点：使用CSS selector解析DOM，提取匹配元素的innerHTML
 * 输入: 原始DOM字符串
 * 输出: 解析后的数组（每个元素是string）
 * Widget: selector输入框、状态栏
 */
export class ParserNode extends BaseNode<NodeProps, NodeInputs, NodeOutputs, NodeState> {
  static meta = {
    type: WEB_CRAWLER_PARSER_TYPE,
    title: "DOM Parser",
    category: "Web Crawler",
    description: "Parse DOM with CSS selector and extract matched elements",
    inputs: [
      { name: "dom", type: "string", optional: false }
    ],
     outputs: [
        { name: "result", type: "any" }
      ],
    properties: [
      { name: "selector", type: "string", default: "a" }
    ],
    widgets: [
      {
        type: "input",
        name: "selector",
        value: "a",
        options: {
          label: "Selector",
          placeholder: "CSS selector (e.g. a, .class, #id)"
        }
      },
      {
        type: "textarea",
        name: "status",
        value: "",
        options: {
          label: "Status",
          rows: 3,
          readonly: true
        }
      }
    ],
    size: [
      WEB_CRAWLER_NODES_DEFAULT_WIDTH,
      WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT + 10
    ] as [number, number],
    resize: {
      minWidth: WEB_CRAWLER_NODES_DEFAULT_WIDTH,
      minHeight: WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT
    }
  };

  createState(): NodeState {
    return {
      lastResult: [] as string[],
      lastCount: 0
    };
  }

  onExecute(ctx: DevNodeContext<NodeProps, NodeInputs, NodeOutputs, NodeState>) {
    const domStr = ctx.getInput("dom") as string;
    if (!domStr) {
      updateStatus(ctx, "⚠️ No input DOM provided");
      ctx.setOutput("result", "[]");
      return;
    }

    const selector = readWidgetString(ctx, "selector", "a");
    ctx.setProp("selector", selector);

    try {
      // 使用DOMParser解析HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(domStr, "text/html");
      const elements = doc.querySelectorAll(selector);
      
       const result: string[] = [];
       elements.forEach(el => {
         result.push(el.innerHTML.trim());
       });

       // 转为JSON字符串输出
       const resultStr = JSON.stringify(result, null, 2);

       ctx.setData("lastResult", result);
       ctx.setData("lastCount", result.length);
       ctx.setOutput("result", resultStr);

       updateStatus(ctx, `✅ Success\nFound ${result.length} elements\nSelector: ${selector}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
       updateStatus(ctx, `❌ Error\n${message}`);
       ctx.setOutput("result", "[]");
       throw error;
    }
  }
}