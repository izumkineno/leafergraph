import {
  DEFAULT_FIT_VIEW_PADDING,
  VIEWPORT_MAX_SCALE,
  VIEWPORT_MIN_SCALE
} from "../graph";
import type {
  LeaferGraphLeaferConfig,
  NormalizedLeaferGraphLeaferConfig
} from "./types";

interface NormalizeLeaferConfigOptions {
  defaultFitPadding?: number;
  defaultUseOfficialTextEditor?: boolean;
}

/** 返回一份完整的默认 Leafer 配置。 */
export function resolveDefaultLeaferGraphLeaferConfig(): NormalizedLeaferGraphLeaferConfig {
  return {
    app: {
      pixelSnap: true,
      usePartRender: true,
      usePartLayout: true
    },
    tree: {},
    viewport: {
      zoom: {
        min: VIEWPORT_MIN_SCALE,
        max: VIEWPORT_MAX_SCALE
      },
      move: {
        holdSpaceKey: true,
        holdMiddleKey: true,
        scroll: true
      }
    },
    view: {
      fitPadding: DEFAULT_FIT_VIEW_PADDING
    },
    editor: {},
    textEditor: {
      useOfficialTextEditor: true
    },
    resize: {},
    state: {},
    find: {},
    flow: {}
  };
}

/** 把调用方传入的 Leafer 配置补齐为稳定可消费结构。 */
export function normalizeLeaferGraphLeaferConfig(
  config?: LeaferGraphLeaferConfig,
  options: NormalizeLeaferConfigOptions = {}
): NormalizedLeaferGraphLeaferConfig {
  const defaults = resolveDefaultLeaferGraphLeaferConfig();
  const fitPadding = options.defaultFitPadding ?? defaults.view.fitPadding;
  const useOfficialTextEditor =
    options.defaultUseOfficialTextEditor ??
    defaults.textEditor.useOfficialTextEditor;

  return {
    app: {
      pixelSnap: config?.app?.pixelSnap ?? defaults.app.pixelSnap,
      usePartRender: config?.app?.usePartRender ?? defaults.app.usePartRender,
      usePartLayout: config?.app?.usePartLayout ?? defaults.app.usePartLayout,
      raw: config?.app?.raw
    },
    tree: {
      raw: config?.tree?.raw
    },
    viewport: {
      zoom: {
        min: config?.viewport?.zoom?.min ?? defaults.viewport.zoom.min,
        max: config?.viewport?.zoom?.max ?? defaults.viewport.zoom.max
      },
      move: {
        holdSpaceKey:
          config?.viewport?.move?.holdSpaceKey ??
          defaults.viewport.move.holdSpaceKey,
        holdMiddleKey:
          config?.viewport?.move?.holdMiddleKey ??
          defaults.viewport.move.holdMiddleKey,
        scroll:
          config?.viewport?.move?.scroll ?? defaults.viewport.move.scroll
      },
      raw: config?.viewport?.raw
    },
    view: {
      fitPadding: config?.view?.fitPadding ?? fitPadding,
      raw: config?.view?.raw
    },
    editor: {
      raw: config?.editor?.raw
    },
    textEditor: {
      useOfficialTextEditor:
        config?.textEditor?.useOfficialTextEditor ?? useOfficialTextEditor,
      raw: config?.textEditor?.raw
    },
    resize: {
      raw: config?.resize?.raw
    },
    state: {
      raw: config?.state?.raw
    },
    find: {
      raw: config?.find?.raw
    },
    flow: {
      raw: config?.flow?.raw
    }
  };
}
