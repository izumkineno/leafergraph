/**
 * 系统节点入口模块。
 *
 * @remarks
 * 负责暴露默认系统节点定义和最小节点模块工厂。
 */

import type { NodeModule } from "@leafergraph/core/node";
export {
  LEAFER_GRAPH_ON_PLAY_NODE_TYPE,
  leaferGraphOnPlayNodeDefinition
} from "@leafergraph/core/execution";
export {
  LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS,
  LEAFER_GRAPH_TIMER_NODE_TYPE,
  leaferGraphTimerNodeDefinition
} from "@leafergraph/core/execution";
export type {
  LeaferGraphTimerRegistration,
  LeaferGraphTimerRuntimePayload
} from "@leafergraph/core/execution";
import {
  leaferGraphOnPlayNodeDefinition,
  leaferGraphTimerNodeDefinition
} from "@leafergraph/core/execution";

/**
 * 创建默认系统节点模块。
 *
 * @remarks
 * 当前固定只包含 basic-kit 默认提供的两个系统节点：
 * - `system/on-play`
 * - `system/timer`
 *
 * @returns 创建后的结果对象。
 */
export function createBasicSystemNodeModule(): NodeModule {
  return {
    nodes: [leaferGraphOnPlayNodeDefinition, leaferGraphTimerNodeDefinition]
  };
}
