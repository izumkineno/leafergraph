/** Widget 编辑宿主配置。 */
export interface LeaferGraphWidgetEditingConfig {
  enabled?: boolean;
  useOfficialTextEditor?: boolean;
  allowOptionsMenu?: boolean;
}

/** 兼容旧命名的类型别名。 */
export type LeaferGraphWidgetEditingOptions = LeaferGraphWidgetEditingConfig;

/** Widget 相关配置。 */
export interface LeaferGraphWidgetConfig {
  editing?: LeaferGraphWidgetEditingConfig;
}

/** 归一化后的 Widget 编辑配置。 */
export interface NormalizedLeaferGraphWidgetEditingConfig {
  enabled: boolean;
  useOfficialTextEditor: boolean;
  allowOptionsMenu: boolean;
}

/** 归一化后的 Widget 配置。 */
export interface NormalizedLeaferGraphWidgetConfig {
  editing: NormalizedLeaferGraphWidgetEditingConfig;
}
