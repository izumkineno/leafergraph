import type { LeaferGraphThemeMode } from "../types";

/** Widget 视觉 token。 */
export interface LeaferGraphWidgetThemeTokens {
  fontFamily: string;
  labelFill: string;
  valueFill: string;
  mutedFill: string;
  disabledFill: string;
  fieldFill: string;
  fieldHoverFill: string;
  fieldFocusFill: string;
  fieldStroke: string;
  fieldHoverStroke: string;
  fieldFocusStroke: string;
  fieldDisabledFill: string;
  fieldDisabledStroke: string;
  fieldRadius: number;
  fieldShadow: string;
  focusRing: string;
  separatorFill: string;
  trackFill: string;
  trackActiveFill: string;
  thumbFill: string;
  thumbStroke: string;
  menuFill: string;
  menuStroke: string;
  menuShadow: string;
  menuTextFill: string;
  menuMutedFill: string;
  menuActiveFill: string;
  menuActiveTextFill: string;
  menuDangerFill: string;
  buttonPrimaryFill: string;
  buttonPrimaryHoverFill: string;
  buttonSecondaryFill: string;
  buttonSecondaryHoverFill: string;
  buttonGhostFill: string;
  buttonGhostHoverFill: string;
  buttonTextFill: string;
  buttonGhostTextFill: string;
  accentFallback: string;
}

/** Widget 渲染时可读取的主题上下文。 */
export interface LeaferGraphWidgetThemeContext {
  mode: LeaferGraphThemeMode;
  tokens: LeaferGraphWidgetThemeTokens;
}
