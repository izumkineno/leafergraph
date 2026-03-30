import {
  normalizeLeaferGraphGraphConfig,
  resolveDefaultLeaferGraphGraphConfig
} from "./graph";
import {
  normalizeLeaferGraphLeaferConfig,
  resolveDefaultLeaferGraphLeaferConfig
} from "./leafer";
import type {
  LeaferGraphConfig,
  NormalizedLeaferGraphConfig
} from "./types";
import {
  normalizeLeaferGraphWidgetConfig,
  resolveDefaultLeaferGraphWidgetConfig
} from "./widget";
import {
  normalizeLeaferContextMenuConfig,
  resolveDefaultLeaferContextMenuConfig
} from "./context-menu";

/** 返回一份完整的默认主包配置。 */
export function resolveDefaultLeaferGraphConfig(): NormalizedLeaferGraphConfig {
  const graph = resolveDefaultLeaferGraphGraphConfig();
  const widget = resolveDefaultLeaferGraphWidgetConfig();
  const leafer = resolveDefaultLeaferGraphLeaferConfig();

  return {
    graph: {
      ...graph,
      view: {
        defaultFitPadding: leafer.view.fitPadding
      }
    },
    widget: {
      editing: {
        ...widget.editing,
        useOfficialTextEditor: leafer.textEditor.useOfficialTextEditor
      }
    },
    leafer
  };
}

/** 把调用方传入的主包配置补齐为稳定可消费结构。 */
export function normalizeLeaferGraphConfig(
  config?: LeaferGraphConfig
): NormalizedLeaferGraphConfig {
  const defaultGraph = resolveDefaultLeaferGraphGraphConfig();
  const defaultWidget = resolveDefaultLeaferGraphWidgetConfig();

  const fitPadding =
    config?.graph?.view?.defaultFitPadding ??
    config?.leafer?.view?.fitPadding ??
    defaultGraph.view.defaultFitPadding;
  const useOfficialTextEditor =
    config?.widget?.editing?.useOfficialTextEditor ??
    config?.leafer?.textEditor?.useOfficialTextEditor ??
    defaultWidget.editing.useOfficialTextEditor;

  const graph = normalizeLeaferGraphGraphConfig(config?.graph);
  const widget = normalizeLeaferGraphWidgetConfig(config?.widget, {
    defaultUseOfficialTextEditor: useOfficialTextEditor
  });
  const leafer = normalizeLeaferGraphLeaferConfig(config?.leafer, {
    defaultFitPadding: fitPadding,
    defaultUseOfficialTextEditor: useOfficialTextEditor
  });

  return {
    graph: {
      ...graph,
      view: {
        defaultFitPadding: fitPadding
      }
    },
    widget: {
      editing: {
        ...widget.editing,
        useOfficialTextEditor
      }
    },
    leafer: {
      ...leafer,
      view: {
        ...leafer.view,
        fitPadding
      },
      textEditor: {
        ...leafer.textEditor,
        useOfficialTextEditor
      }
    }
  };
}

export {
  normalizeLeaferContextMenuConfig,
  resolveDefaultLeaferContextMenuConfig
};
