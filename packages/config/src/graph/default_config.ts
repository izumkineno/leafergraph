import type {
  LeaferGraphGraphConfig,
  NormalizedLeaferGraphGraphConfig
} from "./types";

/** `graph.fitView()` 默认留白。 */
export const DEFAULT_FIT_VIEW_PADDING = 64;

/** 画布视口缩放下限。 */
export const VIEWPORT_MIN_SCALE = 0.2;

/** 画布视口缩放上限。 */
export const VIEWPORT_MAX_SCALE = 4;

/** 连线传播动画默认预设。 */
export const DEFAULT_LINK_PROPAGATION_ANIMATION_PRESET = "performance";

/** 返回一份完整的默认图级配置。 */
export function resolveDefaultLeaferGraphGraphConfig(): NormalizedLeaferGraphGraphConfig {
  return {
    fill: undefined,
    view: {
      defaultFitPadding: DEFAULT_FIT_VIEW_PADDING
    },
    runtime: {
      linkPropagationAnimation: DEFAULT_LINK_PROPAGATION_ANIMATION_PRESET
    }
  };
}

/** 把调用方传入的图级配置补齐为稳定可消费结构。 */
export function normalizeLeaferGraphGraphConfig(
  config?: LeaferGraphGraphConfig
): NormalizedLeaferGraphGraphConfig {
  const defaults = resolveDefaultLeaferGraphGraphConfig();

  return {
    fill: config?.fill,
    view: {
      defaultFitPadding:
        config?.view?.defaultFitPadding ?? defaults.view.defaultFitPadding
    },
    runtime: {
      linkPropagationAnimation:
        config?.runtime?.linkPropagationAnimation ??
        defaults.runtime.linkPropagationAnimation
    }
  };
}
