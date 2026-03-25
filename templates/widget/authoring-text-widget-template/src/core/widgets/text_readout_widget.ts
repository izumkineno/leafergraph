import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";

import { AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE } from "../shared";

type TextReadoutWidgetUi = DevWidgetContext<string>["ui"];
type TextReadoutWidgetText = InstanceType<TextReadoutWidgetUi["Text"]>;
type TextReadoutWidgetRect = InstanceType<TextReadoutWidgetUi["Rect"]>;

interface TextReadoutWidgetState {
  [key: string]: unknown;
  label: TextReadoutWidgetText;
  surface: TextReadoutWidgetRect;
  valueText: TextReadoutWidgetText;
  hintText: TextReadoutWidgetText;
}

interface TextReadoutWidgetOptions {
  label: string;
  description: string;
  emptyText: string;
}

interface TextReadoutWidgetTheme {
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

export class TextReadoutWidget extends BaseWidget<string, TextReadoutWidgetState> {
  static meta = {
    type: AUTHORING_TEXT_WIDGET_TEMPLATE_WIDGET_TYPE,
    title: "Text Readout",
    description: "用于 watch / readout / status display 的文字展示型 Widget",
    normalize: normalizeTextValue,
    serialize: normalizeTextValue
  };

  mount(ctx: DevWidgetContext<string>) {
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

  destroy(state: TextReadoutWidgetState | void, _ctx: DevWidgetContext<string>) {
    if (!state) {
      return;
    }

    state.valueText.text = "";
    state.hintText.text = "";
  }
}

export const textReadoutWidgetEntry = defineAuthoringWidget(TextReadoutWidget);
