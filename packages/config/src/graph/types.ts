/** 图视图层的最小配置。 */
export interface LeaferGraphGraphViewConfig {
  /** `graph.fitView()` 未传参时使用的默认留白。 */
  defaultFitPadding?: number;
}

/** 图运行时行为配置。 */
export interface LeaferGraphGraphRuntimeConfig {
  /** 连线传播动画预设；`false` 表示关闭动画。 */
  linkPropagationAnimation?:
    | "performance"
    | "balanced"
    | "expressive"
    | false;
}

/** 图历史行为配置。 */
export interface LeaferGraphGraphHistoryConfig {
  /** 最多保留多少条撤回/重做历史。`0` 表示不保留新历史。 */
  maxEntries?: number;
  /** 整图替换或 diff 同步时是否默认清空历史。 */
  resetOnDocumentSync?: boolean;
}

/** 图级配置。 */
export interface LeaferGraphGraphConfig {
  /** 显式覆盖画布宿主 fill。 */
  fill?: string;
  view?: LeaferGraphGraphViewConfig;
  runtime?: LeaferGraphGraphRuntimeConfig;
  history?: LeaferGraphGraphHistoryConfig;
}

/** 归一化后的图视图配置。 */
export interface NormalizedLeaferGraphGraphViewConfig {
  defaultFitPadding: number;
}

/** 归一化后的图运行时配置。 */
export interface NormalizedLeaferGraphGraphRuntimeConfig {
  linkPropagationAnimation: "performance" | "balanced" | "expressive" | false;
}

/** 归一化后的图历史配置。 */
export interface NormalizedLeaferGraphGraphHistoryConfig {
  maxEntries: number;
  resetOnDocumentSync: boolean;
}

/** 归一化后的图级配置。 */
export interface NormalizedLeaferGraphGraphConfig {
  fill?: string;
  view: NormalizedLeaferGraphGraphViewConfig;
  runtime: NormalizedLeaferGraphGraphRuntimeConfig;
  history: NormalizedLeaferGraphGraphHistoryConfig;
}
