import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type {
  LeaferGraphWidgetConfig,
  LeaferGraphWidgetEditingConfig,
  NormalizedLeaferGraphWidgetConfig,
  NormalizedLeaferGraphWidgetEditingConfig
} from "./types";

interface NormalizeWidgetConfigOptions {
  defaultUseOfficialTextEditor?: boolean;
}

/** 返回一份完整的默认 Widget 编辑配置。 */
export function resolveDefaultLeaferGraphWidgetEditingConfig(): NormalizedLeaferGraphWidgetEditingConfig {
  return {
    enabled: false,
    useOfficialTextEditor: true,
    allowOptionsMenu: true
  };
}

/** 返回一份完整的默认 Widget 配置。 */
export function resolveDefaultLeaferGraphWidgetConfig(): NormalizedLeaferGraphWidgetConfig {
  return {
    editing: resolveDefaultLeaferGraphWidgetEditingConfig()
  };
}

/** 把调用方传入的 Widget 配置补齐为稳定可消费结构。 */
export function normalizeLeaferGraphWidgetConfig(
  config?: LeaferGraphWidgetConfig,
  options: NormalizeWidgetConfigOptions = {}
): NormalizedLeaferGraphWidgetConfig {
  const defaults = resolveDefaultLeaferGraphWidgetEditingConfig();
  const defaultUseOfficialTextEditor =
    options.defaultUseOfficialTextEditor ?? defaults.useOfficialTextEditor;

  return {
    editing: {
      enabled: config?.editing?.enabled ?? defaults.enabled,
      useOfficialTextEditor:
        config?.editing?.useOfficialTextEditor ?? defaultUseOfficialTextEditor,
      allowOptionsMenu:
        config?.editing?.allowOptionsMenu ?? defaults.allowOptionsMenu
    }
  };
}

/**
 * 为当前主题模式解析一份稳定的 Widget 编辑配置。
 *
 * @remarks
 * 这个 helper 保留旧的返回结构，方便迁移期沿用已有调用约定；
 * 真正的默认值真源已经迁到 `@leafergraph/config/widget`。
 */
export function resolveWidgetEditingOptions(
  mode: LeaferGraphThemeMode,
  options?: LeaferGraphWidgetEditingConfig
): {
  themeMode: LeaferGraphThemeMode;
  editing: NormalizedLeaferGraphWidgetEditingConfig;
} {
  return {
    themeMode: mode,
    editing: normalizeLeaferGraphWidgetConfig({ editing: options }).editing
  };
}
