/**
 * `@leafergraph/core/config` 的 Leafer 宿主配置模块。
 *
 * @remarks
 * 负责定义 `leafergraph` 主包向 Leafer App、Viewport 和官方插件透传的配置结构，
 * 以及各段配置在 normalize 之后的最终形态。
 */

import type { IAppConfig, IEditorConfig, ILeaferConfig } from "leafer-ui";

/**
 * 视口滚轮平移模式。
 *
 * @remarks
 * 该值直接影响鼠标滚轮在画布上的平移行为，
 * 可用于限制只沿某一轴滚动，或启用 Leafer 内建的 limit 语义。
 */
export type LeaferGraphLeaferMoveScrollMode =
  | boolean
  | "x"
  | "y"
  | "limit"
  | "x-limit"
  | "y-limit";

/**
 * Leafer App 配置。
 */
export interface LeaferGraphLeaferAppConfig {
  /** 是否启用像素吸附。 */
  pixelSnap?: boolean;
  /** 是否启用局部渲染优化。 */
  usePartRender?: boolean;
  /** 是否启用局部布局优化。 */
  usePartLayout?: boolean;
  /** 直接透传给 Leafer App 的原始配置。 */
  raw?: Partial<IAppConfig>;
}

/**
 * Leafer 树配置。
 */
export interface LeaferGraphLeaferTreeConfig {
  /** 直接透传给 Leafer 树宿主的原始配置。 */
  raw?: Partial<ILeaferConfig>;
}

/**
 * 视口缩放配置。
 */
export interface LeaferGraphLeaferViewportZoomConfig {
  /** 允许缩放到的最小比例。 */
  min?: number;
  /** 允许缩放到的最大比例。 */
  max?: number;
}

/**
 * 视口平移配置。
 */
export interface LeaferGraphLeaferViewportMoveConfig {
  /** 是否需要按住空格键才允许拖动画布。 */
  holdSpaceKey?: boolean;
  /** 是否需要按住中键才允许拖动画布。 */
  holdMiddleKey?: boolean;
  /** 鼠标滚轮滚动时的平移模式。 */
  scroll?: LeaferGraphLeaferMoveScrollMode;
}

/**
 * Leafer 视口配置。
 */
export interface LeaferGraphLeaferViewportConfig {
  /** 缩放配置。 */
  zoom?: LeaferGraphLeaferViewportZoomConfig;
  /** 平移配置。 */
  move?: LeaferGraphLeaferViewportMoveConfig;
  /** 直接透传给 Leafer Viewport 的原始配置。 */
  raw?: Partial<ILeaferConfig>;
}

/**
 * Leafer 视图配置。
 */
export interface LeaferGraphLeaferViewConfig {
  /** 默认视图适配留白。 */
  fitPadding?: number;
  /** 预留给 Leafer view 的原始扩展配置。 */
  raw?: Record<string, unknown>;
}

/**
 * Leafer Editor 配置。
 */
export interface LeaferGraphLeaferEditorConfig {
  /** 直接透传给官方 Editor 插件的原始配置。 */
  raw?: Partial<IEditorConfig>;
}

/**
 * Leafer 文本编辑器配置。
 */
export interface LeaferGraphLeaferTextEditorConfig {
  /** 是否启用官方文本编辑器实现。 */
  useOfficialTextEditor?: boolean;
  /** 预留给文本编辑器插件的原始扩展配置。 */
  raw?: Record<string, unknown>;
}

/**
 * 官方插件透传配置。
 */
export interface LeaferGraphLeaferPluginConfig {
  /** 原样透传给官方插件的扩展配置。 */
  raw?: Record<string, unknown>;
}

/**
 * Leafer 相关总配置。
 */
export interface LeaferGraphLeaferConfig {
  /** App 层配置。 */
  app?: LeaferGraphLeaferAppConfig;
  /** 树结构配置。 */
  tree?: LeaferGraphLeaferTreeConfig;
  /** Viewport 配置。 */
  viewport?: LeaferGraphLeaferViewportConfig;
  /** View 配置。 */
  view?: LeaferGraphLeaferViewConfig;
  /** Editor 插件配置。 */
  editor?: LeaferGraphLeaferEditorConfig;
  /** 文本编辑器配置。 */
  textEditor?: LeaferGraphLeaferTextEditorConfig;
}

