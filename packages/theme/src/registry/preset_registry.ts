import type { LeaferGraphThemePresetId } from "../types";
import { DEFAULT_THEME_PRESET_ID, defaultThemePreset } from "./default_preset";
import type { LeaferGraphThemePreset } from "./types";

const themePresetRegistry = new Map<LeaferGraphThemePresetId, LeaferGraphThemePreset>([
  [DEFAULT_THEME_PRESET_ID, defaultThemePreset]
]);

/** 注册一个命名主题 preset。 */
export function registerThemePreset(
  preset: LeaferGraphThemePreset
): LeaferGraphThemePreset {
  themePresetRegistry.set(preset.id, preset);
  return preset;
}

/** 卸载一个命名主题 preset，默认 preset 不允许被移除。 */
export function unregisterThemePreset(
  presetId: LeaferGraphThemePresetId
): boolean {
  if (presetId === DEFAULT_THEME_PRESET_ID) {
    return false;
  }

  return themePresetRegistry.delete(presetId);
}

/** 读取一个已注册的主题 preset。 */
export function getThemePreset(
  presetId: LeaferGraphThemePresetId
): LeaferGraphThemePreset | undefined {
  return themePresetRegistry.get(presetId);
}

/** 列出当前全部已注册主题 preset。 */
export function listThemePresets(): LeaferGraphThemePreset[] {
  return [...themePresetRegistry.values()];
}

/** 按 id 解析主题 preset，不存在时回退到默认 preset。 */
export function resolveThemePreset(
  presetId: LeaferGraphThemePresetId = DEFAULT_THEME_PRESET_ID
): LeaferGraphThemePreset {
  return themePresetRegistry.get(presetId) ?? defaultThemePreset;
}
