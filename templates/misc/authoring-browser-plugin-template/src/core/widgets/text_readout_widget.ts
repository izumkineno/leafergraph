import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";

import { AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE } from "../shared";

type TextReadoutUi = DevWidgetContext<string>["ui"];
type TextReadoutText = InstanceType<TextReadoutUi["Text"]>;
type TextReadoutRect = InstanceType<TextReadoutUi["Rect"]>;

interface TextReadoutState {
  [key: string]: unknown;
  label: TextReadoutText;
  surface: TextReadoutRect;
  valueText: TextReadoutText;
  hintText: TextReadoutText;
}

interface TextReadoutOptions {
  label: string;
  description: string;
  emptyText: string;
}

interface TextReadoutTheme {
  labelFill: string;
  fieldFill: string;
  fieldStroke: string;
  valueFill: string;
  mutedFill: string;
  fontFamily?: string;
}

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

export class TextReadoutWidget extends BaseWidget<string, TextReadoutState> {
  static meta = {
    type: AUTHORING_BROWSER_TEMPLATE_TEXT_WIDGET_TYPE,
    title: "Text Readout",
    description: "供 Watch 节点复用的文字展示 Widget",
    normalize: normalizeTextValue,
    serialize: normalizeTextValue
  };

  mount(ctx: DevWidgetContext<string>) {
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

  destroy(state: TextReadoutState | void, _ctx: DevWidgetContext<string>) {
    if (!state) {
      return;
    }

    state.valueText.text = "";
    state.hintText.text = "";
  }
}

export const textReadoutWidgetEntry = defineAuthoringWidget(TextReadoutWidget);
