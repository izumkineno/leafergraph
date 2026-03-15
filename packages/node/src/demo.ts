import type { NodeModule } from "./definition";
import type { LeaferGraphData } from "./graph";
import type { NodeSlotSpec, NodeWidgetSpec } from "./types";

// 这组类型只服务当前仓库内的 demo / editor 过渡场景，不再从包根入口导出。

/**
 * Demo 节点输入结构。
 * 这里偏向演示用途，字段比正式 `NodeInit` 更接近页面层数据源。
 */
export interface LeaferGraphNodeData {
  id: string;
  type?: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accent?: string;
  category?: string;
  status?: string;
  inputs?: Array<string | NodeSlotSpec>;
  outputs?: Array<string | NodeSlotSpec>;
  controlLabel?: string;
  controlValue?: string;
  controlProgress?: number;
  properties?: Record<string, unknown>;
  widgets?: NodeWidgetSpec[];
  data?: Record<string, unknown>;
}

/**
 * 主包初始化配置。
 * 当前阶段仍兼容直接传入 `nodes`，同时开始支持正式 `graph` 输入。
 */
export interface LeaferGraphOptions {
  fill?: string;
  nodes?: LeaferGraphNodeData[];
  graph?: LeaferGraphData;
  modules?: NodeModule[];
}
