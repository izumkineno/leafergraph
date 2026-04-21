import { describe, expect, it } from "bun:test";
import {
  getThemePreset,
  listThemePresets,
  registerThemePreset,
  resolveThemePreset,
  unregisterThemePreset
} from "../src";
import { resolveDefaultWidgetTheme } from "../src/widget";
import { resolveDefaultGraphTheme } from "../src/graph";
import { resolveDefaultContextMenuTheme } from "../src/context-menu";

describe("@leafergraph/core/theme", () => {
  it("默认 preset 可被解析", () => {
    const preset = resolveThemePreset();
    expect(preset.id).toBe("default");
    expect(preset.modes.light.widget.labelFill).toBe(
      resolveDefaultWidgetTheme("light").labelFill
    );
    expect(preset.modes.dark.graph.canvasBackground).toBe(
      resolveDefaultGraphTheme("dark").canvasBackground
    );
    expect(preset.modes.light.contextMenu.background).toBe(
      resolveDefaultContextMenuTheme("light").background
    );
  });

  it("未知 preset 会回退到默认 preset", () => {
    expect(resolveThemePreset("missing").id).toBe("default");
  });

  it("支持注册与卸载外部 preset", () => {
    const preset = {
      id: "custom-test",
      label: "Custom Test",
      modes: {
        light: {
          widget: resolveDefaultWidgetTheme("light"),
          graph: resolveDefaultGraphTheme("light"),
          contextMenu: resolveDefaultContextMenuTheme("light")
        },
        dark: {
          widget: resolveDefaultWidgetTheme("dark"),
          graph: resolveDefaultGraphTheme("dark"),
          contextMenu: resolveDefaultContextMenuTheme("dark")
        }
      }
    } as const;

    registerThemePreset(preset);

    expect(getThemePreset("custom-test")?.label).toBe("Custom Test");
    expect(listThemePresets().some((entry) => entry.id === "custom-test")).toBe(
      true
    );

    expect(unregisterThemePreset("custom-test")).toBe(true);
    expect(getThemePreset("custom-test")).toBeUndefined();
  });

  it("默认 preset 不允许被卸载", () => {
    expect(unregisterThemePreset("default")).toBe(false);
    expect(resolveThemePreset("default").id).toBe("default");
  });
});
