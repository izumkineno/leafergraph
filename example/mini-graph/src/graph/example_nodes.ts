/**
 * 最小执行链 demo 的自定义节点定义。
 *
 * 这里只放两个最小示例节点：
 * 1. `example/counter` 负责递增计数并输出
 * 2. `example/watch` 负责读取输入并回显
 */
import type { NodeDefinition } from "@leafergraph/node";

import {
  EXAMPLE_COUNTER_NODE_TYPE,
  EXAMPLE_WATCH_NODE_TYPE
} from "./example_document";
import { formatRuntimeValue } from "./runtime_feedback_format";

/**
 * 把任意值安全收敛为有限数字。
 *
 * 这里的节点属性来自运行时，理论上可能被外部写入非数字值，
 * 所以统一做一次兜底，避免执行阶段出现 `NaN`。
 */
function normalizeFiniteNumber(value: unknown, fallback: number): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

/**
 * 创建最小计数节点定义。
 *
 * 节点职责非常单纯：
 * - 接收一次开始信号
 * - 把内部 `count` 按 `step` 递增
 * - 把结果通过输出槽继续传给下游
 */
export function createCounterNodeDefinition(): NodeDefinition {
  return {
    type: EXAMPLE_COUNTER_NODE_TYPE,
    title: "Counter",
    description: "最小计数节点，每次运行都会把 count 递增后输出。",
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
      // 每次执行都从当前属性里读最新值，保证 reset 后能重新从 0 开始。
      const step = normalizeFiniteNumber(node.properties.step, 1);
      const current = normalizeFiniteNumber(node.properties.count, 0);
      const nextCount = current + step;

      // 把执行结果同步写回节点属性与标题，便于在画布里直接观察变化。
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
 * 这个节点不做复杂逻辑，只做一件事：
 * 把最近一次输入值格式化后显示到节点标题里。
 */
export function createWatchNodeDefinition(): NodeDefinition {
  return {
    type: EXAMPLE_WATCH_NODE_TYPE,
    title: "Watch",
    description: "最小观察节点，把最近一次输入值回显到标题中。",
    size: [240, 140],
    inputs: [{ name: "Value", type: 0 as const }],
    properties: [
      { name: "preview", type: "string", default: "EMPTY" },
      { name: "status", type: "string", default: "WAITING" }
    ],
    onExecute(node, _context, api) {
      // 读取上游刚刚传播过来的值，并格式化成可读短文本。
      const incoming = api?.getInputData(0);
      const preview = formatRuntimeValue(incoming);

      // 这里同步更新属性和标题，便于在 UI 中同时看到状态和结果。
      node.properties.preview = preview;
      node.properties.status = incoming === undefined ? "WAITING" : "RECEIVED";
      node.title = preview === "EMPTY" ? "Watch" : `Watch ${preview}`;
    }
  };
}
