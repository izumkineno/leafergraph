/**
 * Leafer 调试配置模块。
 *
 * @remarks
 * 负责解析 editor 侧的调试开关、localStorage 持久化和对画布实例的调试设置投影。
 */
import { Debug } from "leafer-ui";

/** Leafer Debug `showBounds` 的 editor 侧展示模式。 */
export type EditorLeaferDebugShowBoundsMode = "off" | "bounds" | "hit";

/** editor 持久化的 Leafer Debug 设置。 */
export interface EditorLeaferDebugSettings {
  enabled: boolean;
  showWarn: boolean;
  showRepaint: boolean;
  showBoundsMode: EditorLeaferDebugShowBoundsMode;
  filter: string[];
  exclude: string[];
}

export const EDITOR_LEAFER_DEBUG_STORAGE_KEY =
  "leafergraph.editor.leafer-debug";

const DEFAULT_EDITOR_LEAFER_DEBUG_SETTINGS: Readonly<EditorLeaferDebugSettings> = {
  enabled: false,
  showWarn: true,
  showRepaint: false,
  showBoundsMode: "off",
  filter: [],
  exclude: []
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isShowBoundsMode(value: unknown): value is EditorLeaferDebugShowBoundsMode {
  return value === "off" || value === "bounds" || value === "hit";
}

function normalizeTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function cloneDefaultSettings(): EditorLeaferDebugSettings {
  return {
    enabled: DEFAULT_EDITOR_LEAFER_DEBUG_SETTINGS.enabled,
    showWarn: DEFAULT_EDITOR_LEAFER_DEBUG_SETTINGS.showWarn,
    showRepaint: DEFAULT_EDITOR_LEAFER_DEBUG_SETTINGS.showRepaint,
    showBoundsMode: DEFAULT_EDITOR_LEAFER_DEBUG_SETTINGS.showBoundsMode,
    filter: [],
    exclude: []
  };
}

/** 创建一份默认 Leafer Debug 设置副本。 */
export function createDefaultEditorLeaferDebugSettings(): EditorLeaferDebugSettings {
  return cloneDefaultSettings();
}

/** 归一化任意输入值，得到稳定可持久化的 Leafer Debug 设置。 */
export function normalizeEditorLeaferDebugSettings(
  value: unknown
): EditorLeaferDebugSettings {
  const defaults = cloneDefaultSettings();
  if (!isPlainObject(value)) {
    return defaults;
  }

  return {
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : defaults.enabled,
    showWarn:
      typeof value.showWarn === "boolean" ? value.showWarn : defaults.showWarn,
    showRepaint:
      typeof value.showRepaint === "boolean"
        ? value.showRepaint
        : defaults.showRepaint,
    showBoundsMode: isShowBoundsMode(value.showBoundsMode)
      ? value.showBoundsMode
      : defaults.showBoundsMode,
    filter: normalizeTypeList(value.filter),
    exclude: normalizeTypeList(value.exclude)
  };
}

/** 读取浏览器持久化的初始 Leafer Debug 设置。 */
export function resolveInitialEditorLeaferDebugSettings(): EditorLeaferDebugSettings {
  if (typeof window === "undefined" || !window.localStorage) {
    return cloneDefaultSettings();
  }

  const rawValue = window.localStorage.getItem(EDITOR_LEAFER_DEBUG_STORAGE_KEY);
  if (!rawValue) {
    return cloneDefaultSettings();
  }

  try {
    return normalizeEditorLeaferDebugSettings(JSON.parse(rawValue));
  } catch {
    return cloneDefaultSettings();
  }
}

/** 把当前 Leafer Debug 设置序列化为 JSON。 */
export function serializeEditorLeaferDebugSettings(
  settings: EditorLeaferDebugSettings
): string {
  return JSON.stringify({
    enabled: settings.enabled,
    showWarn: settings.showWarn,
    showRepaint: settings.showRepaint,
    showBoundsMode: settings.showBoundsMode,
    filter: [...settings.filter],
    exclude: [...settings.exclude]
  });
}

/** 基于当前设置和 patch 生成新的归一化结果。 */
export function mergeEditorLeaferDebugSettings(
  current: EditorLeaferDebugSettings,
  patch: Partial<EditorLeaferDebugSettings>
): EditorLeaferDebugSettings {
  return normalizeEditorLeaferDebugSettings({
    ...current,
    ...patch
  });
}

/** 解析 UI 输入框中的逗号分隔类型列表。 */
export function parseEditorLeaferDebugTypeListInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** 把类型列表格式化为适合输入框展示的字符串。 */
export function formatEditorLeaferDebugTypeList(
  value: readonly string[]
): string {
  return value.join(", ");
}

/** 把 editor 侧设置直接投影到 Leafer Debug 全局运行时。 */
export function applyLeaferDebugSettings(
  settings: EditorLeaferDebugSettings
): void {
  const debugRuntime = Debug as unknown as {
    enable: boolean;
    showWarn: boolean;
    showRepaint: boolean;
    showBounds: boolean | "hit";
    filter?: string | string[];
    exclude?: string | string[];
  };

  debugRuntime.enable = settings.enabled;
  debugRuntime.showWarn = settings.showWarn;
  debugRuntime.showRepaint = settings.showRepaint;
  debugRuntime.showBounds =
    settings.showBoundsMode === "hit"
      ? "hit"
      : settings.showBoundsMode === "bounds";
  debugRuntime.filter = settings.filter.length > 0 ? [...settings.filter] : undefined;
  debugRuntime.exclude =
    settings.exclude.length > 0 ? [...settings.exclude] : undefined;
}