/**
 * 归一化后的 Leafer App 配置。
 */
export interface NormalizedLeaferGraphLeaferAppConfig {
  /** 最终是否启用像素吸附。 */
  pixelSnap: boolean;
  /** 最终是否启用局部渲染优化。 */
  usePartRender: boolean;
  /** 最终是否启用局部布局优化。 */
  usePartLayout: boolean;
  /** 透传给 Leafer App 的原始配置。 */
  raw?: Partial<IAppConfig>;
}

/**
 * 归一化后的 Leafer 树配置。
 */
export interface NormalizedLeaferGraphLeaferTreeConfig {
  /** 透传给 Leafer 树宿主的原始配置。 */
  raw?: Partial<ILeaferConfig>;
}

/**
 * 归一化后的视口缩放配置。
 */
export interface NormalizedLeaferGraphLeaferViewportZoomConfig {
  /** 最终生效的最小缩放比例。 */
  min: number;
  /** 最终生效的最大缩放比例。 */
  max: number;
}

/**
 * 归一化后的视口平移配置。
 */
export interface NormalizedLeaferGraphLeaferViewportMoveConfig {
  /** 最终是否要求按住空格键拖动画布。 */
  holdSpaceKey: boolean;
  /** 最终是否要求按住中键拖动画布。 */
  holdMiddleKey: boolean;
  /** 最终生效的滚轮平移模式。 */
  scroll: LeaferGraphLeaferMoveScrollMode;
}

/**
 * 归一化后的 Leafer 视口配置。
 */
export interface NormalizedLeaferGraphLeaferViewportConfig {
  /** 已补齐默认值的缩放配置。 */
  zoom: NormalizedLeaferGraphLeaferViewportZoomConfig;
  /** 已补齐默认值的平移配置。 */
  move: NormalizedLeaferGraphLeaferViewportMoveConfig;
  /** 透传给 Leafer Viewport 的原始配置。 */
  raw?: Partial<ILeaferConfig>;
}

/**
 * 归一化后的 Leafer 视图配置。
 */
export interface NormalizedLeaferGraphLeaferViewConfig {
  /** 最终生效的视图适配留白。 */
  fitPadding: number;
  /** 预留给 Leafer view 的原始扩展配置。 */
  raw?: Record<string, unknown>;
}

/**
 * 归一化后的 Leafer Editor 配置。
 */
export interface NormalizedLeaferGraphLeaferEditorConfig {
  /** 透传给官方 Editor 插件的原始配置。 */
  raw?: Partial<IEditorConfig>;
}

/**
 * 归一化后的 Leafer 文本编辑器配置。
 */
export interface NormalizedLeaferGraphLeaferTextEditorConfig {
  /** 最终是否启用官方文本编辑器。 */
  useOfficialTextEditor: boolean;
  /** 预留给文本编辑器插件的原始扩展配置。 */
  raw?: Record<string, unknown>;
}

/**
 * 归一化后的官方插件透传配置。
 */
export interface NormalizedLeaferGraphLeaferPluginConfig {
  /** 原样透传给官方插件的扩展配置。 */
  raw?: Record<string, unknown>;
}

/**
 * 归一化后的 Leafer 总配置。
 */
export interface NormalizedLeaferGraphLeaferConfig {
  /** 已补齐默认值的 App 配置。 */
  app: NormalizedLeaferGraphLeaferAppConfig;
  /** 已补齐默认值的树配置。 */
  tree: NormalizedLeaferGraphLeaferTreeConfig;
  /** 已补齐默认值的 Viewport 配置。 */
  viewport: NormalizedLeaferGraphLeaferViewportConfig;
  /** 已补齐默认值的视图配置。 */
  view: NormalizedLeaferGraphLeaferViewConfig;
  /** 已补齐默认值的 Editor 配置。 */
  editor: NormalizedLeaferGraphLeaferEditorConfig;
  /** 已补齐默认值的文本编辑器配置。 */
  textEditor: NormalizedLeaferGraphLeaferTextEditorConfig;
}
