/**
 * 图节点和连线主题 token 模块。
 *
 * @remarks
 * 负责定义节点壳布局、渲染主题、数据流动画样式和整张图的视觉 token。
 */

import type { LeaferGraphLinkPropagationAnimationPreset } from "../types";

/**
 * 节点壳布局所需的全部度量参数。
 */
export interface NodeShellLayoutMetrics {
  /** 默认节点宽度。 */
  defaultNodeWidth: number;
  /** 默认节点最小高度。 */
  defaultNodeMinHeight: number;
  /** 标题栏高度。 */
  headerHeight: number;
  /** 各分区横向内边距。 */
  sectionPaddingX: number;
  /** 各分区纵向内边距。 */
  sectionPaddingY: number;
  /** 单个槽位行高度。 */
  slotRowHeight: number;
  /** 槽位行之间的纵向间距。 */
  slotRowGap: number;
  /** 端口视觉尺寸。 */
  portSize: number;
  /** 单个 Widget 默认高度。 */
  widgetHeight: number;
  /** Widget 之间的纵向间距。 */
  widgetGap: number;
  /** Widget 区域上下补白。 */
  widgetPaddingY: number;
  /** 分类标签高度。 */
  categoryPillHeight: number;
  /** 分类标签最小宽度。 */
  categoryPillMinWidth: number;
  /** 分类标签估算字符宽度。 */
  categoryCharWidth: number;
  /** 槽位标签估算文本宽度。 */
  slotTextWidth: number;
}

/**
 * 节点壳渲染需要的样式主题。
 */
export interface NodeShellRenderTheme {
  /** 节点卡片圆角。 */
  nodeRadius: number;
  /** 节点标题栏高度。 */
  headerHeight: number;
  /** 选中外环向外扩张距离。 */
  selectedRingOutset: number;
  /** 选中外环描边宽度。 */
  selectedRingStrokeWidth: number;
  /** 选中外环透明度。 */
  selectedRingOpacity: number;
  /** resize 句柄填充色。 */
  resizeHandleFill: string;
  /** resize 句柄描边色。 */
  resizeHandleStroke: string;
  /** resize 句柄描边宽度。 */
  resizeHandleStrokeWidth: number;
  /** 节点卡片背景色。 */
  cardFill: string;
  /** 节点卡片描边色。 */
  cardStroke: string;
  /** 标题栏背景色。 */
  headerFill: string;
  /** 标题栏分隔线颜色。 */
  headerDividerFill: string;
  /** 标题文本颜色。 */
  titleFill: string;
  /** 标题字体族。 */
  titleFontFamily: string;
  /** 标题字号。 */
  titleFontSize: number;
  /** 标题字重。 */
  titleFontWeight: string;
  /** 标题横向偏移。 */
  titleX: number;
  /** 标题纵向偏移。 */
  titleY: number;
  /** 分类标签背景色。 */
  categoryFill: string;
  /** 分类标签描边色。 */
  categoryStroke: string;
  /** 分类标签文本颜色。 */
  categoryTextFill: string;
  /** 分类标签字体族。 */
  categoryFontFamily: string;
  /** 分类标签字号。 */
  categoryFontSize: number;
  /** 分类标签字重。 */
  categoryFontWeight: string;
  /** 错误徽标背景色。 */
  errorBadgeFill: string;
  /** 错误徽标描边色。 */
  errorBadgeStroke: string;
  /** 错误徽标文本颜色。 */
  errorBadgeTextFill: string;
  /** 运行态 glow 的 X 坐标。 */
  signalGlowX: number;
  /** 运行态 glow 的 Y 坐标。 */
  signalGlowY: number;
  /** 运行态 glow 的尺寸。 */
  signalGlowSize: number;
  /** 运行态 glow 的透明度。 */
  signalGlowOpacity: number;
  /** 状态灯核心的 X 坐标。 */
  signalLightX: number;
  /** 状态灯核心的 Y 坐标。 */
  signalLightY: number;
  /** 状态灯核心尺寸。 */
  signalLightSize: number;
  /** 状态灯可点击热区的额外补白。 */
  signalHitPadding: number;
  /** Widget 区域默认填充色。 */
  widgetFill: string;
  /** 输入端口默认填充色。 */
  inputPortFill: string;
  /** 输出端口默认填充色。 */
  outputPortFill: string;
  /** 端口描边色。 */
  portStroke: string;
  /** 端口描边宽度。 */
  portStrokeWidth: number;
  /** 槽位标签文本颜色。 */
  slotLabelFill: string;
  /** 槽位标签字体族。 */
  slotLabelFontFamily: string;
  /** 槽位标签字号。 */
  slotLabelFontSize: number;
  /** 槽位标签字重。 */
  slotLabelFontWeight: string;
}

