import type { LeaferGraphLinkPropagationAnimationPreset } from "../types";

/** 节点壳布局所需的全部度量参数。 */
export interface NodeShellLayoutMetrics {
  defaultNodeWidth: number;
  defaultNodeMinHeight: number;
  headerHeight: number;
  sectionPaddingX: number;
  sectionPaddingY: number;
  slotRowHeight: number;
  slotRowGap: number;
  portSize: number;
  widgetHeight: number;
  widgetGap: number;
  widgetPaddingY: number;
  categoryPillHeight: number;
  categoryPillMinWidth: number;
  categoryCharWidth: number;
  slotTextWidth: number;
}

/** 节点壳渲染需要的样式主题。 */
export interface NodeShellRenderTheme {
  nodeRadius: number;
  headerHeight: number;
  selectedRingOutset: number;
  selectedRingStrokeWidth: number;
  selectedRingOpacity: number;
  resizeHandleFill: string;
  resizeHandleStroke: string;
  resizeHandleStrokeWidth: number;
  cardFill: string;
  cardStroke: string;
  headerFill: string;
  headerDividerFill: string;
  titleFill: string;
  titleFontFamily: string;
  titleFontSize: number;
  titleFontWeight: string;
  titleX: number;
  titleY: number;
  categoryFill: string;
  categoryStroke: string;
  categoryTextFill: string;
  categoryFontFamily: string;
  categoryFontSize: number;
  categoryFontWeight: string;
  errorBadgeFill: string;
  errorBadgeStroke: string;
  errorBadgeTextFill: string;
  signalGlowX: number;
  signalGlowY: number;
  signalGlowSize: number;
  signalGlowOpacity: number;
  signalLightX: number;
  signalLightY: number;
  signalLightSize: number;
  signalHitPadding: number;
  widgetFill: string;
  inputPortFill: string;
  outputPortFill: string;
  portStroke: string;
  portStrokeWidth: number;
  slotLabelFill: string;
  slotLabelFontFamily: string;
  slotLabelFontSize: number;
  slotLabelFontWeight: string;
}

/** 节点壳样式配置。 */
export interface LeaferGraphNodeShellStyleConfig {
  defaultNodeWidth: number;
  defaultNodeMinHeight: number;
  nodeRadius: number;
  nodeFontFamily: string;
  selectedRingOutset: number;
  selectedRingStrokeWidth: number;
  missingNodeFill: string;
  missingNodeStroke: string;
  missingNodeTextFill: string;
  inputPortFill: string;
  outputPortFill: string;
  genericPortFill: string;
  signalFill: string;
  signalRunningFill: string;
  signalSuccessFill: string;
  signalErrorFill: string;
  slotTypeFillMap: Readonly<Record<string, string>>;
}

/** 数据流传输动画样式配置。 */
export interface LeaferGraphDataFlowAnimationStyleConfig {
  enabled: boolean;
  preset: LeaferGraphLinkPropagationAnimationPreset;
  pulseDurationMs: number;
  pulseDarkOpacity: number;
  pulseLightOpacity: number;
  pulseBaseStrokeWidth: number;
  pulseExtraStrokeWidth: number;
  maxPulses: number;
  particleSize: number;
  glowSize: number;
  durationMs: number;
  coreOpacity: number;
  darkGlowOpacity: number;
  lightGlowOpacity: number;
  fadeInRatio: number;
  fadeOutRatio: number;
  maxParticles: number;
}

/** graph 主题 bundle。 */
export interface LeaferGraphGraphThemeTokens {
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  nodeShellStyle: LeaferGraphNodeShellStyleConfig;
  nodeShellRenderTheme: NodeShellRenderTheme;
  canvasBackground: string;
  selectedStroke: string;
  linkStroke: string;
  dataFlowAnimationStyles: Readonly<
    Record<
      LeaferGraphLinkPropagationAnimationPreset,
      LeaferGraphDataFlowAnimationStyleConfig
    >
  >;
}
