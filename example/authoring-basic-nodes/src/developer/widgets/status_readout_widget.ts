import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/extensions/authoring";

import { AUTHORING_BASIC_STATUS_WIDGET_TYPE } from "../shared";

type StatusUi = DevWidgetContext<string>["ui"];
type StatusText = InstanceType<StatusUi["Text"]>;
type StatusRect = InstanceType<StatusUi["Rect"]>;

interface StatusReadoutState {
  [key: string]: unknown;
  label: StatusText;
  surface: StatusRect;
  statusLine: StatusText;
  detailLine: StatusText;
  chip: StatusRect;
}

interface StatusReadoutOptions {
  label: string;
  description: string;
  emptyText: string;
}

interface StatusTheme {
  labelFill: string;
  valueFill: string;
  mutedFill: string;
  fieldFill: string;
  fieldStroke: string;
  accentFill: string;
  accentStroke: string;
  fontFamily?: string;
}

interface TextMeasureStyle {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
}

let cachedTextMeasureContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;

interface StatusReadoutGeometry {
  surfaceY: number;
  surfaceHeight: number;
  chipY: number;
  statusLineY: number;
  statusLineWidth: number;
  detailLineY: number;
  detailLineWidth: number;
  detailLineHeight: number;
}

/**
 * 规范化状态值。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
function normalizeStatusValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }
  return String(value);
}

/**
 * 解析选项。
 *
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
function resolveOptions(options: unknown): StatusReadoutOptions {
  const source =
    options && typeof options === "object"
      ? (options as Record<string, unknown>)
      : {};

  return {
    label:
      typeof source.label === "string" && source.label.trim()
        ? source.label.trim()
        : "Status",
    description:
      typeof source.description === "string" && source.description.trim()
        ? source.description.trim()
        : "Node runtime snapshot",
    emptyText:
      typeof source.emptyText === "string" && source.emptyText.trim()
        ? source.emptyText.trim()
        : "IDLE"
  };
}

/**
 * 解析主题。
 *
 * @param ctx - `ctx`。
 * @returns 处理后的结果。
 */
function resolveTheme(ctx: DevWidgetContext<string>): StatusTheme {
  const { tokens } = ctx.theme;

  return {
    labelFill: tokens.labelFill,
    valueFill: tokens.valueFill,
    mutedFill: tokens.mutedFill,
    fieldFill: tokens.fieldFill,
    fieldStroke: tokens.fieldStroke,
    accentFill: ctx.theme.mode === "dark" ? "#11304A" : "#D7ECFF",
    accentStroke: ctx.theme.mode === "dark" ? "#2F6CA0" : "#5B8BC1",
    fontFamily: tokens.fontFamily
  };
}

/**
 * 根据当前 widget 边界解析状态面板几何。
 *
 * @remarks
 * Watch 节点等展示型控件会随着节点拉高获得更多可用高度，
 * 这里让 readout 面板真正吃到这部分空间，而不是维持固定 66px。
 *
 * @param bounds - `bounds`。
 * @returns 处理后的结果。
 */
function resolveGeometry(
  bounds: DevWidgetContext<string>["bounds"]
): StatusReadoutGeometry {
  const surfaceY = 16;
  const minimumSurfaceHeight = 66;
  const surfaceHeight = Math.max(bounds.height - surfaceY, minimumSurfaceHeight);
  const chipY = surfaceY + 12;
  const statusLineY = surfaceY + 7;
  const detailLineY = surfaceY + 30;
  const statusLineWidth = Math.max(bounds.width - 40, 0);
  const detailLineWidth = Math.max(bounds.width - 24, 0);
  const detailLineHeight = Math.max(surfaceHeight - 38, 14);

  return {
    surfaceY,
    surfaceHeight,
    chipY,
    statusLineY,
    statusLineWidth,
    detailLineY,
    detailLineWidth,
    detailLineHeight
  };
}