/**
 * 节点壳样式配置。
 */
export interface LeaferGraphNodeShellStyleConfig {
  /** 默认节点宽度。 */
  defaultNodeWidth: number;
  /** 默认节点最小高度。 */
  defaultNodeMinHeight: number;
  /** 节点卡片圆角。 */
  nodeRadius: number;
  /** 节点默认字体族。 */
  nodeFontFamily: string;
  /** 选中外环外扩距离。 */
  selectedRingOutset: number;
  /** 选中外环描边宽度。 */
  selectedRingStrokeWidth: number;
  /** 缺失节点类型时的背景色。 */
  missingNodeFill: string;
  /** 缺失节点类型时的描边色。 */
  missingNodeStroke: string;
  /** 缺失节点类型时的文本颜色。 */
  missingNodeTextFill: string;
  /** 输入端口默认填充色。 */
  inputPortFill: string;
  /** 输出端口默认填充色。 */
  outputPortFill: string;
  /** 未知槽位类型的回退端口颜色。 */
  genericPortFill: string;
  /** 空闲状态灯颜色。 */
  signalFill: string;
  /** 运行中状态灯颜色。 */
  signalRunningFill: string;
  /** 成功状态灯颜色。 */
  signalSuccessFill: string;
  /** 失败状态灯颜色。 */
  signalErrorFill: string;
  /** 按槽位类型映射的端口颜色表。 */
  slotTypeFillMap: Readonly<Record<string, string>>;
}

/**
 * 数据流传输动画样式配置。
 */
export interface LeaferGraphDataFlowAnimationStyleConfig {
  /** 是否启用该预设动画。 */
  enabled: boolean;
  /** 当前动画预设 ID。 */
  preset: LeaferGraphLinkPropagationAnimationPreset;
  /** pulse 动画持续时长。 */
  pulseDurationMs: number;
  /** 深色模式下 pulse 的透明度。 */
  pulseDarkOpacity: number;
  /** 亮色模式下 pulse 的透明度。 */
  pulseLightOpacity: number;
  /** pulse 基础描边宽度。 */
  pulseBaseStrokeWidth: number;
  /** pulse 额外描边宽度。 */
  pulseExtraStrokeWidth: number;
  /** 同屏最多 pulse 数量。 */
  maxPulses: number;
  /** travelling 粒子尺寸。 */
  particleSize: number;
  /** travelling 粒子 glow 尺寸。 */
  glowSize: number;
  /** 粒子单次运动时长。 */
  durationMs: number;
  /** 粒子核心透明度。 */
  coreOpacity: number;
  /** 深色模式下 glow 透明度。 */
  darkGlowOpacity: number;
  /** 亮色模式下 glow 透明度。 */
  lightGlowOpacity: number;
  /** 粒子淡入阶段占总时长比例。 */
  fadeInRatio: number;
  /** 粒子淡出阶段占总时长比例。 */
  fadeOutRatio: number;
  /** 同屏最多 travelling 粒子数量。 */
  maxParticles: number;
}

/**
 * 图主题 bundle。
 */
export interface LeaferGraphGraphThemeTokens {
  /** 节点壳布局度量。 */
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  /** 节点壳通用样式配置。 */
  nodeShellStyle: LeaferGraphNodeShellStyleConfig;
  /** 节点壳渲染主题。 */
  nodeShellRenderTheme: NodeShellRenderTheme;
  /** 画布背景色。 */
  canvasBackground: string;
  /** 选中态强调描边色。 */
  selectedStroke: string;
  /** 正式连线默认颜色。 */
  linkStroke: string;
  /** 各动画预设对应的样式配置表。 */
  dataFlowAnimationStyles: Readonly<
    Record<
      LeaferGraphLinkPropagationAnimationPreset,
      LeaferGraphDataFlowAnimationStyleConfig
    >
  >;
}
