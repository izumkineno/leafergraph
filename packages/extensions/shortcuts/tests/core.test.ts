import { describe, expect, it } from "bun:test";
import {
  createShortcutController,
  createShortcutFunctionRegistry,
  createShortcutKeymapRegistry,
  formatShortcutLabel,
  matchShortcutEvent,
  normalizeShortcutChord
} from "../src";

describe("@leafergraph/extensions/shortcuts core", () => {
  it("功能注册表支持注册、查找、卸载与覆盖保护", () => {
    const registry = createShortcutFunctionRegistry();
    const cleanup = registry.register({
      id: "graph.fit-view",
      run() {}
    });

    expect(registry.get("graph.fit-view")).toBeDefined();
    expect(registry.list()).toHaveLength(1);
    expect(() =>
      registry.register({
        id: "graph.fit-view",
        run() {}
      })
    ).toThrow("快捷键功能已存在");

    cleanup();
    expect(registry.get("graph.fit-view")).toBeUndefined();
    expect(registry.unregister("graph.fit-view")).toBe(false);
  });

  it("按键注册表支持一对多绑定、卸载与重复绑定保护", () => {
    const registry = createShortcutKeymapRegistry();
    registry.register({
      id: "binding-a",
      functionId: "graph.delete-selection",
      shortcut: "Delete"
    });
    const cleanup = registry.register({
      id: "binding-b",
      functionId: "graph.delete-selection",
      shortcut: "Backspace"
    });

    expect(registry.listByFunctionId("graph.delete-selection").map((entry) => entry.id)).toEqual([
      "binding-a",
      "binding-b"
    ]);
    expect(() =>
      registry.register({
        id: "binding-a",
        functionId: "graph.delete-selection",
        shortcut: "Delete"
      })
    ).toThrow("快捷键绑定已存在");

    cleanup();
    expect(registry.listByFunctionId("graph.delete-selection").map((entry) => entry.id)).toEqual([
      "binding-a"
    ]);
  });

  it("支持 chord 归一化、事件匹配和标签格式化", () => {
    expect(normalizeShortcutChord(" mod + keya ")).toBe("Mod+KeyA");

    const matchedEvent = new KeyboardEvent("keydown", {
      code: "KeyA",
      ctrlKey: true
    });
    expect(
      matchShortcutEvent(matchedEvent, "Mod+KeyA", {
        platform: "windows"
      })
    ).toBe(true);

    expect(
      formatShortcutLabel("Mod+Shift+Enter", {
        platform: "windows"
      })
    ).toBe("Ctrl+Shift+Enter");
    expect(
      formatShortcutLabel("Mod+Shift+Enter", {
        platform: "mac"
      })
    ).toBe("⌘⇧Enter");
  });

  it("controller 会执行 preventDefault、stopPropagation 并调用目标功能", () => {
    const functionRegistry = createShortcutFunctionRegistry();
    const keymapRegistry = createShortcutKeymapRegistry();
    let runCount = 0;

    functionRegistry.register({
      id: "graph.fit-view",
      run() {
        runCount += 1;
      }
    });
    keymapRegistry.register({
      id: "fit",
      functionId: "graph.fit-view",
      shortcut: "KeyF"
    });

    const controller = createShortcutController({
      functionRegistry,
      keymapRegistry,
      platform: "windows"
    });

    const target = document.createElement("div");
    document.body.appendChild(target);
    const unbind = controller.bind(document);

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyF"
    });
    target.dispatchEvent(event);

    expect(runCount).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    expect(event.cancelBubble).toBe(true);

    unbind();
    controller.destroy();
    target.remove();
  });

  it("editable target、repeat 和自定义 guard 会阻止触发", () => {
    const functionRegistry = createShortcutFunctionRegistry();
    const keymapRegistry = createShortcutKeymapRegistry();
    let runCount = 0;
    let allowGuard = false;

    functionRegistry.register({
      id: "graph.select-all",
      run() {
        runCount += 1;
      }
    });
    keymapRegistry.register({
      id: "select-all",
      functionId: "graph.select-all",
      shortcut: "Mod+KeyA"
    });

    const controller = createShortcutController({
      functionRegistry,
      keymapRegistry,
      platform: "windows",
      guard: () => allowGuard
    });
    const unbind = controller.bind(document);

    const input = document.createElement("input");
    document.body.appendChild(input);
    const editableEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyA",
      ctrlKey: true
    });
    input.dispatchEvent(editableEvent);
    expect(runCount).toBe(0);

    allowGuard = true;
    const repeatedEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyA",
      ctrlKey: true,
      repeat: true
    });
    document.body.dispatchEvent(repeatedEvent);
    expect(runCount).toBe(0);

    const normalEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyA",
      ctrlKey: true
    });
    document.body.dispatchEvent(normalEvent);
    expect(runCount).toBe(1);

    unbind();
    controller.destroy();
    input.remove();
  });
});
