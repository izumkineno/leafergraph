import type { LeaferGraphThemeMode, LeaferGraphThemePresetId } from "../types";
import type { LeaferGraphWidgetThemeTokens } from "../widget/types";
import type { LeaferGraphGraphThemeTokens } from "../graph/types";
import type { LeaferGraphContextMenuThemeTokens } from "../context-menu/types";

/** 单个模式下的完整主题 bundle。 */
export interface LeaferGraphThemeBundle {
  widget: LeaferGraphWidgetThemeTokens;
  graph: LeaferGraphGraphThemeTokens;
  contextMenu: LeaferGraphContextMenuThemeTokens;
}

/** 命名主题 preset。 */
export interface LeaferGraphThemePreset {
  id: LeaferGraphThemePresetId;
  label: string;
  description?: string;
  modes: Record<LeaferGraphThemeMode, LeaferGraphThemeBundle>;
}
