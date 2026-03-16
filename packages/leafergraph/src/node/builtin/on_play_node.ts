import type { NodeDefinition } from "@leafergraph/node";
import type { LeaferGraphExecutionContext } from "../../api/graph_api_types";

/** 图级运行的正式入口节点类型。 */
export const LEAFER_GRAPH_ON_PLAY_NODE_TYPE = "system/on-play";

/**
 * 内建 `OnPlay` 节点定义。
 *
 * @remarks
 * 它只承担一件事：
 * 把当前图级执行上下文写到输出槽位 `0`，让下游正式进入运行链。
 */
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
