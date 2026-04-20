/**
 * Widget 主题 token 模块。
 *
 * @remarks
 * 负责定义基础 Widget 和外部自定义 Widget renderer 共用的主题上下文。
 */

import type { LeaferGraphThemeMode } from "../types";

/**
 * Widget 视觉 token。
 *
 * @remarks
 * 这些 token 尽量保持语义化，而不是绑定某个具体控件实现。
 */
export interface LeaferGraphWidgetThemeTokens {
  /** 默认字体族。 */
  fontFamily: string;
  /** 标签文本颜色。 */
  labelFill: string;
  /** 主要值文本颜色。 */
  valueFill: string;
  /** 次级提示文本颜色。 */
  mutedFill: string;
  /** 禁用态文本颜色。 */
  disabledFill: string;
  /** 普通字段背景色。 */
  fieldFill: string;
  /** 字段 hover 背景色。 */
  fieldHoverFill: string;
  /** 字段 focus / press 背景色。 */
  fieldFocusFill: string;
  /** 普通字段描边色。 */
  fieldStroke: string;
  /** 字段 hover 描边色。 */
  fieldHoverStroke: string;
  /** 字段 focus 描边色。 */
  fieldFocusStroke: string;
  /** 禁用态字段背景色。 */
  fieldDisabledFill: string;
  /** 禁用态字段描边色。 */
  fieldDisabledStroke: string;
  /** 字段默认圆角。 */
  fieldRadius: number;
  /** 字段默认阴影。 */
  fieldShadow: string;
  /** 统一焦点环颜色。 */
  focusRing: string;
  /** 分隔线颜色。 */
  separatorFill: string;
  /** 轨道背景色。 */
  trackFill: string;
  /** 激活区轨道颜色。 */
  trackActiveFill: string;
  /** 滑块或拖拽手柄填充色。 */
  thumbFill: string;
  /** 滑块或拖拽手柄描边色。 */
  thumbStroke: string;
  /** 选项菜单背景色。 */
  menuFill: string;
  /** 选项菜单描边色。 */
  menuStroke: string;
  /** 选项菜单阴影。 */
  menuShadow: string;
  /** 选项菜单主文本颜色。 */
  menuTextFill: string;
  /** 选项菜单次级文本颜色。 */
  menuMutedFill: string;
  /** 选项菜单激活项背景色。 */
  menuActiveFill: string;
  /** 选项菜单激活项文本颜色。 */
  menuActiveTextFill: string;
  /** 危险菜单项背景或强调色。 */
  menuDangerFill: string;
  /** 主按钮背景色。 */
  buttonPrimaryFill: string;
  /** 主按钮 hover 背景色。 */
  buttonPrimaryHoverFill: string;
  /** 次按钮背景色。 */
  buttonSecondaryFill: string;
  /** 次按钮 hover 背景色。 */
  buttonSecondaryHoverFill: string;
  /** ghost 按钮背景色。 */
  buttonGhostFill: string;
  /** ghost 按钮 hover 背景色。 */
  buttonGhostHoverFill: string;
  /** 普通按钮文本颜色。 */
  buttonTextFill: string;
  /** ghost 按钮文本颜色。 */
  buttonGhostTextFill: string;
  /** 无类型强调色时的回退颜色。 */
  accentFallback: string;
}

/**
 * Widget 渲染时可读取的主题上下文。
 */
export interface LeaferGraphWidgetThemeContext {
  /** 当前主题模式。 */
  mode: LeaferGraphThemeMode;
  /** 当前模式下的完整 Widget token。 */
  tokens: LeaferGraphWidgetThemeTokens;
}
