import type { NodeDefinition } from "@leafergraph/node";

import {
  TEMPLATE_EXECUTE_DISPLAY_NODE_LOCAL_TYPE,
  TEMPLATE_NODE_MIN_HEIGHT,
  TEMPLATE_NODE_WIDTH
} from "../shared";

/**
 * 一个最小执行下游节点。
 *
 * 它只做两件事：
 * 1. 从 `getInputData(0)` 读取传播过来的输入
 * 2. 把读取结果写回标题和状态，方便在 editor 里直接观察
 */
export const templateExecuteDisplayNodeDefinition: NodeDefinition = {
  type: TEMPLATE_EXECUTE_DISPLAY_NODE_LOCAL_TYPE,
  title: "Display",
  size: [TEMPLATE_NODE_WIDTH, TEMPLATE_NODE_MIN_HEIGHT],
  resize: {
    enabled: true,
    minWidth: TEMPLATE_NODE_WIDTH,
    minHeight: TEMPLATE_NODE_MIN_HEIGHT,
    snap: 4
  },
  properties: [
    { name: "subtitle", type: "string" },
    { name: "accent", type: "string", default: "#0EA5E9" },
    { name: "status", type: "string", default: "WAITING" },
    { name: "lastValue", type: "number" }
  ],
  inputs: [{ name: "Value", type: "number" }],
  onExecute(node, _context, api) {
    const inputValue = api?.getInputData(0);
    const displayValue =
      typeof inputValue === "number" && Number.isFinite(inputValue)
        ? String(inputValue)
        : inputValue === undefined
          ? "EMPTY"
          : String(inputValue);

    node.properties.lastValue = inputValue;
    node.properties.subtitle = "显示上游通过正式连线传播过来的值";
    node.properties.status = `VALUE ${displayValue}`;
    node.title = `Display ${displayValue}`;
  }
};
