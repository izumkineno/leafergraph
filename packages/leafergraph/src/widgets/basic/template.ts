/**
 * 基础 Widget 生命周期模板模块。
 *
 * @remarks
 * 负责为内建控件提供可复用的生命周期控制基类与通用工具。
 */

import type {
  NodeBaseWidgetOptions,
  NodeRuntimeState,
  NodeSliderWidgetOptions,
  NodeWidgetOptionItem,
  NodeWidgetSpec
} from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../api/plugin";
import type {
  LeaferGraphWidgetInteractionBinding
} from "../widget_interaction";
import type {
  BasicWidgetLifecycle,
  BasicWidgetLifecycleState,
  BasicWidgetTheme,
  ResolvedLinearRange,
  ResolvedTextDisplay,
  WidgetAnchorTarget
} from "./types";

/**
 * 单个基础 Widget 的生命周期控制模板。
 * 子类只需实现“如何创建状态”和“如何同步值/主题”，不用重复写 mount/update/destroy 模板。
 */
export abstract class BasicWidgetController<
  TOptions extends NodeBaseWidgetOptions,
  TState extends BasicWidgetLifecycleState
> {
  createLifecycle(): BasicWidgetLifecycle<TState> {
    return {
      mount: (context) => {
        const state = this.mountState(context);
        state.syncTheme(context);
        state.syncValue(context, context.value);
        return state;
      },
      update: (state, context, newValue) => {
        if (!state) {
          return;
        }

        state.syncTheme(context);
        state.syncValue(context, newValue);
      },
      destroy: (state) => {
        if (!state) {
          return;
        }

        while (state.cleanups.length) {
          state.cleanups.pop()?.();
        }
      }
    };
  }

  protected abstract mountState(context: LeaferGraphWidgetRendererContext): TState;

  protected resolveOptions(widget: NodeWidgetSpec): TOptions {
    return (widget.options ?? {}) as TOptions;
  }

  protected resolveTheme(context: LeaferGraphWidgetRendererContext): BasicWidgetTheme {
    return context.theme.tokens;
  }

  protected resolveDisabled(options: NodeBaseWidgetOptions | undefined): boolean {
    return Boolean(options?.disabled);
  }

  protected addCleanup(
    state: BasicWidgetLifecycleState,
    cleanup?: LeaferGraphWidgetInteractionBinding | (() => void) | null
  ): void {
    if (!cleanup) {
      return;
    }

    if (typeof cleanup === "function") {
      state.cleanups.push(cleanup);
      return;
    }

    state.cleanups.push(() => {
      cleanup.destroy();
    });
  }

  protected resolveLabel(
    widget: NodeWidgetSpec,
    options?: NodeBaseWidgetOptions
  ): string {
    const explicitLabel = options?.label?.trim();
    if (explicitLabel) {
      return explicitLabel;
    }

    const normalized = widget.name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim();

    if (!normalized) {
      return "Widget";
    }

    return normalized.replace(/\b\w/g, (value) => value.toUpperCase());
  }

  protected formatWidgetValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "";
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.formatWidgetValue(item)).join(", ");
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[object]";
      }
    }

    return String(value);
  }

  protected resolveTextDisplay(
    value: unknown,
    placeholder?: string
  ): ResolvedTextDisplay {
    const text = this.formatWidgetValue(value);
    if (text) {
      return {
        text,
        placeholder: false
      };
    }

    return {
      text: placeholder?.trim() || "-",
      placeholder: true
    };
  }

  protected resolveNodeAccent(node: NodeRuntimeState, theme: BasicWidgetTheme): string {
    const accent = node.properties["accent"];
    return typeof accent === "string" && accent.trim() ? accent : theme.accentFallback;
  }

  protected resolveFocusKey(context: LeaferGraphWidgetRendererContext): string {
    return `${context.node.id}:${context.widgetIndex}`;
  }

  protected isReservedWidgetKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey) {
      return true;
    }

    switch (event.key) {
      case " ":
      case "Enter":
      case "Escape":
      case "Delete":
      case "Backspace":
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
        return true;
      default:
        return false;
    }
  }

  protected resolveOptionItems(
    items: Array<string | NodeWidgetOptionItem> | undefined,
    fallbackValue?: unknown
  ): NodeWidgetOptionItem[] {
    const resolved =
      items?.map((item) => {
        if (typeof item === "string") {
          const text = item.trim() || "Option";
          return {
            label: text,
            value: text
          };
        }

        const label = item.label?.trim() || item.value?.trim() || "Option";
        const value = item.value?.trim() || label;
        return {
          label,
          value,
          disabled: Boolean(item.disabled),
          description: item.description?.trim() || undefined
        } satisfies NodeWidgetOptionItem;
      }) ?? [];

    if (resolved.length) {
      return resolved;
    }

    const text = this.formatWidgetValue(fallbackValue) || "Option";
    return [{ label: text, value: text }];
  }

  protected resolveSelectedOption(
    value: unknown,
    options: NodeWidgetOptionItem[]
  ): NodeWidgetOptionItem {
    const text = this.formatWidgetValue(value);
    return options.find((item) => item.value === text) ?? options[0];
  }

  protected resolveSelectedOptionIndex(
    value: unknown,
    options: NodeWidgetOptionItem[]
  ): number {
    const text = this.formatWidgetValue(value);
    const index = options.findIndex((item) => item.value === text);
    return index >= 0 ? index : 0;
  }

  protected resolveNextEnabledOptionIndex(
    currentIndex: number,
    options: NodeWidgetOptionItem[],
    delta: 1 | -1
  ): number {
    if (!options.length) {
      return currentIndex;
    }

    let nextIndex = currentIndex;
    for (let count = 0; count < options.length; count += 1) {
      nextIndex = (nextIndex + delta + options.length) % options.length;
      if (!options[nextIndex].disabled) {
        return nextIndex;
      }
    }

    return currentIndex;
  }

  protected resolveWidgetAnchorClientPoint(target: WidgetAnchorTarget): {
    x: number;
    y: number;
  } {
    const appBounds = target.app?.clientBounds ?? target.app?.tree?.clientBounds;
    const transform = target.worldTransform;
    const scaleX = Math.abs(transform?.scaleX ?? transform?.a ?? 1);
    const scaleY = Math.abs(transform?.scaleY ?? transform?.d ?? 1);
    const width = target.width ?? 0;
    const height = target.height ?? 0;
    const left = (transform?.e ?? 0) + (appBounds?.x ?? 0);
    const top = (transform?.f ?? 0) + (appBounds?.y ?? 0);

    return {
      x: left + (width * scaleX) / 2,
      y: top + height * scaleY
    };
  }

  protected resolveLinearRange(
    options: NodeSliderWidgetOptions | undefined
  ): ResolvedLinearRange {
    const rawMin = options?.min;
    const rawMax = options?.max;
    const rawStep = options?.step;
    const min = Number.isFinite(rawMin) ? Number(rawMin) : 0;
    const max = Number.isFinite(rawMax) ? Number(rawMax) : 1;
    const safeMax = max > min ? max : min + 1;
    const step =
      Number.isFinite(rawStep) && Number(rawStep) > 0
        ? Number(rawStep)
        : (safeMax - min) / 100;

    return {
      min,
      max: safeMax,
      step
    };
  }

  protected clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }

  protected roundToStep(value: number, range: ResolvedLinearRange): number {
    const steps = Math.round((value - range.min) / range.step);
    const next = range.min + steps * range.step;
    return this.clampNumber(next, range.min, range.max);
  }

  protected resolveSliderProgress(
    value: unknown,
    range: ResolvedLinearRange
  ): number {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return (
      this.clampNumber(numeric, range.min, range.max) - range.min
    ) / Math.max(range.max - range.min, 0.00001);
  }

  protected resolveSliderValue(
    progress: number,
    range: ResolvedLinearRange
  ): number {
    const numeric = range.min + progress * (range.max - range.min);
    return this.roundToStep(numeric, range);
  }

  protected resolveSliderDisplayValue(
    value: unknown,
    range: ResolvedLinearRange,
    options: NodeSliderWidgetOptions,
    preferStaticDisplayValue: boolean
  ): string {
    if (preferStaticDisplayValue && typeof options.displayValue === "string") {
      return options.displayValue;
    }

    const numeric = typeof value === "number" ? value : Number(value);
    const safeValue = Number.isFinite(numeric) ? numeric : range.min;

    if (typeof options.formatValue === "function") {
      return options.formatValue(safeValue);
    }

    if (
      typeof options.formatValue === "string" &&
      options.formatValue.includes("{value}")
    ) {
      return options.formatValue.replaceAll("{value}", String(safeValue));
    }

    if (Math.abs(range.step) >= 1) {
      return String(Math.round(safeValue));
    }

    return safeValue.toFixed(2);
  }
}

/** 统一请求宿主刷新当前 Widget 所在画布。 */
export function runtimeRequestRender(context: LeaferGraphWidgetRendererContext): void {
  context.requestRender();
}
