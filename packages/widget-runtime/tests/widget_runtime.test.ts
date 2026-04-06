import { describe, expect, test } from "bun:test";

import {
  LeaferGraphWidgetRegistry,
  getLeaferGraphTextEditMeta,
  setLeaferGraphTextEditMeta,
  bindLinearWidgetDrag,
  bindPressWidgetInteraction,
  createDisabledWidgetEditingContext,
  createWidgetLifecycleRenderer,
  isWidgetInteractionTarget,
  resolveLinearWidgetProgressFromEvent,
  resolveWidgetEditingOptions,
  stopWidgetPointerEvent,
  type LeaferGraphWidgetEventSource,
  type LeaferGraphWidgetPointerEvent,
  type LeaferGraphWidgetRendererContext
} from "../src";

class FakeEventSource implements LeaferGraphWidgetEventSource {
  private readonly listeners = new Map<
    string,
    Set<(event: LeaferGraphWidgetPointerEvent) => void>
  >();

  on(type: string, listener: (event: LeaferGraphWidgetPointerEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  off(
    type?: string | string[],
    listener?: (event: LeaferGraphWidgetPointerEvent) => void
  ): void {
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

  emit(type: string, event: LeaferGraphWidgetPointerEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function createRendererContext(
  value: unknown = "before"
): LeaferGraphWidgetRendererContext {
  return {
    ui: {} as typeof import("leafer-ui"),
    group: {
      removeAll() {}
    } as never,
    node: {
      id: "node-1",
      widgets: [
        {
          type: "input",
          name: "label",
          value
        }
      ]
    } as never,
    widget: {
      type: "input",
      name: "label",
      value
    },
    widgetIndex: 0,
    value,
    bounds: {
      x: 0,
      y: 0,
      width: 120,
      height: 32
    },
    theme: {
      mode: "light",
      tokens: {} as never
    },
    editing: createDisabledWidgetEditingContext(),
    setValue() {},
    commitValue() {},
    requestRender() {},
    emitAction() {
      return true;
    }
  };
}

describe("widget_runtime", () => {
  test("LeaferGraphWidgetRegistry 应支持注册、覆盖保护与缺失态回退", () => {
    const fallbackCalls: string[] = [];
    const registry = new LeaferGraphWidgetRegistry((context) => {
      fallbackCalls.push(context.widget.type);
      return {
        destroy() {}
      };
    });

    registry.registerWidget({
      type: "input",
      title: "Input",
      renderer: () => ({
        destroy() {}
      })
    });

    expect(registry.hasWidget("input")).toBe(true);
    expect(registry.listWidgets()).toHaveLength(1);
    expect(() =>
      registry.registerWidget({
        type: "input",
        title: "Input",
        renderer: () => ({ destroy() {} })
      })
    ).toThrow("Widget 类型已存在");

    registry.registerWidget(
      {
        type: "input",
        title: "Input Overwrite",
        renderer: () => ({
          destroy() {}
        })
      },
      { overwrite: true }
    );

    expect(registry.getWidget("input")?.title).toBe("Input Overwrite");
    registry.resolveRenderer("missing")(createRendererContext("fallback"));
    expect(fallbackCalls).toEqual(["input"]);
  });

  test("createWidgetLifecycleRenderer 应适配 mount/update/destroy", () => {
    const calls: Array<[string, unknown]> = [];
    let removeAllCalls = 0;
    const renderer = createWidgetLifecycleRenderer({
      mount(context) {
        calls.push(["mount", context.value]);
        return { mounted: true };
      },
      update(state, context, newValue) {
        calls.push(["update", [state, context.value, newValue]]);
      },
      destroy(state, context) {
        calls.push(["destroy", [state, context.value]]);
      }
    });

    const context = createRendererContext("before");
    context.group = {
      removeAll() {
        removeAllCalls += 1;
      }
    } as never;

    const instance = renderer(context);
    instance?.update?.("after");
    instance?.destroy?.();

    expect(calls).toEqual([
      ["mount", "before"],
      ["update", [{ mounted: true }, "after", "after"]],
      ["destroy", [{ mounted: true }, "after"]]
    ]);
    expect(removeAllCalls).toBe(1);
  });

  test("bindPressWidgetInteraction 应绑定按压交互并支持销毁", () => {
    const hitArea = new FakeEventSource();
    const changes: Array<[string, boolean]> = [];
    let pressed = 0;
    let stopped = 0;

    const binding = bindPressWidgetInteraction({
      hitArea,
      onHoverChange(hovered) {
        changes.push(["hover", hovered]);
      },
      onPressChange(nextPressed) {
        changes.push(["press", nextPressed]);
      },
      onPress() {
        pressed += 1;
      }
    });

    const event: LeaferGraphWidgetPointerEvent = {
      x: 0,
      y: 0,
      stopNow() {
        stopped += 1;
      }
    };

    hitArea.emit("pointer.enter", event);
    hitArea.emit("pointer.down", event);
    hitArea.emit("pointer.up", event);
    hitArea.emit("pointer.leave", event);
    binding.destroy();
    hitArea.emit("pointer.down", event);

    expect(pressed).toBe(1);
    expect(stopped).toBe(1);
    expect(changes).toEqual([
      ["hover", true],
      ["press", true],
      ["press", false],
      ["hover", false]
    ]);
  });

  test("bindLinearWidgetDrag 应解析进度并在销毁后解绑", () => {
    const hitArea = new FakeEventSource();
    const values: number[] = [];
    let stopped = 0;

    const binding = bindLinearWidgetDrag({
      hitArea,
      group: {} as never,
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 20
      },
      getNodeX() {
        return 0;
      },
      onValue(progress) {
        values.push(progress);
      }
    });

    const event: LeaferGraphWidgetPointerEvent = {
      x: 50,
      y: 0,
      getLocalPoint() {
        return { x: 50, y: 0 };
      },
      stop() {
        stopped += 1;
      }
    };

    hitArea.emit("pointer.down", event);
    hitArea.emit("pointer.move", event);
    hitArea.emit("pointer.up", event);
    binding.destroy();
    hitArea.emit("pointer.down", event);

    expect(values).toEqual([0.5, 0.5, 0.5]);
    expect(stopped).toBe(3);
  });

  test("Widget helper 应保持纯工具语义", () => {
    expect(
      isWidgetInteractionTarget({
        name: "widget-hit-area"
      })
    ).toBe(true);
    expect(
      isWidgetInteractionTarget({
        name: "child",
        parent: {
          name: "widget-node-1-0"
        }
      })
    ).toBe(true);
    expect(
      resolveLinearWidgetProgressFromEvent(
        {
          x: 25,
          y: 0
        },
        {} as never,
        {
          x: 0,
          y: 0,
          width: 100,
          height: 20
        },
        () => 0
      )
    ).toBe(0.25);

    const reservedEvent: LeaferGraphWidgetPointerEvent = {
      x: 0,
      y: 0,
      stopNow() {
        reservedEvent.x += 1;
      }
    };
    stopWidgetPointerEvent(reservedEvent);
    expect(reservedEvent.x).toBe(1);

    expect(resolveWidgetEditingOptions("dark")).toEqual({
      themeMode: "dark",
      editing: {
        enabled: false,
        useOfficialTextEditor: true,
        allowOptionsMenu: true
      }
    });

    const disabled = createDisabledWidgetEditingContext();
    expect(disabled.enabled).toBe(false);
    expect(disabled.beginTextEdit({} as never)).toBe(false);
    expect(disabled.openOptionsMenu({} as never)).toBe(false);
    expect(disabled.isWidgetFocused("node-1:0")).toBe(false);
  });

  test("通用文本编辑元数据只会挂在显式标记的 Text 目标上", () => {
    const textTarget = {};

    expect(getLeaferGraphTextEditMeta(textTarget)).toBeNull();

    setLeaferGraphTextEditMeta(textTarget, {
      kind: "node-title",
      nodeId: "node-1"
    });

    expect(getLeaferGraphTextEditMeta(textTarget)).toEqual({
      kind: "node-title",
      nodeId: "node-1"
    });
  });
});
