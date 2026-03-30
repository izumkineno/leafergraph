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

/** 图级配置。 */
export interface LeaferGraphGraphConfig {
  /** 显式覆盖画布宿主 fill。 */
  fill?: string;
  view?: LeaferGraphGraphViewConfig;
  runtime?: LeaferGraphGraphRuntimeConfig;
}

/** 归一化后的图视图配置。 */
export interface NormalizedLeaferGraphGraphViewConfig {
  defaultFitPadding: number;
}

/** 归一化后的图运行时配置。 */
export interface NormalizedLeaferGraphGraphRuntimeConfig {
  linkPropagationAnimation: "performance" | "balanced" | "expressive" | false;
}

/** 归一化后的图级配置。 */
export interface NormalizedLeaferGraphGraphConfig {
  fill?: string;
  view: NormalizedLeaferGraphGraphViewConfig;
  runtime: NormalizedLeaferGraphGraphRuntimeConfig;
}
