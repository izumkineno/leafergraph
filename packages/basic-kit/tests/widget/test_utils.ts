import type { LeaferGraphWidgetRendererContext } from "@leafergraph/contracts";

type PointerListener = (event: any) => void;

class FakeGraphic {
  private readonly listeners = new Map<string, Set<PointerListener>>();

  constructor(init: Record<string, unknown> = {}) {
    Object.assign(this, init);
  }

  on(type: string, listener: PointerListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  off(type?: string | string[], listener?: PointerListener): void {
    if (!type) {
      this.listeners.clear();
      return;
    }

    const types = Array.isArray(type) ? type : [type];
    for (const item of types) {
      if (!listener) {
        this.listeners.delete(item);
        continue;
      }

      const listeners = this.listeners.get(item);
      listeners?.delete(listener);
      if (!listeners?.size) {
        this.listeners.delete(item);
      }
    }
  }

  emit(type: string, event: any): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

export class FakeRect extends FakeGraphic {}
export class FakeText extends FakeGraphic {}
export class FakePath extends FakeGraphic {}
export class FakeBox extends FakeGraphic {}

export class FakeGroup {
  readonly children: unknown[] = [];
  removeAllCalls = 0;

  add(items: unknown | unknown[]): void {
    if (Array.isArray(items)) {
      this.children.push(...items);
      return;
    }

    this.children.push(items);
  }

  removeAll(): void {
    this.removeAllCalls += 1;
    this.children.length = 0;
  }
}

export class FakeWidgetEditingContext {
  enabled = true;
  focusedWidgetKey: string | null = null;
  readonly focusBindings = new Map<
    string,
    {
      key: string;
      onFocusChange?: (focused: boolean) => void;
      onKeyDown?: (event: KeyboardEvent) => boolean;
    }
  >();
  readonly beginTextEditRequests: any[] = [];
  readonly openOptionsMenuRequests: any[] = [];
  closeActiveEditorCalls = 0;

  registerFocusableWidget(binding: {
    key: string;
    onFocusChange?: (focused: boolean) => void;
    onKeyDown?: (event: KeyboardEvent) => boolean;
  }): () => void {
    this.focusBindings.set(binding.key, binding);

    return () => {
      if (this.focusedWidgetKey === binding.key) {
        this.clearWidgetFocus();
      }

      this.focusBindings.delete(binding.key);
    };
  }

  focusWidget(key: string): void {
    if (this.focusedWidgetKey === key) {
      return;
    }

    if (this.focusedWidgetKey) {
      this.focusBindings.get(this.focusedWidgetKey)?.onFocusChange?.(false);
    }

    this.focusedWidgetKey = key;
    this.focusBindings.get(key)?.onFocusChange?.(true);
  }

  clearWidgetFocus(): void {
    if (!this.focusedWidgetKey) {
      return;
    }

    this.focusBindings.get(this.focusedWidgetKey)?.onFocusChange?.(false);
    this.focusedWidgetKey = null;
  }

  isWidgetFocused(key: string): boolean {
    return this.focusedWidgetKey === key;
  }

  dispatchKeyDown(event: KeyboardEvent): boolean {
    if (!this.focusedWidgetKey) {
      return false;
    }

    return this.focusBindings.get(this.focusedWidgetKey)?.onKeyDown?.(event) ?? false;
  }

  beginTextEdit(request: any): boolean {
    this.beginTextEditRequests.push(request);
    return true;
  }

  openOptionsMenu(request: any): boolean {
    this.openOptionsMenuRequests.push(request);
    return true;
  }

  closeActiveEditor(): void {
    this.closeActiveEditorCalls += 1;
  }
}

export function createThemeTokens(): Record<string, unknown> {
  return {
    labelFill: "#111827",
    valueFill: "#1f2937",
    disabledFill: "#6b7280",
    fieldRadius: 8,
    fieldShadow: "0 1px 2px rgba(15, 23, 42, 0.14)",
    focusRing: "#2563eb",
    fieldDisabledFill: "#f3f4f6",
    fieldDisabledStroke: "#d1d5db",
    fieldFill: "#ffffff",
    fieldStroke: "#cbd5e1",
    fieldHoverFill: "#f8fafc",
    fieldHoverStroke: "#94a3b8",
    fieldFocusFill: "#eff6ff",
    fieldFocusStroke: "#3b82f6",
    mutedFill: "#64748b",
    buttonPrimaryHoverFill: "#1d4ed8",
    buttonPrimaryFill: "#2563eb",
    buttonTextFill: "#ffffff",
    buttonGhostHoverFill: "#dbeafe",
    buttonGhostFill: "#eff6ff",
    buttonGhostTextFill: "#2563eb",
    buttonSecondaryHoverFill: "#e2e8f0",
    buttonSecondaryFill: "#f8fafc",
    trackFill: "#e2e8f0",
    thumbFill: "#ffffff",
    thumbStroke: "#94a3b8",
    menuFill: "#ffffff",
    menuStroke: "#cbd5e1",
    menuShadow: "0 12px 32px rgba(15, 23, 42, 0.16)",
    menuTextFill: "#0f172a",
    menuMutedFill: "#64748b",
    menuActiveFill: "#dbeafe",
    menuActiveTextFill: "#1d4ed8",
    separatorFill: "#e2e8f0",
    accentFallback: "#3b82f6",
    fontFamily: "Inter"
  };
}

export function createFakeUi(): typeof import("leafer-ui") {
  return {
    Rect: FakeRect,
    Text: FakeText,
    Path: FakePath,
    Box: FakeBox
  } as never;
}

export function createPointerEvent(overrides: Record<string, unknown> = {}): any {
  return {
    x: 0,
    y: 0,
    left: true,
    stopNow() {},
    stop() {},
    getLocalPoint() {
      return {
        x: 0,
        y: 0
      };
    },
    ...overrides
  };
}

export function createWidgetTestContext(options: {
  widgetType: string;
  widgetName?: string;
  value?: unknown;
  widgetOptions?: unknown;
  nodeId?: string;
  widgetIndex?: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  nodeLayoutX?: number;
  themeMode?: "light" | "dark";
}): {
  context: LeaferGraphWidgetRendererContext;
  group: FakeGroup;
  editing: FakeWidgetEditingContext;
  records: {
    setValues: unknown[];
    commitValues: unknown[];
    actions: Array<[string, unknown, Record<string, unknown> | undefined]>;
    renders: number;
  };
} {
  const group = new FakeGroup();
  const editing = new FakeWidgetEditingContext();
  const records = {
    setValues: [] as unknown[],
    commitValues: [] as unknown[],
    actions: [] as Array<[string, unknown, Record<string, unknown> | undefined]>,
    renders: 0
  };
  const widgetIndex = options.widgetIndex ?? 0;
  const value = options.value;
  const widget = {
    type: options.widgetType,
    name: options.widgetName ?? options.widgetType,
    value,
    options: options.widgetOptions
  };
  const node = {
    id: options.nodeId ?? "node-1",
    layout: {
      x: options.nodeLayoutX ?? 0
    },
    properties: {},
    widgets: [widget]
  };

  const context: LeaferGraphWidgetRendererContext = {
    ui: createFakeUi(),
    group: group as never,
    node: node as never,
    widget: widget as never,
    widgetIndex,
    value,
    bounds: options.bounds ?? {
      x: 0,
      y: 0,
      width: 160,
      height: 56
    },
    theme: {
      mode: options.themeMode ?? "light",
      tokens: createThemeTokens() as never
    },
    editing: editing as never,
    setValue(nextValue: unknown) {
      records.setValues.push(nextValue);
      (context as any).value = nextValue;
      (node.widgets[widgetIndex] as any).value = nextValue;
    },
    commitValue(nextValue: unknown) {
      records.commitValues.push(nextValue);
      (context as any).value = nextValue;
      (node.widgets[widgetIndex] as any).value = nextValue;
    },
    requestRender() {
      records.renders += 1;
    },
    emitAction(actionName: string, currentValue: unknown, meta?: Record<string, unknown>) {
      records.actions.push([actionName, currentValue, meta]);
      return true;
    }
  } as never;

  return {
    context,
    group,
    editing,
    records
  };
}
