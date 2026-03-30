/** fitView 默认内边距。 */
export const DEFAULT_FIT_VIEW_PADDING = 64;

/** 画布视口缩放下限。 */
export const VIEWPORT_MIN_SCALE = 0.2;

/** 画布视口缩放上限。 */
export const VIEWPORT_MAX_SCALE = 4;
export type {
  LeaferGraphDataFlowAnimationStyleConfig,
  LeaferGraphNodeShellStyleConfig,
  NodeShellLayoutMetrics,
  NodeShellRenderTheme
} from "@leafergraph/theme/graph";
export {
  NODE_SHELL_LAYOUT_METRICS,
  SLOT_TYPE_FILL_MAP,
  createDefaultDataFlowAnimationStyleConfig,
  createDefaultNodeShellStyleConfig,
  createDisabledDataFlowAnimationStyleConfig,
  resolveDefaultCanvasBackground,
  resolveDefaultLinkStroke,
  resolveDefaultNodeShellRenderTheme,
  resolveDefaultSelectedStroke
} from "@leafergraph/theme/graph";
