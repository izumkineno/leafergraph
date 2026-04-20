/**
 * 右键菜单子菜单的触发方式。
 *
 * @remarks
 * 这组值控制子菜单主要依赖 hover 还是 click 展开，
 * 供不同宿主在触摸屏或桌面环境中调整交互习惯。
 */
export type LeaferContextMenuSubmenuTriggerMode = "hover" | "click" | "hover+click";

/**
 * 子菜单行为配置。
 */
export interface LeaferContextMenuSubmenuConfig {
  /** 子菜单的默认触发方式。 */
  triggerMode?: LeaferContextMenuSubmenuTriggerMode;
  /** 鼠标进入后延迟多久展开子菜单，单位毫秒。 */
  openDelay?: number;
  /** 鼠标离开后延迟多久关闭子菜单，单位毫秒。 */
  closeDelay?: number;
}

/**
 * 右键菜单运行时配置。
 */
export interface LeaferContextMenuConfig {
  /** 全局子菜单行为配置。 */
  submenu?: LeaferContextMenuSubmenuConfig;
}

/**
 * 归一化后的子菜单行为配置。
 */
export interface NormalizedLeaferContextMenuSubmenuConfig {
  /** 最终生效的子菜单触发方式。 */
  triggerMode: LeaferContextMenuSubmenuTriggerMode;
  /** 最终生效的展开延迟。 */
  openDelay: number;
  /** 最终生效的关闭延迟。 */
  closeDelay: number;
}

/**
 * 归一化后的右键菜单配置。
 */
export interface NormalizedLeaferContextMenuConfig {
  /** 已补齐默认值的子菜单行为配置。 */
  submenu: NormalizedLeaferContextMenuSubmenuConfig;
}
