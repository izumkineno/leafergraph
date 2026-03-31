/**
 * 图视图层配置。
 *
 * @remarks
 * 这组配置只处理视口或 facade 级的显示行为，
 * 不涉及执行链、画布宿主或 Leafer App 本身的底层选项。
 */
export interface LeaferGraphGraphViewConfig {
  /** `graph.fitView()` 未传参时使用的默认留白。 */
  defaultFitPadding?: number;
}

/**
 * 图运行时行为配置。
 */
export interface LeaferGraphGraphRuntimeConfig {
  /** 连线传播动画预设；`false` 表示关闭动画。 */
  linkPropagationAnimation?:
    | "performance"
    | "balanced"
    | "expressive"
    | false;
}

/**
 * 图历史行为配置。
 */
export interface LeaferGraphGraphHistoryConfig {
  /** 最多保留多少条撤回/重做历史。`0` 表示不保留新历史。 */
  maxEntries?: number;
  /** 整图替换或 diff 同步时是否默认清空历史。 */
  resetOnDocumentSync?: boolean;
}

/**
 * 图级配置入口。
 */
export interface LeaferGraphGraphConfig {
  /** 显式覆盖画布宿主 fill。 */
  fill?: string;
  /** 图视图相关配置。 */
  view?: LeaferGraphGraphViewConfig;
  /** 图运行时行为配置。 */
  runtime?: LeaferGraphGraphRuntimeConfig;
  /** 图历史配置。 */
  history?: LeaferGraphGraphHistoryConfig;
}

/**
 * 归一化后的图视图配置。
 */
export interface NormalizedLeaferGraphGraphViewConfig {
  /** 最终生效的默认 `fitView` 留白。 */
  defaultFitPadding: number;
}

/**
 * 归一化后的图运行时配置。
 */
export interface NormalizedLeaferGraphGraphRuntimeConfig {
  /** 最终生效的连线传播动画预设。 */
  linkPropagationAnimation: "performance" | "balanced" | "expressive" | false;
}

/**
 * 归一化后的图历史配置。
 */
export interface NormalizedLeaferGraphGraphHistoryConfig {
  /** 最终保留的历史条目上限。 */
  maxEntries: number;
  /** 是否在文档同步时自动清空历史。 */
  resetOnDocumentSync: boolean;
}

/**
 * 归一化后的图级配置。
 */
export interface NormalizedLeaferGraphGraphConfig {
  /** 最终生效的画布填充色。 */
  fill?: string;
  /** 已补齐默认值的视图配置。 */
  view: NormalizedLeaferGraphGraphViewConfig;
  /** 已补齐默认值的运行时配置。 */
  runtime: NormalizedLeaferGraphGraphRuntimeConfig;
  /** 已补齐默认值的历史配置。 */
  history: NormalizedLeaferGraphGraphHistoryConfig;
}
