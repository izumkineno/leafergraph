/**
 * `@leafergraph/core/config` 根配置类型模块。
 *
 * @remarks
 * 负责把图运行时、Widget 宿主和 Leafer 宿主的子配置收口成统一入口，
 * 供 `leafergraph` 主包和外部宿主在初始化阶段直接消费。
 */

import type {
  LeaferGraphGraphConfig,
  NormalizedLeaferGraphGraphConfig
} from "./graph";
import type {
  LeaferGraphWidgetConfig,
  NormalizedLeaferGraphWidgetConfig
} from "./widget";
import type {
  LeaferGraphLeaferConfig,
  NormalizedLeaferGraphLeaferConfig
} from "./leafer";

/**
 * LeaferGraph 主包的正式配置入口。
 *
 * @remarks
 * 这份结构只表达“调用方可以覆写哪些配置段”，
 * 不承担默认值补齐职责；默认值由各子模块的 normalize 流程完成。
 */
export interface LeaferGraphConfig {
  /** 图视图、执行和历史相关配置。 */
  graph?: LeaferGraphGraphConfig;
  /** Widget 编辑和交互相关配置。 */
  widget?: LeaferGraphWidgetConfig;
  /** Leafer App、Viewport 和官方插件透传配置。 */
  leafer?: LeaferGraphLeaferConfig;
}

/**
 * 主包归一化后的完整配置。
 *
 * @remarks
 * 进入运行时装配阶段后，主包统一只消费这份结构，
 * 因此所有可选字段都会在这里被折叠成稳定的最终值。
 */
export interface NormalizedLeaferGraphConfig {
  /** 已补齐默认值的图配置。 */
  graph: NormalizedLeaferGraphGraphConfig;
  /** 已补齐默认值的 Widget 配置。 */
  widget: NormalizedLeaferGraphWidgetConfig;
  /** 已补齐默认值的 Leafer 宿主配置。 */
  leafer: NormalizedLeaferGraphLeaferConfig;
}
