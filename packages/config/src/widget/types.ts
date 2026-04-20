/**
 * Widget 编辑宿主配置。
 *
 * @remarks
 * 这组配置控制文本编辑器、候选菜单和整体编辑能力是否可用。
 */
export interface LeaferGraphWidgetEditingConfig {
  /** 是否启用统一 Widget 编辑宿主。 */
  enabled?: boolean;
  /** 是否优先接入官方文本编辑器。 */
  useOfficialTextEditor?: boolean;
  /** 是否允许打开离散选项菜单。 */
  allowOptionsMenu?: boolean;
}

/**
 * 兼容旧命名的类型别名。
 */
export type LeaferGraphWidgetEditingOptions = LeaferGraphWidgetEditingConfig;

/**
 * Widget 相关配置入口。
 */
export interface LeaferGraphWidgetConfig {
  /** Widget 编辑与交互配置。 */
  editing?: LeaferGraphWidgetEditingConfig;
}

/**
 * 归一化后的 Widget 编辑配置。
 */
export interface NormalizedLeaferGraphWidgetEditingConfig {
  /** 最终是否启用 Widget 编辑宿主。 */
  enabled: boolean;
  /** 最终是否启用官方文本编辑器。 */
  useOfficialTextEditor: boolean;
  /** 最终是否允许选项菜单。 */
  allowOptionsMenu: boolean;
}

/**
 * 归一化后的 Widget 配置。
 */
export interface NormalizedLeaferGraphWidgetConfig {
  /** 已补齐默认值的编辑配置。 */
  editing: NormalizedLeaferGraphWidgetEditingConfig;
}
