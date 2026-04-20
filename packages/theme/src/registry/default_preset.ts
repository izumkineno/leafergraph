import type { LeaferGraphThemePreset } from "./types";
import { resolveDefaultWidgetTheme } from "../widget/default_theme";
import { resolveDefaultGraphTheme } from "../graph/default_theme";
import { resolveDefaultContextMenuTheme } from "../context-menu/default_theme";

/** workspace 内建的默认主题 preset。 */
export const DEFAULT_THEME_PRESET_ID = "default";

/** 默认主题 preset 真源。 */
export const defaultThemePreset: LeaferGraphThemePreset = {
  id: DEFAULT_THEME_PRESET_ID,
  label: "Default",
  description: "LeaferGraph workspace 默认主题预设",
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
};
