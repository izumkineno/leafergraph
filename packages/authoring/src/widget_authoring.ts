import type { NodeRuntimeState, NodeWidgetSpec } from "@leafergraph/node";
import type {
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetRendererContext,
  LeaferGraphWidgetThemeContext
} from "leafergraph";
import type { Group } from "leafer-ui";

import {
  assertNonEmptyText,
  type WidgetState
} from "./shared.js";

export interface DevWidgetMeta {
  type: string;
  title?: string;
  description?: string;
  normalize?(value: unknown, spec?: NodeWidgetSpec): unknown;
  serialize?(value: unknown, spec?: NodeWidgetSpec): unknown;
}

export interface DevWidgetContext<TValue = unknown> {
  raw: LeaferGraphWidgetRendererContext;
  ui: typeof import("leafer-ui");
  group: Group;
  node: NodeRuntimeState;
  widget: NodeWidgetSpec;
  widgetIndex: number;
  value: TValue;
  bounds: LeaferGraphWidgetBounds;
  theme: LeaferGraphWidgetThemeContext;
  editing: LeaferGraphWidgetEditingContext;
  setValue(nextValue: TValue): void;
  commitValue(nextValue?: TValue): void;
  requestRender(): void;
  emitAction(action: string, param?: unknown, options?: Record<string, unknown>): boolean;
}

export abstract class BaseWidget<
  TValue = unknown,
  TState extends WidgetState = WidgetState
> {
  static meta: DevWidgetMeta;

  mount?(ctx: DevWidgetContext<TValue>): TState | void;
  update?(state: TState | void, ctx: DevWidgetContext<TValue>, nextValue: TValue): void;
  destroy?(state: TState | void, ctx: DevWidgetContext<TValue>): void;
}

export interface DevWidgetClass<
  TValue = unknown,
  TState extends WidgetState = WidgetState
> {
  new (): BaseWidget<TValue, TState>;
  readonly meta: DevWidgetMeta;
}

interface AuthoringWidgetRuntime<
  TValue = unknown,
  TState extends WidgetState = WidgetState
> extends WidgetState {
  instance: BaseWidget<TValue, TState>;
  state: TState | void;
}

export function defineAuthoringWidget<
  TValue = unknown,
  TState extends WidgetState = WidgetState
>(WidgetCtor: DevWidgetClass<TValue, TState>): LeaferGraphWidgetEntry {
  const meta = normalizeWidgetMeta(WidgetCtor.meta);
  const renderer: LeaferGraphWidgetLifecycle<
    AuthoringWidgetRuntime<TValue, TState>
  > = {
    mount(context: LeaferGraphWidgetRendererContext) {
      const instance = new WidgetCtor();
      const runtime = {
        instance,
        state: instance.mount?.(createWidgetContext<TValue>(context))
      };

      return runtime;
    },
    update(runtime, context: LeaferGraphWidgetRendererContext, newValue: unknown) {
      runtime?.instance.update?.(
        runtime.state,
        createWidgetContext<TValue>(context, newValue),
        newValue as TValue
      );
    },
    destroy(runtime, context: LeaferGraphWidgetRendererContext) {
      runtime?.instance.destroy?.(
        runtime.state,
        createWidgetContext<TValue>(context)
      );
    }
  };

  return {
    type: meta.type,
    title: meta.title,
    description: meta.description,
    normalize: meta.normalize,
    serialize: meta.serialize,
    renderer
  };
}

function normalizeWidgetMeta(meta: DevWidgetMeta): DevWidgetMeta {
  return {
    type: assertNonEmptyText(meta.type, "Widget 类型"),
    title: meta.title?.trim() || undefined,
    description: meta.description?.trim() || undefined,
    normalize: meta.normalize,
    serialize: meta.serialize
  };
}

function createWidgetContext<TValue>(
  raw: LeaferGraphWidgetRendererContext,
  nextValue?: unknown
): DevWidgetContext<TValue> {
  const value = (nextValue ?? raw.value) as TValue;

  return {
    raw,
    ui: raw.ui,
    group: raw.group,
    node: raw.node,
    widget: raw.widget,
    widgetIndex: raw.widgetIndex,
    value,
    bounds: raw.bounds,
    theme: raw.theme,
    editing: raw.editing,
    setValue(nextValue) {
      raw.setValue(nextValue);
    },
    commitValue(nextValue) {
      raw.commitValue(nextValue);
    },
    requestRender() {
      raw.requestRender();
    },
    emitAction(action, param, options) {
      return raw.emitAction(action, param, options);
    }
  };
}
