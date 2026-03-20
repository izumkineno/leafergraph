import type { NodeDefinition } from "@leafergraph/node";

import {
  TEMPLATE_EXECUTE_COUNTER_NODE_LOCAL_TYPE,
  TEMPLATE_NODE_MIN_HEIGHT,
  TEMPLATE_NODE_WIDTH
} from "../shared";

/**
 * 一个最小执行源节点。
 *
 * 这个节点专门用来证明主包最小执行闭环已经接通：
 * 1. editor 菜单可以显式触发 `onExecute(...)`
 * 2. 节点本身会更新标题和状态
 * 3. `setOutputData(...)` 的结果会沿正式连线传播到下游
 */
export const templateExecuteCounterNodeDefinition: NodeDefinition = {
  type: TEMPLATE_EXECUTE_COUNTER_NODE_LOCAL_TYPE,
  title: "Counter Source",
  size: [TEMPLATE_NODE_WIDTH, TEMPLATE_NODE_MIN_HEIGHT],
  resize: {
    enabled: true,
    minWidth: TEMPLATE_NODE_WIDTH,
    minHeight: TEMPLATE_NODE_MIN_HEIGHT,
    snap: 4
  },
  properties: [
    { name: "subtitle", type: "string" },
    { name: "accent", type: "string", default: "#F97316" },
    { name: "status", type: "string", default: "READY" },
    { name: "count", type: "number", default: 0 }
  ],
  inputs: [{ name: "Start", type: "event" }],
  outputs: [{ name: "Count", type: "number" }],
  onExecute(node, _context, api) {
    const prevCount = Number(node.properties.count ?? 0);
    const nextCount = Number.isFinite(prevCount) ? prevCount + 1 : 1;

    node.properties.count = nextCount;
    node.properties.subtitle = "可从节点菜单起跑，也可接到 On Play 作为图级入口";
    node.properties.status = `RUN ${nextCount}`;
    node.title = `Counter ${nextCount}`;
    api?.setOutputData(0, nextCount);
  }
};
