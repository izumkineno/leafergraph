import type {
  LeaferGraphDataFlowAnimationStyleConfig,
  LeaferGraphGraphThemeTokens,
  LeaferGraphNodeShellStyleConfig,
  NodeShellLayoutMetrics,
  NodeShellRenderTheme
} from "./types";
import type {
  LeaferGraphLinkPropagationAnimationPreset,
  LeaferGraphThemeMode
} from "../types";

const DEFAULT_NODE_WIDTH = 288;
const DEFAULT_NODE_MIN_HEIGHT = 184;
const NODE_RADIUS = 18;
const HEADER_HEIGHT = 46;
const SECTION_PADDING_X = 18;
const SECTION_PADDING_Y = 16;
const SLOT_ROW_HEIGHT = 20;
const SLOT_ROW_GAP = 16;
const PORT_SIZE = 12;
const WIDGET_HEIGHT = 60;
const WIDGET_GAP = 12;
const WIDGET_PADDING_Y = 16;
const SIGNAL_SIZE = 8;
const SIGNAL_GLOW_SIZE = 14;
const CATEGORY_PILL_HEIGHT = 22;
const CATEGORY_PILL_MIN_WIDTH = 96;
const CATEGORY_CHAR_WIDTH = 6.2;
const SLOT_TEXT_WIDTH = 84;
const NODE_FONT_FAMILY = '"Inter", "IBM Plex Sans", "Segoe UI", sans-serif';
const CARD_FILL = "rgba(28, 28, 33, 0.76)";
const CARD_STROKE = "rgba(255, 255, 255, 0.10)";
const HEADER_FILL = "rgba(255, 255, 255, 0.05)";
const HEADER_DIVIDER_FILL = "rgba(255, 255, 255, 0.08)";
const TITLE_FILL = "#F4F4F5";
const SLOT_LABEL_FILL = "#A1A1AA";
const CATEGORY_FILL = "rgba(255, 255, 255, 0.08)";
const CATEGORY_STROKE = "rgba(255, 255, 255, 0.05)";
const CATEGORY_TEXT_FILL = "#A1A1AA";
const CANVAS_BACKGROUND_DARK = [
  "radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 28%)",
  "radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.12), transparent 26%)",
  "radial-gradient(circle at center, rgba(255, 255, 255, 0.06) 1px, transparent 1px)",
  "linear-gradient(180deg, #0f172a 0%, #111827 100%)"
].join(", ");
const CANVAS_BACKGROUND_LIGHT = [
  "radial-gradient(circle at top left, rgba(56, 189, 248, 0.20), transparent 30%)",
  "radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 28%)",
  "radial-gradient(circle at center, rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
  "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)"
].join(", ");
const ERROR_BADGE_FILL_DARK = "rgba(127, 29, 29, 0.92)";
const ERROR_BADGE_STROKE_DARK = "rgba(248, 113, 113, 0.42)";
const ERROR_BADGE_TEXT_FILL_DARK = "#FEE2E2";
const WIDGET_FILL = "rgba(0, 0, 0, 0.15)";
const INPUT_PORT_FILL = "#3B82F6";
const OUTPUT_PORT_FILL = "#8B5CF6";
const GENERIC_PORT_FILL = "#94A3B8";
const LINK_STROKE = "#60A5FA";
const NODE_SELECTED_STROKE = "#2563EB";
const NODE_SIGNAL_FILL = "#94A3B8";
const NODE_SIGNAL_RUNNING_FILL = "#F59E0B";
const NODE_SIGNAL_SUCCESS_FILL = "#10B981";
const NODE_SIGNAL_ERROR_FILL = "#EF4444";
const DATA_FLOW_PARTICLE_SIZE = 8;
const DATA_FLOW_GLOW_SIZE = 18;
const DATA_FLOW_DURATION_MS = 420;
const DATA_FLOW_CORE_OPACITY = 0.96;
const DATA_FLOW_DARK_GLOW_OPACITY = 0.34;
const DATA_FLOW_LIGHT_GLOW_OPACITY = 0.24;
const DATA_FLOW_FADE_IN_RATIO = 0.16;
const DATA_FLOW_FADE_OUT_RATIO = 0.2;
const DATA_FLOW_MAX_PARTICLES = 48;
const DATA_FLOW_PULSE_DURATION_MS = 220;
const DATA_FLOW_PULSE_DARK_OPACITY = 0.78;
const DATA_FLOW_PULSE_LIGHT_OPACITY = 0.62;
const DATA_FLOW_PULSE_BASE_STROKE_WIDTH = 4;
const DATA_FLOW_PULSE_EXTRA_STROKE_WIDTH = 4;
const DATA_FLOW_MAX_PULSES = 16;
const MISSING_NODE_FILL = "rgba(220, 38, 38, 0.92)";
const MISSING_NODE_STROKE = "rgba(127, 29, 29, 0.86)";
const MISSING_NODE_TEXT_FILL = "#FFF1F2";
const ERROR_BADGE_FILL_LIGHT = "rgba(254, 226, 226, 0.96)";
const ERROR_BADGE_STROKE_LIGHT = "rgba(239, 68, 68, 0.24)";
const ERROR_BADGE_TEXT_FILL_LIGHT = "#991B1B";
const SELECTED_RING_OUTSET = 4;
const SELECTED_RING_STROKE_WIDTH = 3;

