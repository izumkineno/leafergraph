/**
 * LeaferGraph 主题系统的基础类型模块。
 *
 * @remarks
 * 负责定义主题模式、主题 preset 标识和连线传播动画预设，
 * 供图主题、Widget 主题和运行时配置共同复用。
 */

/**
 * LeaferGraph 当前支持的主题模式。
 *
 * @remarks
 * 当前主题系统统一以亮色和暗色两套模式为基础，
 * 更细粒度的视觉差异由 theme preset 继续向下分发。
 */
export type LeaferGraphThemeMode = "light" | "dark";

/**
 * 主题 preset 的稳定标识。
 */
export type LeaferGraphThemePresetId = string;

/**
 * 连线传播动画预设。
 *
 * @remarks
 * 这组值主要平衡视觉表现和运行时成本，
 * 供图主题和运行时配置共同引用。
 */
export type LeaferGraphLinkPropagationAnimationPreset =
  | "performance"
  | "balanced"
  | "expressive";