/**
 * 按当前 widget 可用尺寸动态折叠文本。
 *
 * @remarks
 * 这里不再提前按固定长度裁切，而是根据当前宽高估算：
 * - 一行大约能容纳多少字符
 * - 当前区域最多能显示多少行
 * 超出后只在最后一行补一个省略号。
 *
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
function clampTextToBounds(options: {
  text: string;
  width: number;
  height?: number;
  textStyle: TextMeasureStyle;
  maxLines?: number;
}): string {
  // 先整理当前阶段需要的输入、状态与依赖。
  const normalizedText = options.text.replace(/\r\n/g, "\n");
  const lineHeight = Math.max(
    options.textStyle.fontSize * 1.45,
    options.textStyle.fontSize + 2
  );
  const maxLines =
    options.maxLines ??
    Math.max(1, Math.floor((options.height ?? lineHeight) / lineHeight));

  if (!normalizedText || maxLines <= 0) {
    return normalizedText;
  }

  if (options.width <= 4) {
    return maxLines > 0 ? "…" : "";
  }

  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;
  let truncated = false;

  for (const character of normalizedText) {
    if (character === "\n") {
      lines.push(currentLine);
      currentLine = "";
      currentWidth = 0;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      continue;
    }

    // 再执行核心逻辑，并把结果或副作用统一收口。
    const characterWidth = measureTextWidth(character, options.textStyle);
    if (
      currentLine &&
      currentWidth + characterWidth > options.width
    ) {
      lines.push(currentLine);
      currentLine = "";
      currentWidth = 0;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }

    currentLine += character;
    currentWidth += characterWidth;
  }

  if (!truncated && (currentLine || !lines.length)) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }

  if (!truncated) {
    return lines.join("\n");
  }

  const visibleLines = lines.slice(0, maxLines);
  const lastLineIndex = Math.max(0, visibleLines.length - 1);
  visibleLines[lastLineIndex] = appendEllipsisWithinWidth(
    visibleLines[lastLineIndex] ?? "",
    options.width,
    options.textStyle
  );

  return visibleLines.join("\n");
}

/**
 *  为最后一行补省略号，同时保证补完后仍不超出当前宽度。
 *
 * @param line - `line`。
 * @param width - `width`。
 * @param textStyle - 文本样式。
 * @returns 处理后的结果。
 */
function appendEllipsisWithinWidth(
  line: string,
  width: number,
  textStyle: TextMeasureStyle
): string {
  const ellipsis = "…";
  const ellipsisWidth = measureTextWidth(ellipsis, textStyle);

  if (!line) {
    return ellipsis;
  }

  let nextLine = line;
  while (
    nextLine &&
    measureTextWidth(`${nextLine}${ellipsis}`, textStyle) > width
  ) {
    nextLine = nextLine.slice(0, -1);
  }

  if (!nextLine && ellipsisWidth > width) {
    return "";
  }

  return `${nextLine}${ellipsis}`;
}

/**
 *  优先使用真实字体测量宽度，失败时再回退到轻量估算。
 *
 * @param text - 文本。
 * @param textStyle - 文本样式。
 * @returns 处理后的结果。
 */
function measureTextWidth(text: string, textStyle: TextMeasureStyle): number {
  const context = getTextMeasureContext();
  if (context) {
    context.font = buildCanvasFont(textStyle);
    return context.measureText(text).width;
  }

  let width = 0;
  for (const character of text) {
    width += estimateCharacterWidth(character, textStyle.fontSize);
  }
  return width;
}

/**
 *  粗略区分 CJK / ASCII / 空白字符宽度，用于动态折叠估算。
 *
 * @param character - `character`。
 * @param fontSize - `fontSize` 参数。
 * @returns 处理后的结果。
 */
function estimateCharacterWidth(character: string, fontSize: number): number {
  if (character === " ") {
    return fontSize * 0.35;
  }

  if (/[\t]/u.test(character)) {
    return fontSize * 0.7;
  }

  if (/[\x00-\xff]/u.test(character)) {
    return fontSize * 0.62;
  }

  return fontSize;
}

/**
 * 获取文本`Measure` 上下文。
 *
 * @returns 处理后的结果。
 */
function getTextMeasureContext():
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | null {
  if (cachedTextMeasureContext !== undefined) {
    return cachedTextMeasureContext;
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    cachedTextMeasureContext = canvas.getContext("2d");
    return cachedTextMeasureContext;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    cachedTextMeasureContext = new OffscreenCanvas(1, 1).getContext("2d");
    return cachedTextMeasureContext;
  }

  cachedTextMeasureContext = null;
  return cachedTextMeasureContext;
}

/**
 * 构建画布`Font`。
 *
 * @param textStyle - 文本样式。
 * @returns 处理后的结果。
 */
function buildCanvasFont(textStyle: TextMeasureStyle): string {
  const fontWeight = textStyle.fontWeight ?? "400";
  const fontFamily = textStyle.fontFamily?.trim() || "sans-serif";
  return `${fontWeight} ${textStyle.fontSize}px ${fontFamily}`;
}

/**
 * 同步状态`Readout`。
 *
 * @param state - 当前状态。
 * @param value - 当前值。
 * @param options - 可选配置项。
 * @param theme - 主题。
 * @param bounds - `bounds`。
 * @returns 无返回值。
 */
