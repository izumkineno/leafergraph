import type { NodeDefinition } from "@leafergraph/node";
import type { LeaferGraphExecutionContext } from "../types.js";

export const LEAFER_GRAPH_ON_PLAY_NODE_TYPE = "system/on-play";

export const leaferGraphOnPlayNodeDefinition: NodeDefinition = {
  type: LEAFER_GRAPH_ON_PLAY_NODE_TYPE,
  title: "Start Event",
  category: "System",
  description: "图级 Play / Step 的启动事件源",
  outputs: [
    {
      name: "Start",
      type: "event",
      label: "Start",
      shape: "box"
    }
  ],
  onExecute(_node, context, api) {
    const executionContext = context as LeaferGraphExecutionContext | undefined;
    api?.setOutputData(0, executionContext);
  }
};
