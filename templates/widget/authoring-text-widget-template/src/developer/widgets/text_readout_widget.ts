import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";

import { AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE } from "../shared";

/** 通过宿主注入的 `ctx.ui` 推导真实 Leafer 类型，避免本地类型漂移。 */
type TextReadoutWidgetUi = DevWidgetContext<string>["ui"];
type TextReadoutWidgetText = InstanceType<TextReadoutWidgetUi["Text"]>;
type TextReadoutWidgetRect = InstanceType<TextReadoutWidgetUi["Rect"]>;

/** Widget 在 mount 后持有的图元状态。 */
interface TextReadoutWidgetState {
  [key: string]: unknown;
  label: TextReadoutWidgetText;
  surface: TextReadoutWidgetRect;
  valueText: TextReadoutWidgetText;
  hintText: TextReadoutWidgetText;
}

/** 开发者可通过 `widget.options` 覆盖的文本展示配置。 */
interface TextReadoutWidgetOptions {
  label: string;
  description: string;
  emptyText: string;
}

/** 从宿主主题中读取出来的最小样式集合。 */
interface TextReadoutWidgetTheme {
  labelFill: string;
  fieldFill: string;
  fieldStroke: string;
  valueFill: string;
  mutedFill: string;
  fontFamily?: string;
}

/**
 * 把任意输入值归一化为可展示字符串。
 *
 * 这个函数同时用于：
 * - Widget meta 的 normalize / serialize
 * - 实际渲染时的文本展示
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
function normalizeTextValue(value: unknown): string {
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
 *  从 `widget.options` 里解析用户自定义标签、说明和空态文案。
 *
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
function resolveWidgetOptions(options: unknown): TextReadoutWidgetOptions {
  const source =
    options && typeof options === "object"
      ? (options as Record<string, unknown>)
      : {};

  return {
    label:
      typeof source.label === "string" && source.label.trim()
        ? source.label.trim()
        : "Readout",
    description:
      typeof source.description === "string" && source.description.trim()
        ? source.description.trim()
        : "用于在节点内部展示一段文字",
    emptyText:
      typeof source.emptyText === "string" ? source.emptyText : "EMPTY"
  };
}

/**
 *  从宿主主题上下文里收口出 Widget 真正要用到的视觉 token。
 *
 * @param ctx - `ctx`。
 * @returns 处理后的结果。
 */
function resolveWidgetTheme(
  ctx: DevWidgetContext<string>
): TextReadoutWidgetTheme {
  const { tokens } = ctx.theme;

  return {
    labelFill: tokens.labelFill,
    fieldFill: tokens.fieldFill,
    fieldStroke: tokens.fieldStroke,
    valueFill: tokens.valueFill,
    mutedFill: tokens.mutedFill,
    fontFamily: tokens.fontFamily
  };
}

/**
 *  把最新值、选项和主题同步回现有图元，避免 update 阶段重复创建 UI。
 *
 * @param state - 当前状态。
 * @param value - 当前值。
 * @param options - 可选配置项。
 * @param theme - 主题。
 * @returns 无返回值。
 */
function syncTextReadoutWidget(
  state: TextReadoutWidgetState,
  value: unknown,
  options: TextReadoutWidgetOptions,
  theme: TextReadoutWidgetTheme
): void {
  const text = normalizeTextValue(value);

  state.label.text = options.label;
  state.label.fill = theme.labelFill;
  state.label.fontFamily = theme.fontFamily;

  state.surface.fill = theme.fieldFill;
  state.surface.stroke = theme.fieldStroke;

  state.valueText.text = text || options.emptyText;
  state.valueText.fill = theme.valueFill;
  state.valueText.fontFamily = theme.fontFamily;

  state.hintText.text = options.description;
  state.hintText.fill = theme.mutedFill;
  state.hintText.fontFamily = theme.fontFamily;
}

/**
 * 最小文字展示型 Widget。
 *
 * 这个模板刻意只演示“显示型控件”，
 * 方便开发者直接复用到 `Watch`、`Readout`、`Status Display` 这类节点。
 */
export class TextReadoutWidget extends BaseWidget<string, TextReadoutWidgetState> {
  static meta = {
    type: AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE,
    title: "Text Readout",
    description: "用于 watch / readout / status display 的文字展示型 Widget",
    normalize: normalizeTextValue,
    serialize: normalizeTextValue
  };

  /**
   *  初次挂载时创建 label / surface / value / hint 四个图元。
   *
   * @param ctx - `ctx`。
   * @returns 处理后的结果。
   */
  mount(ctx: DevWidgetContext<string>) {
    // 先准备宿主依赖、初始状态和需要挂载的资源。
    const options = resolveWidgetOptions(ctx.widget.options);
    const theme = resolveWidgetTheme(ctx);

    const label = new ctx.ui.Text({
      x: 0,
      y: 0,
      width: ctx.bounds.width,
      text: options.label,
      fill: theme.labelFill,
      fontFamily: theme.fontFamily,
      fontSize: 11,
      fontWeight: "600",
      hittable: false
    });

    const surface = new ctx.ui.Rect({
      x: 0,
      y: 18,
      width: ctx.bounds.width,
      height: 44,
      cornerRadius: 12,
      fill: theme.fieldFill,
      stroke: theme.fieldStroke,
      strokeWidth: 1,
      hittable: false
    });

    const valueText = new ctx.ui.Text({
      x: 12,
      y: 28,
      width: Math.max(0, ctx.bounds.width - 24),
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      textWrap: "break",
      hittable: false
    });

    // 再建立绑定与同步关系，让运行期交互能够稳定生效。
    const hintText = new ctx.ui.Text({
      x: 0,
      y: 68,
      width: ctx.bounds.width,
      text: options.description,
      fill: theme.mutedFill,
      fontFamily: theme.fontFamily,
      fontSize: 10,
      hittable: false
    });

    const state: TextReadoutWidgetState = {
      label,
      surface,
      valueText,
      hintText
    };

    ctx.group.add([label, surface, valueText, hintText]);
    syncTextReadoutWidget(state, ctx.value, options, theme);

    return state;
  }

  /**
   *  值变化时只更新现有图元文本与样式。
   *
   * @param state - 当前状态。
   * @param ctx - `ctx`。
   * @param nextValue - 当前值。
   * @returns 无返回值。
   */
  update(
    state: TextReadoutWidgetState | void,
    ctx: DevWidgetContext<string>,
    nextValue: string
  ) {
    if (!state) {
      return;
    }

    const options = resolveWidgetOptions(ctx.widget.options);
    const theme = resolveWidgetTheme(ctx);

    syncTextReadoutWidget(state, nextValue, options, theme);
  }

  /**
   *  销毁时清空文本，方便调试时确认生命周期确实触发。
   *
   * @param state - 当前状态。
   * @param _ctx - `ctx`。
   * @returns 无返回值。
   */
  destroy(state: TextReadoutWidgetState | void, _ctx: DevWidgetContext<string>) {
    if (!state) {
      return;
    }

    state.valueText.text = "";
    state.hintText.text = "";
  }
}

/** `TextReadoutWidget` 对应的正式 Widget 条目。 */
export const textReadoutWidgetEntry = defineAuthoringWidget(TextReadoutWidget);