function syncStatusReadout(
  state: StatusReadoutState,
  value: unknown,
  options: StatusReadoutOptions,
  theme: StatusTheme,
  bounds: DevWidgetContext<string>["bounds"]
): void {
  // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
  const geometry = resolveGeometry(bounds);
  const textValue = normalizeStatusValue(value);
  const [headline, ...rest] = (textValue || options.emptyText).split("\n");
  const detailText = rest.join("\n") || options.description;

  state.surface.y = geometry.surfaceY;
  state.surface.width = bounds.width;
  state.surface.height = geometry.surfaceHeight;

  state.label.text = options.label;
  state.label.width = bounds.width;
  state.label.fill = theme.labelFill;
  state.label.fontFamily = theme.fontFamily;

  state.surface.fill = theme.fieldFill;
  state.surface.stroke = theme.fieldStroke;

  // 再执行核心更新步骤，并同步派生副作用与收尾状态。
  state.chip.fill = theme.accentFill;
  state.chip.stroke = theme.accentStroke;
  state.chip.y = geometry.chipY;

  state.statusLine.y = geometry.statusLineY;
  state.statusLine.width = geometry.statusLineWidth;
  state.statusLine.text = clampTextToBounds({
    text: headline || options.emptyText,
    width: geometry.statusLineWidth,
    textStyle: {
      fontSize: 12,
      fontFamily: theme.fontFamily,
      fontWeight: "600"
    },
    maxLines: 1
  });
  state.statusLine.fill = theme.valueFill;
  state.statusLine.fontFamily = theme.fontFamily;

  state.detailLine.y = geometry.detailLineY;
  state.detailLine.width = geometry.detailLineWidth;
  state.detailLine.height = geometry.detailLineHeight;
  state.detailLine.text = clampTextToBounds({
    text: detailText,
    width: geometry.detailLineWidth,
    height: geometry.detailLineHeight,
    textStyle: {
      fontSize: 10,
      fontFamily: theme.fontFamily
    }
  });
  state.detailLine.fill = theme.mutedFill;
  state.detailLine.fontFamily = theme.fontFamily;
}

/**
 * 封装 StatusReadoutWidget 的 Widget 行为。
 */
export class StatusReadoutWidget extends BaseWidget<string, StatusReadoutState> {
  static meta = {
    type: AUTHORING_BASIC_STATUS_WIDGET_TYPE,
    title: "Status Readout",
    description: "Compact status panel for authoring basic nodes",
    normalize: normalizeStatusValue,
    serialize: normalizeStatusValue
  };

  /**
   * 处理 `mount` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 处理后的结果。
   */
  mount(ctx: DevWidgetContext<string>) {
    // 先准备宿主依赖、初始状态和需要挂载的资源。
    const options = resolveOptions(ctx.widget.options);
    const theme = resolveTheme(ctx);
    const geometry = resolveGeometry(ctx.bounds);

    const surface = new ctx.ui.Rect({
      x: 0,
      y: geometry.surfaceY,
      width: ctx.bounds.width,
      height: geometry.surfaceHeight,
      cornerRadius: 16,
      fill: theme.fieldFill,
      stroke: theme.fieldStroke,
      strokeWidth: 1,
      hittable: false
    });

    const chip = new ctx.ui.Rect({
      x: 12,
      y: geometry.chipY,
      width: 8,
      height: 8,
      cornerRadius: 999,
      fill: theme.accentFill,
      stroke: theme.accentStroke,
      strokeWidth: 1,
      hittable: false
    });

    const label = new ctx.ui.Text({
      x: 0,
      y: 0,
      width: ctx.bounds.width,
      text: options.label,
      fill: theme.labelFill,
      fontFamily: theme.fontFamily,
      fontSize: 10,
      fontWeight: "700",
      hittable: false
    });

    // 再建立绑定与同步关系，让运行期交互能够稳定生效。
    const statusLine = new ctx.ui.Text({
      x: 28,
      y: geometry.statusLineY,
      width: geometry.statusLineWidth,
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      fontWeight: "600",
      textWrap: "break",
      textOverflow: "show",
      hittable: false
    });

    const detailLine = new ctx.ui.Text({
      x: 12,
      y: geometry.detailLineY,
      width: geometry.detailLineWidth,
      height: geometry.detailLineHeight,
      text: options.description,
      fill: theme.mutedFill,
      fontFamily: theme.fontFamily,
      fontSize: 10,
      textWrap: "break",
      textOverflow: "show",
      hittable: false
    });

    const state: StatusReadoutState = {
      label,
      surface,
      statusLine,
      detailLine,
      chip
    };

    ctx.group.add([label, surface, chip, statusLine, detailLine]);
    syncStatusReadout(state, ctx.value, options, theme, ctx.bounds);
    return state;
  }

  /**
   * 处理 `update` 相关逻辑。
   *
   * @param state - 当前状态。
   * @param ctx - `ctx`。
   * @param nextValue - 当前值。
   * @returns 无返回值。
   */
  update(
    state: StatusReadoutState | void,
    ctx: DevWidgetContext<string>,
    nextValue: string
  ) {
    if (!state) {
      return;
    }

    syncStatusReadout(
      state,
      nextValue,
      resolveOptions(ctx.widget.options),
      resolveTheme(ctx),
      ctx.bounds
    );
  }

  /**
   * 处理 `destroy` 相关逻辑。
   *
   * @param state - 当前状态。
   * @returns 无返回值。
   */
  destroy(state: StatusReadoutState | void) {
    if (!state) {
      return;
    }

    state.statusLine.text = "";
    state.detailLine.text = "";
  }
}

export const statusReadoutWidgetEntry = defineAuthoringWidget(StatusReadoutWidget);
