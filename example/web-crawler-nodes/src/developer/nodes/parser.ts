import {
  BaseNode,
  type DevNodeContext,
  type NodeInputs,
  type NodeOutputs,
  type NodeProps,
  type NodeState
} from "@leafergraph/extensions/authoring";
import { readWidgetString, updateStatus } from "../shared";
import {
  WEB_CRAWLER_PARSER_DEFAULT_SELECTOR,
  WEB_CRAWLER_PARSER_META
} from "../../shared/node_meta";

export class ParserNode extends BaseNode<
  NodeProps,
  NodeInputs,
  NodeOutputs,
  NodeState
> {
  static meta = WEB_CRAWLER_PARSER_META;

  createState(): NodeState {
    return {
      lastResult: [] as string[],
      lastCount: 0
    };
  }

  onExecute(
    ctx: DevNodeContext<NodeProps, NodeInputs, NodeOutputs, NodeState>
  ): void {
    const domStr = ctx.getInput("dom") as string;
    if (!domStr) {
      updateStatus(ctx, "⚠️ No input DOM provided");
      ctx.setOutput("result", "[]");
      return;
    }

    const selector = readWidgetString(
      ctx,
      "selector",
      WEB_CRAWLER_PARSER_DEFAULT_SELECTOR
    );
    ctx.setProp("selector", selector);

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(domStr, "text/html");
      const elements = doc.querySelectorAll(selector);
      const result: string[] = [];
      elements.forEach((element) => {
        result.push(element.innerHTML.trim());
      });

      const resultStr = JSON.stringify(result, null, 2);
      ctx.setData("lastResult", result);
      ctx.setData("lastCount", result.length);
      ctx.setOutput("result", resultStr);
      updateStatus(
        ctx,
        `✅ Success\nFound ${result.length} elements\nSelector: ${selector}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateStatus(ctx, `❌ Error\n${message}`);
      ctx.setOutput("result", "[]");
      throw error;
    }
  }
}
