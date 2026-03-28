/**
 * 最小执行链 demo 的文档与种子数据。
 *
 * 这里专门负责提供“恢复默认示例图”所需的数据输入，
 * 不直接创建图实例，也不直接操作运行时。
 */
import type {
  GraphDocument,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput
} from "leafergraph";

/** 自定义计数节点的稳定类型名。 */
export const EXAMPLE_COUNTER_NODE_TYPE = "example/counter";

/** 自定义观察节点的稳定类型名。 */
export const EXAMPLE_WATCH_NODE_TYPE = "example/watch";

/** 创建一份新的空图文档，供初始化与 reset 共用。 */
export function createEmptyExampleDocument(): GraphDocument {
  return {
    documentId: "mini-graph-demo",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [],
    links: []
  };
}

/** 返回默认最小执行链需要恢复的节点集合。 */
export function createExampleSeedNodes(): LeaferGraphCreateNodeInput[] {
  return [
    {
      id: "on-play-1",
      type: "system/on-play",
      title: "On Play",
      x: 120,
      y: 170
    },
    {
      id: "counter-1",
      type: EXAMPLE_COUNTER_NODE_TYPE,
      title: "Counter 0",
      x: 420,
      y: 170,
      properties: {
        step: 1,
        count: 0,
        note: "每次执行会把 count 增加 step"
      }
    },
    {
      id: "watch-1",
      type: EXAMPLE_WATCH_NODE_TYPE,
      title: "Watch",
      x: 720,
      y: 170
    }
  ];
}

/** 返回默认最小执行链需要恢复的连线集合。 */
export function createExampleSeedLinks(): LeaferGraphCreateLinkInput[] {
  return [
    {
      id: "link-play-counter",
      source: { nodeId: "on-play-1", slot: 0 },
      target: { nodeId: "counter-1", slot: 0 }
    },
    {
      id: "link-counter-watch",
      source: { nodeId: "counter-1", slot: 0 },
      target: { nodeId: "watch-1", slot: 0 }
    }
  ];
}
