import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";

import { AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE } from "../shared";

/** 通过宿主注入的 `ctx.ui` 推导真实 Leafer 类型，避免本地类型漂移。 */
type TextReadoutUi = DevWidgetContext<string>["ui"];
type TextReadoutText = InstanceType<TextReadoutUi["Text"]>;
type TextReadoutRect = InstanceType<TextReadoutUi["Rect"]>;

/** Widget 在 mount 后持有的图元状态。 */
interface TextReadoutState {
  [key: string]: unknown;
  label: TextReadoutText;
  surface: TextReadoutRect;
  valueText: TextReadoutText;
  hintText: TextReadoutText;
}

/** 开发者可通过 `widget.options` 覆盖的文本展示配置。 */
interface TextReadoutOptions {
  label: string;
  description: string;
  emptyText: string;
}

/** 从宿主主题中读取出来的最小样式集合。 */
interface TextReadoutTheme {
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
function resolveTextReadoutOptions(options: unknown): TextReadoutOptions {
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
        : "显示最近一次输入值",
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
function resolveTextReadoutTheme(
  ctx: DevWidgetContext<string>
): TextReadoutTheme {
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
function syncTextReadout(
  state: TextReadoutState,
  value: unknown,
  options: TextReadoutOptions,
  theme: TextReadoutTheme
): void {
  const safeValue = normalizeTextValue(value);

  state.label.text = options.label;
  state.label.fill = theme.labelFill;
  state.label.fontFamily = theme.fontFamily;

  state.surface.fill = theme.fieldFill;
  state.surface.stroke = theme.fieldStroke;

  state.valueText.text = safeValue || options.emptyText;
  state.valueText.fill = theme.valueFill;
  state.valueText.fontFamily = theme.fontFamily;

  state.hintText.text = options.description;
  state.hintText.fill = theme.mutedFill;
  state.hintText.fontFamily = theme.fontFamily;
}

/**
 * 组合模板里的文字展示 Widget。
 *
 * 它和纯 Widget 模板里的目标一致：
 * 负责在节点内部渲染一块稳定的只读文本区域，
 * 方便 `WatchNode` 这类展示型节点复用。
 */
export class TextReadoutWidget extends BaseWidget<string, TextReadoutState> {
  static meta = {
    type: AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE,
    title: "Text Readout",
    description: "供 Watch 节点复用的文字展示 Widget",
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
    const options = resolveTextReadoutOptions(ctx.widget.options);
    const theme = resolveTextReadoutTheme(ctx);

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

    const state: TextReadoutState = {
      label,
      surface,
      valueText,
      hintText
    };

    ctx.group.add([label, surface, valueText, hintText]);
    syncTextReadout(state, ctx.value, options, theme);

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
    state: TextReadoutState | void,
    ctx: DevWidgetContext<string>,
    nextValue: string
  ) {
    if (!state) {
      return;
    }

    const options = resolveTextReadoutOptions(ctx.widget.options);
    const theme = resolveTextReadoutTheme(ctx);

    syncTextReadout(state, nextValue, options, theme);
  }

  /**
   *  销毁时清空文本，方便调试时确认生命周期确实触发。
   *
   * @param state - 当前状态。
   * @param _ctx - `ctx`。
   * @returns 无返回值。
   */
  destroy(state: TextReadoutState | void, _ctx: DevWidgetContext<string>) {
    if (!state) {
      return;
    }

    state.valueText.text = "";
    state.hintText.text = "";
  }
}

/** `TextReadoutWidget` 对应的正式 Widget 条目。 */
export const textReadoutWidgetEntry = defineAuthoringWidget(TextReadoutWidget);
