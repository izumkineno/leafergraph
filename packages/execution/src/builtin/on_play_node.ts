import type { NodeDefinition } from "@leafergraph/node";
import type { LeaferGraphExecutionContext } from "../types.js";

export const LEAFER_GRAPH_ON_PLAY_NODE_TYPE = "system/on-play";

export const leaferGraphOnPlayNodeDefinition: NodeDefinition = {
  type: LEAFER_GRAPH_ON_PLAY_NODE_TYPE,
  title: "On Play",
  category: "System",
  description: "图级 Play / Step 的正式入口节点",
  outputs: [
    {
      name: "Event",
      type: "event",
      label: "Event"
    }
  ],
  onExecute(_node, context, api) {
    const executionContext = context as LeaferGraphExecutionContext | undefined;
    api?.setOutputData(0, executionContext);
  }
};
