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

/** 是否默认遵循系统 reduced motion 偏好。 */
export const DEFAULT_RESPECT_REDUCED_MOTION = true;

/** 默认最多保留的历史条数。 */
export const DEFAULT_HISTORY_MAX_ENTRIES = 100;

/** 默认在文档同步时清空历史。 */
export const DEFAULT_HISTORY_RESET_ON_DOCUMENT_SYNC = true;

/**
 *  返回一份完整的默认图级配置。
 *
 * @returns 处理后的结果。
 */
export function resolveDefaultLeaferGraphGraphConfig(): NormalizedLeaferGraphGraphConfig {
  return {
    fill: undefined,
    view: {
      defaultFitPadding: DEFAULT_FIT_VIEW_PADDING
    },
    runtime: {
      linkPropagationAnimation: DEFAULT_LINK_PROPAGATION_ANIMATION_PRESET,
      respectReducedMotion: DEFAULT_RESPECT_REDUCED_MOTION
    },
    history: {
      maxEntries: DEFAULT_HISTORY_MAX_ENTRIES,
      resetOnDocumentSync: DEFAULT_HISTORY_RESET_ON_DOCUMENT_SYNC
    }
  };
}

/**
 *  把调用方传入的图级配置补齐为稳定可消费结构。
 *
 * @param config - 当前配置。
 * @returns 处理后的结果。
 */
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
        defaults.runtime.linkPropagationAnimation,
      respectReducedMotion:
        config?.runtime?.respectReducedMotion ??
        defaults.runtime.respectReducedMotion
    },
    history: {
      maxEntries: Math.max(
        0,
        Math.floor(config?.history?.maxEntries ?? defaults.history.maxEntries)
      ),
      resetOnDocumentSync:
        config?.history?.resetOnDocumentSync ??
        defaults.history.resetOnDocumentSync
    }
  };
}
