/**
 * Tauri authority demo 节点定义模块。
 *
 * @remarks
 * 当前只提供两个自定义节点定义：
 * - `example/counter`
 * - `example/watch`
 *
 * 这里的定义主要服务渲染、布局和属性展示；
 * 真正的运行推进由 Rust authority 完成，不在前端本地执行。
 */
import type { NodeDefinition } from "@leafergraph/node";

import {
  EXAMPLE_COUNTER_NODE_TYPE,
  EXAMPLE_WATCH_NODE_TYPE
} from "./demo_seed_document";

/**
 * 创建计数节点定义。
 *
 * @remarks
 * 该节点展示后端 authority 维护的三个关键字段：
 * - `step`
 * - `count`
 * - `note`
 */
export function createCounterNodeDefinition(): NodeDefinition {
  return {
    type: EXAMPLE_COUNTER_NODE_TYPE,
    title: "Counter",
    description: "由后端 authority 推进的最小计数节点。",
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
    ]
  };
}

/**
 * 创建观察节点定义。
 *
 * @remarks
 * 该节点只负责展示后端最近一次推进后的输入结果，
 * 不在前端自行做运行值归并。
 */
export function createWatchNodeDefinition(): NodeDefinition {
  return {
    type: EXAMPLE_WATCH_NODE_TYPE,
    title: "Watch",
    description: "展示 authority 最近一次输出值的最小观察节点。",
    size: [240, 140],
    inputs: [{ name: "Value", type: 0 as const }],
    properties: [
      { name: "preview", type: "string", default: "EMPTY" },
      { name: "status", type: "string", default: "WAITING" }
    ]
  };
}
