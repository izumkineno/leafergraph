import type {
  LeaferContextMenuConfig,
  NormalizedLeaferContextMenuConfig
} from "./types";

/**
 *  返回一份完整的默认右键菜单配置。
 *
 * @returns 处理后的结果。
 */
export function resolveDefaultLeaferContextMenuConfig(): NormalizedLeaferContextMenuConfig {
  return {
    submenu: {
      triggerMode: "hover+click",
      openDelay: 0,
      closeDelay: 100
    }
  };
}

/**
 *  把调用方传入的右键菜单配置补齐为稳定可消费结构。
 *
 * @param config - 当前配置。
 * @returns 处理后的结果。
 */
export function normalizeLeaferContextMenuConfig(
  config?: LeaferContextMenuConfig
): NormalizedLeaferContextMenuConfig {
  const defaults = resolveDefaultLeaferContextMenuConfig();

  return {
    submenu: {
      triggerMode: config?.submenu?.triggerMode ?? defaults.submenu.triggerMode,
      openDelay: config?.submenu?.openDelay ?? defaults.submenu.openDelay,
      closeDelay: config?.submenu?.closeDelay ?? defaults.submenu.closeDelay
    }
  };
}