/** 默认槽位类型颜色表。 */
export const SLOT_TYPE_FILL_MAP: Readonly<Record<string, string>> = {
  number: "#3B82F6",
  float: "#3B82F6",
  int: "#2563EB",
  boolean: "#10B981",
  bool: "#10B981",
  string: "#F59E0B",
  text: "#F59E0B",
  image: "#EC4899",
  texture: "#EC4899",
  color: "#EF4444",
  vector: "#8B5CF6",
  vec2: "#8B5CF6",
  vec3: "#8B5CF6",
  vec4: "#8B5CF6",
  event: "#0EA5E9",
  exec: "#0EA5E9",
  trigger: "#0EA5E9",
  flow: "#0EA5E9"
} as const;

/** 默认节点壳布局度量参数。 */
export const NODE_SHELL_LAYOUT_METRICS: NodeShellLayoutMetrics = {
  defaultNodeWidth: DEFAULT_NODE_WIDTH,
  defaultNodeMinHeight: DEFAULT_NODE_MIN_HEIGHT,
  headerHeight: HEADER_HEIGHT,
  sectionPaddingX: SECTION_PADDING_X,
  sectionPaddingY: SECTION_PADDING_Y,
  slotRowHeight: SLOT_ROW_HEIGHT,
  slotRowGap: SLOT_ROW_GAP,
  portSize: PORT_SIZE,
  widgetHeight: WIDGET_HEIGHT,
  widgetGap: WIDGET_GAP,
  widgetPaddingY: WIDGET_PADDING_Y,
  categoryPillHeight: CATEGORY_PILL_HEIGHT,
  categoryPillMinWidth: CATEGORY_PILL_MIN_WIDTH,
  categoryCharWidth: CATEGORY_CHAR_WIDTH,
  slotTextWidth: SLOT_TEXT_WIDTH
};

