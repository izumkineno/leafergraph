import type { NodeModule } from "./definition.js";
import type { GraphDocument } from "./graph.js";
import type { NodeSlotSpec, NodeWidgetSpec } from "./types.js";

// 这组类型只服务当前仓库内的 demo / editor 过渡场景，不再从包根入口导出。

/**
 * Demo 节点输入结构。
 * 这里偏向演示用途，字段比正式 `NodeInit` 更接近页面层数据源。
 */
export interface LeaferGraphDemoNodeInput {
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
 * 内部演示初始化输入。
 *
 * @remarks
 * 这里只保留给 demo / editor 过渡逻辑使用，
 * 不应再被当成主包长期公共配置语义。
 */
export interface LeaferGraphDemoInputOptions {
  fill?: string;
  nodes?: LeaferGraphDemoNodeInput[];
  document?: GraphDocument;
  modules?: NodeModule[];
}
