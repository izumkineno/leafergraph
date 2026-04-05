import { BaseNode, type DevNodeContext, type NodeProps, type NodeInputs, type NodeOutputs, type NodeState } from "@leafergraph/authoring";
import {
  WEB_CRAWLER_ARRAY_LIST_TYPE,
  WEB_CRAWLER_NODES_DEFAULT_WIDTH,
  WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT
} from "../shared";

/**
 * 数组列表节点：将输入数组转为列表显示在Widget上
 * 输入: 数组字符串（每个元素是string）
 * 输出: 无输出
 * Widget: 列表显示（多行文本框）
 */
export class ArrayListNode extends BaseNode<NodeProps, NodeInputs, NodeOutputs, NodeState> {
  static meta = {
    type: WEB_CRAWLER_ARRAY_LIST_TYPE,
    title: "Array List",
    category: "Web Crawler",
    description: "Display array as list on node",
    inputs: [
      { name: "input", type: "any", optional: false }
    ],
    outputs: [],
    widgets: [
      {
        type: "textarea",
        name: "content",
        value: "No data",
        options: {
          label: "Content",
          rows: 8,
          readonly: true
        }
      }
    ],
    size: [
      WEB_CRAWLER_NODES_DEFAULT_WIDTH + 40,
      WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT + 60
    ] as [number, number],
    resize: {
      minWidth: WEB_CRAWLER_NODES_DEFAULT_WIDTH,
      minHeight: WEB_CRAWLER_NODES_DEFAULT_MIN_HEIGHT + 30
    }
  };

  createState(): NodeState {
    return {
      lastArray: [] as string[],
      lastLength: 0
    };
  }

  onExecute(ctx: DevNodeContext<NodeProps, NodeInputs, NodeOutputs, NodeState>) {
    const input = ctx.getInput("input");
    
    let displayText = "No data";
    let array: string[] = [];

    if (Array.isArray(input)) {
      array = input.map(item => String(item));
      ctx.setData("lastArray", array);
      ctx.setData("lastLength", array.length);
      
      if (array.length === 0) {
        displayText = "Empty array";
      } else {
        displayText = array.map((item, index) => {
          return `${index + 1}. ${item}`;
        }).join("\n");
      }
    } else if (typeof input === "string") {
      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          array = parsed.map(item => String(item));
          ctx.setData("lastArray", array);
          ctx.setData("lastLength", array.length);
          
        if (array.length === 0) {
          displayText = "Empty array";
        } else {
          displayText = array.map((item, index) => {
            return `${index + 1}. ${item}`;
          }).join("\n");
        }
        } else {
          displayText = input;
        }
      } catch {
        displayText = input;
      }
    } else if (input == null) {
      displayText = "No input";
    } else {
      displayText = JSON.stringify(input, null, 2);
    }

    ctx.setWidget("content", displayText);
  }
}