/** 创建默认节点壳样式配置。 */
export function createDefaultNodeShellStyleConfig(): LeaferGraphNodeShellStyleConfig {
  return {
    defaultNodeWidth: DEFAULT_NODE_WIDTH,
    defaultNodeMinHeight: DEFAULT_NODE_MIN_HEIGHT,
    nodeRadius: NODE_RADIUS,
    nodeFontFamily: NODE_FONT_FAMILY,
    selectedRingOutset: SELECTED_RING_OUTSET,
    selectedRingStrokeWidth: SELECTED_RING_STROKE_WIDTH,
    missingNodeFill: MISSING_NODE_FILL,
    missingNodeStroke: MISSING_NODE_STROKE,
    missingNodeTextFill: MISSING_NODE_TEXT_FILL,
    inputPortFill: INPUT_PORT_FILL,
    outputPortFill: OUTPUT_PORT_FILL,
    genericPortFill: GENERIC_PORT_FILL,
    signalFill: NODE_SIGNAL_FILL,
    signalRunningFill: NODE_SIGNAL_RUNNING_FILL,
    signalSuccessFill: NODE_SIGNAL_SUCCESS_FILL,
    signalErrorFill: NODE_SIGNAL_ERROR_FILL,
    slotTypeFillMap: SLOT_TYPE_FILL_MAP
  };
}

/** 关闭连线传播动画时使用的样式。 */
export function createDisabledDataFlowAnimationStyleConfig(): LeaferGraphDataFlowAnimationStyleConfig {
  return {
    enabled: false,
    preset: "performance",
    pulseDurationMs: DATA_FLOW_PULSE_DURATION_MS,
    pulseDarkOpacity: DATA_FLOW_PULSE_DARK_OPACITY,
    pulseLightOpacity: DATA_FLOW_PULSE_LIGHT_OPACITY,
    pulseBaseStrokeWidth: DATA_FLOW_PULSE_BASE_STROKE_WIDTH,
    pulseExtraStrokeWidth: DATA_FLOW_PULSE_EXTRA_STROKE_WIDTH,
    maxPulses: 0,
    particleSize: DATA_FLOW_PARTICLE_SIZE,
    glowSize: DATA_FLOW_GLOW_SIZE,
    durationMs: DATA_FLOW_DURATION_MS,
    coreOpacity: DATA_FLOW_CORE_OPACITY,
    darkGlowOpacity: DATA_FLOW_DARK_GLOW_OPACITY,
    lightGlowOpacity: DATA_FLOW_LIGHT_GLOW_OPACITY,
    fadeInRatio: DATA_FLOW_FADE_IN_RATIO,
    fadeOutRatio: DATA_FLOW_FADE_OUT_RATIO,
    maxParticles: 0
  };
}

/** 创建默认的数据流传输动画样式配置。 */
export function createDefaultDataFlowAnimationStyleConfig(
  preset: LeaferGraphLinkPropagationAnimationPreset | false = "performance"
): LeaferGraphDataFlowAnimationStyleConfig {
  if (preset === false) {
    return createDisabledDataFlowAnimationStyleConfig();
  }

  switch (preset) {
    case "balanced":
      return {
        enabled: true,
        preset,
        pulseDurationMs: 260,
        pulseDarkOpacity: 0.58,
        pulseLightOpacity: 0.46,
        pulseBaseStrokeWidth: 4,
        pulseExtraStrokeWidth: 4,
        maxPulses: 0,
        particleSize: DATA_FLOW_PARTICLE_SIZE,
        glowSize: DATA_FLOW_GLOW_SIZE,
        durationMs: DATA_FLOW_DURATION_MS,
        coreOpacity: DATA_FLOW_CORE_OPACITY,
        darkGlowOpacity: DATA_FLOW_DARK_GLOW_OPACITY,
        lightGlowOpacity: DATA_FLOW_LIGHT_GLOW_OPACITY,
        fadeInRatio: DATA_FLOW_FADE_IN_RATIO,
        fadeOutRatio: DATA_FLOW_FADE_OUT_RATIO,
        maxParticles: DATA_FLOW_MAX_PARTICLES
      };
    case "expressive":
      return {
        enabled: true,
        preset,
        pulseDurationMs: 320,
        pulseDarkOpacity: 0.68,
        pulseLightOpacity: 0.54,
        pulseBaseStrokeWidth: 4,
        pulseExtraStrokeWidth: 5,
        maxPulses: 24,
        particleSize: 10,
        glowSize: 24,
        durationMs: 540,
        coreOpacity: 1,
        darkGlowOpacity: 0.42,
        lightGlowOpacity: 0.3,
        fadeInRatio: 0.14,
        fadeOutRatio: 0.22,
        maxParticles: 72
      };
    case "performance":
    default:
      return {
        enabled: true,
        preset: "performance",
        pulseDurationMs: DATA_FLOW_PULSE_DURATION_MS,
        pulseDarkOpacity: DATA_FLOW_PULSE_DARK_OPACITY,
        pulseLightOpacity: DATA_FLOW_PULSE_LIGHT_OPACITY,
        pulseBaseStrokeWidth: DATA_FLOW_PULSE_BASE_STROKE_WIDTH,
        pulseExtraStrokeWidth: DATA_FLOW_PULSE_EXTRA_STROKE_WIDTH,
        maxPulses: DATA_FLOW_MAX_PULSES,
        particleSize: DATA_FLOW_PARTICLE_SIZE,
        glowSize: DATA_FLOW_GLOW_SIZE,
        durationMs: DATA_FLOW_DURATION_MS,
        coreOpacity: DATA_FLOW_CORE_OPACITY,
        darkGlowOpacity: DATA_FLOW_DARK_GLOW_OPACITY,
        lightGlowOpacity: DATA_FLOW_LIGHT_GLOW_OPACITY,
        fadeInRatio: DATA_FLOW_FADE_IN_RATIO,
        fadeOutRatio: DATA_FLOW_FADE_OUT_RATIO,
        maxParticles: 0
      };
  }
}

