import type { NodeLifecycle } from "./lifecycle";
import type { NodePropertySpec, NodeSlotSpec, NodeWidgetSpec } from "./types";

/**
 * 节点类型定义。
 * 它描述的是“某一类节点”的静态能力，而不是某个节点实例的当前状态。
 */
export interface NodeDefinition extends NodeLifecycle {
  type: string;
  title?: string;
  category?: string;
  description?: string;
  keywords?: string[];
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  properties?: NodePropertySpec[];
  widgets?: NodeWidgetSpec[];
  size?: [number, number];
  minWidth?: number;
  minHeight?: number;
}

/**
 * Widget 类型定义。
 * 当前阶段它主要负责值归一化与序列化，不直接承担绘制。
 */
export interface WidgetDefinition {
  type: string;
  title?: string;
  description?: string;
  normalize?(value: unknown, spec?: NodeWidgetSpec): unknown;
  serialize?(value: unknown, spec?: NodeWidgetSpec): unknown;
}

/**
 * 节点模块的包级作用域。
 * 它用于给同一模块内的节点批量补默认命名空间和默认分组。
 */
export interface NodeModuleScope {
  namespace?: string;
  group?: string;
}

/**
 * 可被主包批量安装的节点模块。
 */
export interface NodeModule {
  scope?: NodeModuleScope;
  nodes?: NodeDefinition[];
  widgets?: WidgetDefinition[];
}
