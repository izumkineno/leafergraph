import type { LeaferGraphThemePresetId } from "../types";
import { DEFAULT_THEME_PRESET_ID, defaultThemePreset } from "./default_preset";
import type { LeaferGraphThemePreset } from "./types";

const themePresetRegistry = new Map<LeaferGraphThemePresetId, LeaferGraphThemePreset>([
  [DEFAULT_THEME_PRESET_ID, defaultThemePreset]
]);

/**
 *  注册一个命名主题 preset。
 *
 * @param preset - 预设。
 * @returns 用于撤销当前注册的清理函数。
 */
export function registerThemePreset(
  preset: LeaferGraphThemePreset
): LeaferGraphThemePreset {
  themePresetRegistry.set(preset.id, preset);
  return preset;
}

/**
 *  卸载一个命名主题 preset，默认 preset 不允许被移除。
 *
 * @param presetId - 预设 ID。
 * @returns 对应的判断结果。
 */
export function unregisterThemePreset(
  presetId: LeaferGraphThemePresetId
): boolean {
  if (presetId === DEFAULT_THEME_PRESET_ID) {
    return false;
  }

  return themePresetRegistry.delete(presetId);
}

/**
 *  读取一个已注册的主题 preset。
 *
 * @param presetId - 预设 ID。
 * @returns 处理后的结果。
 */
export function getThemePreset(
  presetId: LeaferGraphThemePresetId
): LeaferGraphThemePreset | undefined {
  return themePresetRegistry.get(presetId);
}

/**
 *  列出当前全部已注册主题 preset。
 *
 * @returns 收集到的结果列表。
 */
export function listThemePresets(): LeaferGraphThemePreset[] {
  return [...themePresetRegistry.values()];
}

/**
 *  按 id 解析主题 preset，不存在时回退到默认 preset。
 *
 * @param presetId - 预设 ID。
 * @returns 处理后的结果。
 */
export function resolveThemePreset(
  presetId: LeaferGraphThemePresetId = DEFAULT_THEME_PRESET_ID
): LeaferGraphThemePreset {
  return themePresetRegistry.get(presetId) ?? defaultThemePreset;
}
