/** 子菜单触发方式。 */
export type LeaferContextMenuSubmenuTriggerMode = "hover" | "click" | "hover+click";

/** 子菜单行为配置。 */
export interface LeaferContextMenuSubmenuConfig {
  triggerMode?: LeaferContextMenuSubmenuTriggerMode;
  openDelay?: number;
  closeDelay?: number;
}

/** 右键菜单运行时配置。 */
export interface LeaferContextMenuConfig {
  submenu?: LeaferContextMenuSubmenuConfig;
}

/** 归一化后的子菜单行为配置。 */
export interface NormalizedLeaferContextMenuSubmenuConfig {
  triggerMode: LeaferContextMenuSubmenuTriggerMode;
  openDelay: number;
  closeDelay: number;
}

/** 归一化后的右键菜单配置。 */
export interface NormalizedLeaferContextMenuConfig {
  submenu: NormalizedLeaferContextMenuSubmenuConfig;
}
