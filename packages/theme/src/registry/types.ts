/**
 * 主题注册表与 preset 契约模块。
 *
 * @remarks
 * 负责定义完整主题 bundle 与命名 preset 的最小结构，
 * 供主题仓库、宿主和外部扩展统一注册和读取。
 */

import type { LeaferGraphThemeMode, LeaferGraphThemePresetId } from "../types";
import type { LeaferGraphWidgetThemeTokens } from "../widget/types";
import type { LeaferGraphGraphThemeTokens } from "../graph/types";
import type { LeaferGraphContextMenuThemeTokens } from "../context-menu/types";

/**
 * 单个主题模式下的完整主题 bundle。
 */
export interface LeaferGraphThemeBundle {
  /** Widget 层主题 token。 */
  widget: LeaferGraphWidgetThemeTokens;
  /** 图节点和连线层主题 token。 */
  graph: LeaferGraphGraphThemeTokens;
  /** DOM 右键菜单层主题 token。 */
  contextMenu: LeaferGraphContextMenuThemeTokens;
}

/**
 * 命名主题 preset。
 *
 * @remarks
 * 一个 preset 需要同时给出 light / dark 两套 bundle，
 * 以保证宿主切换主题模式时不需要重新拼接残缺 token。
 */
export interface LeaferGraphThemePreset {
  /** preset 稳定 ID。 */
  id: LeaferGraphThemePresetId;
  /** 面向用户展示的 preset 名称。 */
  label: string;
  /** 可选描述。 */
  description?: string;
  /** 各主题模式对应的完整 bundle。 */
  modes: Record<LeaferGraphThemeMode, LeaferGraphThemeBundle>;
}
