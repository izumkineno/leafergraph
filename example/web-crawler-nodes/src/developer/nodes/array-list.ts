import {
  BaseNode,
  type DevNodeContext,
  type NodeInputs,
  type NodeOutputs,
  type NodeProps,
  type NodeState
} from "@leafergraph/authoring";
import { WEB_CRAWLER_ARRAY_LIST_META } from "../../shared/node_meta";

export class ArrayListNode extends BaseNode<
  NodeProps,
  NodeInputs,
  NodeOutputs,
  NodeState
> {
  static meta = WEB_CRAWLER_ARRAY_LIST_META;

  createState(): NodeState {
    return {
      lastArray: [] as string[],
      lastLength: 0
    };
  }

  onExecute(
    ctx: DevNodeContext<NodeProps, NodeInputs, NodeOutputs, NodeState>
  ): void {
    const input = ctx.getInput("input");

    let displayText = "No data";
    let array: string[] = [];

    if (Array.isArray(input)) {
      array = input.map((item) => String(item));
      ctx.setData("lastArray", array);
      ctx.setData("lastLength", array.length);

      if (array.length === 0) {
        displayText = "Empty array";
      } else {
        displayText = array
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n");
      }
    } else if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          array = parsed.map((item) => String(item));
          ctx.setData("lastArray", array);
          ctx.setData("lastLength", array.length);

          if (array.length === 0) {
            displayText = "Empty array";
          } else {
            displayText = array
              .map((item, index) => `${index + 1}. ${item}`)
              .join("\n");
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
