import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";

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

function syncStatusReadout(
  state: StatusReadoutState,
  value: unknown,
  options: StatusReadoutOptions,
  theme: StatusTheme
): void {
  const textValue = normalizeStatusValue(value);
  const [headline, ...rest] = (textValue || options.emptyText).split("\n");

  state.label.text = options.label;
  state.label.fill = theme.labelFill;
  state.label.fontFamily = theme.fontFamily;

  state.surface.fill = theme.fieldFill;
  state.surface.stroke = theme.fieldStroke;

  state.chip.fill = theme.accentFill;
  state.chip.stroke = theme.accentStroke;

  state.statusLine.text = headline || options.emptyText;
  state.statusLine.fill = theme.valueFill;
  state.statusLine.fontFamily = theme.fontFamily;

  state.detailLine.text = rest.join("\n") || options.description;
  state.detailLine.fill = theme.mutedFill;
  state.detailLine.fontFamily = theme.fontFamily;
}

export class StatusReadoutWidget extends BaseWidget<string, StatusReadoutState> {
  static meta = {
    type: AUTHORING_BASIC_STATUS_WIDGET_TYPE,
    title: "Status Readout",
    description: "Compact status panel for authoring basic nodes",
    normalize: normalizeStatusValue,
    serialize: normalizeStatusValue
  };

  mount(ctx: DevWidgetContext<string>) {
    const options = resolveOptions(ctx.widget.options);
    const theme = resolveTheme(ctx);

    const surface = new ctx.ui.Rect({
      x: 0,
      y: 16,
      width: ctx.bounds.width,
      height: 66,
      cornerRadius: 16,
      fill: theme.fieldFill,
      stroke: theme.fieldStroke,
      strokeWidth: 1,
      hittable: false
    });

    const chip = new ctx.ui.Rect({
      x: 12,
      y: 28,
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

    const statusLine = new ctx.ui.Text({
      x: 28,
      y: 23,
      width: Math.max(ctx.bounds.width - 40, 0),
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      fontWeight: "600",
      textWrap: "break",
      hittable: false
    });

    const detailLine = new ctx.ui.Text({
      x: 12,
      y: 46,
      width: Math.max(ctx.bounds.width - 24, 0),
      text: options.description,
      fill: theme.mutedFill,
      fontFamily: theme.fontFamily,
      fontSize: 10,
      textWrap: "break",
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
    syncStatusReadout(state, ctx.value, options, theme);
    return state;
  }

  update(
    state: StatusReadoutState | void,
    ctx: DevWidgetContext<string>,
    nextValue: string
  ) {
    if (!state) {
      return;
    }

    syncStatusReadout(state, nextValue, resolveOptions(ctx.widget.options), resolveTheme(ctx));
  }

  destroy(state: StatusReadoutState | void) {
    if (!state) {
      return;
    }

    state.statusLine.text = "";
    state.detailLine.text = "";
  }
}

export const statusReadoutWidgetEntry = defineAuthoringWidget(StatusReadoutWidget);