/** 默认连线描边色。 */
export function resolveDefaultLinkStroke(): string {
  return LINK_STROKE;
}

/** 默认选中描边色。 */
export function resolveDefaultSelectedStroke(_mode: LeaferGraphThemeMode): string {
  return NODE_SELECTED_STROKE;
}

/** 根据主题模式解析默认画布背景。 */
export function resolveDefaultCanvasBackground(
  mode: LeaferGraphThemeMode
): string {
  return mode === "dark" ? CANVAS_BACKGROUND_DARK : CANVAS_BACKGROUND_LIGHT;
}

/** 根据主题模式解析默认节点壳渲染主题。 */
export function resolveDefaultNodeShellRenderTheme(
  mode: LeaferGraphThemeMode
): NodeShellRenderTheme {
  if (mode === "dark") {
    return {
      nodeRadius: NODE_RADIUS,
      headerHeight: HEADER_HEIGHT,
      selectedRingOutset: SELECTED_RING_OUTSET,
      selectedRingStrokeWidth: SELECTED_RING_STROKE_WIDTH,
      selectedRingOpacity: 0.92,
      resizeHandleFill: "rgba(255, 255, 255, 0.001)",
      resizeHandleStroke: "rgba(255, 255, 255, 0.72)",
      resizeHandleStrokeWidth: 1.5,
      cardFill: CARD_FILL,
      cardStroke: CARD_STROKE,
      headerFill: HEADER_FILL,
      headerDividerFill: HEADER_DIVIDER_FILL,
      titleFill: TITLE_FILL,
      titleFontFamily: NODE_FONT_FAMILY,
      titleFontSize: 13,
      titleFontWeight: "600",
      titleX: 38,
      titleY: 15,
      categoryFill: CATEGORY_FILL,
      categoryStroke: CATEGORY_STROKE,
      categoryTextFill: CATEGORY_TEXT_FILL,
      categoryFontFamily: NODE_FONT_FAMILY,
      categoryFontSize: 9.5,
      categoryFontWeight: "600",
      errorBadgeFill: ERROR_BADGE_FILL_DARK,
      errorBadgeStroke: ERROR_BADGE_STROKE_DARK,
      errorBadgeTextFill: ERROR_BADGE_TEXT_FILL_DARK,
      signalGlowX: 17,
      signalGlowY: 16,
      signalGlowSize: SIGNAL_GLOW_SIZE,
      signalGlowOpacity: 0.24,
      signalLightX: 20,
      signalLightY: 19,
      signalLightSize: SIGNAL_SIZE,
      signalHitPadding: 4,
      widgetFill: WIDGET_FILL,
      inputPortFill: INPUT_PORT_FILL,
      outputPortFill: OUTPUT_PORT_FILL,
      portStroke: CARD_FILL,
      portStrokeWidth: 2.5,
      slotLabelFill: SLOT_LABEL_FILL,
      slotLabelFontFamily: NODE_FONT_FAMILY,
      slotLabelFontSize: 11,
      slotLabelFontWeight: "500"
    };
  }

  return {
    nodeRadius: NODE_RADIUS,
    headerHeight: HEADER_HEIGHT,
    selectedRingOutset: SELECTED_RING_OUTSET,
    selectedRingStrokeWidth: SELECTED_RING_STROKE_WIDTH,
    selectedRingOpacity: 0.92,
    resizeHandleFill: "rgba(255, 255, 255, 0.001)",
    resizeHandleStroke: "rgba(15, 23, 42, 0.72)",
    resizeHandleStrokeWidth: 1.85,
    cardFill: "rgba(255, 255, 255, 0.96)",
    cardStroke: "rgba(148, 163, 184, 0.28)",
    headerFill: "rgba(248, 250, 252, 0.96)",
    headerDividerFill: "rgba(148, 163, 184, 0.16)",
    titleFill: "#0F172A",
    titleFontFamily: NODE_FONT_FAMILY,
    titleFontSize: 13,
    titleFontWeight: "600",
    titleX: 38,
    titleY: 15,
    categoryFill: "rgba(241, 245, 249, 0.96)",
    categoryStroke: "rgba(203, 213, 225, 0.88)",
    categoryTextFill: "#64748B",
    categoryFontFamily: NODE_FONT_FAMILY,
    categoryFontSize: 9.5,
    categoryFontWeight: "600",
    errorBadgeFill: ERROR_BADGE_FILL_LIGHT,
    errorBadgeStroke: ERROR_BADGE_STROKE_LIGHT,
    errorBadgeTextFill: ERROR_BADGE_TEXT_FILL_LIGHT,
    signalGlowX: 17,
    signalGlowY: 16,
    signalGlowSize: SIGNAL_GLOW_SIZE,
    signalGlowOpacity: 0.16,
    signalLightX: 20,
    signalLightY: 19,
    signalLightSize: SIGNAL_SIZE,
    signalHitPadding: 4,
    widgetFill: "rgba(248, 250, 252, 0.92)",
    inputPortFill: INPUT_PORT_FILL,
    outputPortFill: OUTPUT_PORT_FILL,
    portStroke: "#FFFFFF",
    portStrokeWidth: 2.5,
    slotLabelFill: "#64748B",
    slotLabelFontFamily: NODE_FONT_FAMILY,
    slotLabelFontSize: 11,
    slotLabelFontWeight: "500"
  };
}

/** 根据主题模式解析默认 graph 主题 bundle。 */
export function resolveDefaultGraphTheme(
  mode: LeaferGraphThemeMode
): LeaferGraphGraphThemeTokens {
  return {
    nodeShellLayoutMetrics: NODE_SHELL_LAYOUT_METRICS,
    nodeShellStyle: createDefaultNodeShellStyleConfig(),
    nodeShellRenderTheme: resolveDefaultNodeShellRenderTheme(mode),
    canvasBackground: resolveDefaultCanvasBackground(mode),
    selectedStroke: resolveDefaultSelectedStroke(mode),
    linkStroke: resolveDefaultLinkStroke(),
    dataFlowAnimationStyles: {
      performance: createDefaultDataFlowAnimationStyleConfig("performance"),
      balanced: createDefaultDataFlowAnimationStyleConfig("balanced"),
      expressive: createDefaultDataFlowAnimationStyleConfig("expressive")
    }
  };
}
