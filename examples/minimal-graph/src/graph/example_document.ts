/**
 * 最小图示例文档与种子数据模块。
 *
 * @remarks
 * 负责提供：
 * - 空图文档工厂
 * - 最小执行链的节点输入
 * - 最小执行链的连线输入
 *
 * 这里不直接操作图实例，只负责提供恢复示例图所需的数据输入。
 */
import type {
  GraphDocument,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput
} from "leafergraph";

/** 最小示例中的计数节点类型。 */
export const EXAMPLE_COUNTER_NODE_TYPE = "example/counter";

/** 最小示例中的观察节点类型。 */
export const EXAMPLE_WATCH_NODE_TYPE = "example/watch";

/** 创建一份新的空图文档，供初始化和 reset 共用。 */
export function createEmptyExampleDocument(): GraphDocument {
  return {
    documentId: "minimal-graph-example",
    revision: 1,
    appKind: "leafergraph-local",
    nodes: [],
    links: []
  };
}

/** 返回恢复最小执行链所需的节点输入集合。 */
export function createExampleSeedNodes(): LeaferGraphCreateNodeInput[] {
  return [
    {
      id: "on-play-1",
      type: "system/on-play",
      title: "On Play",
      x: 120,
      y: 160
    },
    {
      id: "counter-1",
      type: EXAMPLE_COUNTER_NODE_TYPE,
      title: "Counter 0",
      x: 420,
      y: 160,
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
      y: 160
    }
  ];
}

/** 返回恢复最小执行链所需的连线输入集合。 */
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
