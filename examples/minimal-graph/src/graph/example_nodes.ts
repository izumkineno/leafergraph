/**
 * 最小图示例节点定义模块。
 *
 * @remarks
 * 当前只收口两个自定义节点：
 * - `example/counter`
 * - `example/watch`
 *
 * 它们用于演示主包最小执行链，不承担 editor、authority 或 bundle 语义。
 */
import type { NodeDefinition } from "@leafergraph/node";

import {
  EXAMPLE_COUNTER_NODE_TYPE,
  EXAMPLE_WATCH_NODE_TYPE
} from "./example_document";
import { formatRuntimeValue } from "./runtime_feedback_format";

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

/**
 * 创建最小计数节点定义。
 *
 * @remarks
 * 该节点的职责很单纯：
 * - 接收一次开始触发
 * - 把内部 `count` 按 `step` 递增
 * - 向下游输出新的计数结果
 */
export function createCounterNodeDefinition(): NodeDefinition {
  return {
    type: EXAMPLE_COUNTER_NODE_TYPE,
    title: "Counter",
    description: "最小计数节点，每次运行都会把 count 加到下游。",
    size: [240, 140],
    inputs: [{ name: "Start", type: "event" }],
    outputs: [{ name: "Count", type: "number" }],
    properties: [
      { name: "step", type: "number", default: 1 },
      { name: "count", type: "number", default: 0 },
      {
        name: "note",
        type: "string",
        default: "每次执行会把 count 增加 step"
      }
    ],
    onExecute(node, _context, api) {
      const step = normalizeFiniteNumber(node.properties.step, 1);
      const current = normalizeFiniteNumber(node.properties.count, 0);
      const nextCount = current + step;

      node.properties.count = nextCount;
      node.properties.note = `当前输出 ${nextCount}`;
      node.title = `Counter ${nextCount}`;
      api?.setOutputData(0, nextCount);
    }
  };
}

/**
 * 创建最小观察节点定义。
 *
 * @remarks
 * 该节点专门演示“读取上游输入并把值展示回节点标题”这一条最短路径：
 * - 从输入槽位读取最近一次值
 * - 把值格式化成短文本
 * - 把结果写回 `preview / status / title`
 */
export function createWatchNodeDefinition(): NodeDefinition {
  return {
    type: EXAMPLE_WATCH_NODE_TYPE,
    title: "Watch",
    description: "观察最近一次输入值的最小展示节点。",
    size: [240, 140],
    inputs: [{ name: "Value", type: 0 as const }],
    properties: [
      { name: "preview", type: "string", default: "EMPTY" },
      { name: "status", type: "string", default: "WAITING" }
    ],
    onExecute(node, _context, api) {
      const incoming = api?.getInputData(0);
      const preview = formatRuntimeValue(incoming);

      node.properties.preview = preview;
      node.properties.status = incoming === undefined ? "WAITING" : "RECEIVED";
      node.title = preview === "EMPTY" ? "Watch" : `Watch ${preview}`;
    }
  };
}
