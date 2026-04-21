import type {
  LeaferGraphWidgetConfig,
  LeaferGraphWidgetEditingConfig,
  NormalizedLeaferGraphWidgetConfig,
  NormalizedLeaferGraphWidgetEditingConfig
} from "./types";

interface NormalizeWidgetConfigOptions {
  defaultUseOfficialTextEditor?: boolean;
}

/**
 *  返回一份完整的默认 Widget 编辑配置。
 *
 * @returns 处理后的结果。
 */
export function resolveDefaultLeaferGraphWidgetEditingConfig(): NormalizedLeaferGraphWidgetEditingConfig {
  return {
    enabled: true,
    useOfficialTextEditor: true,
    allowOptionsMenu: true
  };
}

/**
 *  返回一份完整的默认 Widget 配置。
 *
 * @returns 处理后的结果。
 */
export function resolveDefaultLeaferGraphWidgetConfig(): NormalizedLeaferGraphWidgetConfig {
  return {
    editing: resolveDefaultLeaferGraphWidgetEditingConfig()
  };
}

/**
 *  把调用方传入的 Widget 配置补齐为稳定可消费结构。
 *
 * @param config - 当前配置。
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
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
 * 真正的默认值真源已经迁到 `@leafergraph/core/config/widget`。
 *
 * @param mode - 模式。
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
export function resolveWidgetEditingOptions(
  mode: "light" | "dark",
  options?: LeaferGraphWidgetEditingConfig
): {
  themeMode: "light" | "dark";
  editing: NormalizedLeaferGraphWidgetEditingConfig;
} {
  return {
    themeMode: mode,
    editing: normalizeLeaferGraphWidgetConfig({ editing: options }).editing
  };
}
