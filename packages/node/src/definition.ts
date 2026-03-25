/**
 * 节点与模块的正式定义模型。
 *
 * 这些结构描述的是“某类节点具备什么静态能力”，
 * 而不是某个节点实例在当前运行中的状态。
 */

import type { NodeLifecycle } from "./lifecycle.js";
import type { NodePropertySpec, NodeSlotSpec, NodeWidgetSpec } from "./types.js";

/**
 * 节点尺寸调整配置。
 * 它描述的是“这类节点允许如何被 resize”，由宿主在编辑交互中消费。
 */
export interface NodeResizeConfig {
  /** 是否允许宿主为该类节点提供 resize 交互。默认由宿主决定，当前主包回退为 `true`。 */
  enabled?: boolean;
  /** 是否锁定宽高比。 */
  lockRatio?: boolean;
  /** 节点允许缩放到的最小宽度。 */
  minWidth?: number;
  /** 节点允许缩放到的最小高度。 */
  minHeight?: number;
  /** 节点允许缩放到的最大宽度。 */
  maxWidth?: number;
  /** 节点允许缩放到的最大高度。 */
  maxHeight?: number;
  /** 宽高吸附步长。单位仍为图坐标像素。 */
  snap?: number;
}

/**
 * 节点类型定义。
 * 它描述的是“某一类节点”的静态能力，而不是某个节点实例的当前状态。
 */
export interface NodeDefinition extends NodeLifecycle {
  /** 节点类型标识。 */
  type: string;
  /** 默认标题。 */
  title?: string;
  /** 默认分类。 */
  category?: string;
  /** 描述信息。 */
  description?: string;
  /** 搜索与归类关键词。 */
  keywords?: string[];
  /** 默认输入槽位声明。 */
  inputs?: NodeSlotSpec[];
  /** 默认输出槽位声明。 */
  outputs?: NodeSlotSpec[];
  /** 默认属性声明。 */
  properties?: NodePropertySpec[];
  /** 默认 Widget 声明。 */
  widgets?: NodeWidgetSpec[];
  /** 节点默认尺寸。 */
  size?: [number, number];
  /** 节点 resize 约束。建议新代码优先使用该字段。 */
  resize?: NodeResizeConfig;
  /** 兼容旧写法的最小宽度快捷字段。 */
  minWidth?: number;
  /** 兼容旧写法的最小高度快捷字段。 */
  minHeight?: number;
}

/**
 * Widget 类型定义。
 * 当前阶段它主要负责值归一化与序列化，不直接承担绘制。
 */
export interface WidgetDefinition {
  /** Widget 类型标识。 */
  type: string;
  /** Widget 标题。 */
  title?: string;
  /** Widget 描述。 */
  description?: string;
  /** 运行时值归一化钩子。 */
  normalize?(value: unknown, spec?: NodeWidgetSpec): unknown;
  /** 持久化值序列化钩子。 */
  serialize?(value: unknown, spec?: NodeWidgetSpec): unknown;
}

/**
 * 节点模块的包级作用域。
 * 它用于给同一模块内的节点批量补默认命名空间和默认分组。
 */
export interface NodeModuleScope {
  /** 节点类型默认命名空间。 */
  namespace?: string;
  /** 节点默认分组。 */
  group?: string;
}

/**
 * 可被主包批量安装的节点模块。
 * 当前模块只承载节点定义，Widget 需要通过主包单独注册。
 */
export interface NodeModule {
  /** 该模块统一应用的默认作用域。 */
  scope?: NodeModuleScope;
  /** 模块中包含的节点定义。 */
  nodes?: NodeDefinition[];
}
