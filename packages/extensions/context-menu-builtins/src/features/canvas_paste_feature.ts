import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition
} from "../types";
import { pasteClipboardFragment } from "../editing";

export const canvasPasteFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasPaste",
  register({
    clipboard,
    host,
    options,
    registerResolver,
    createLink,
    createNode,
    resolveShortcutLabel
  }) {
    return registerResolver("canvas-paste", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      const fragment = clipboard.getFragment();
      return [
        {
          key: "builtin-canvas-paste",
          label: "粘贴",
          shortcut: resolveShortcutLabel("graph.paste"),
          order: 40,
          disabled: !fragment?.nodes.length,
          onSelect() {
            if (!fragment?.nodes.length) {
              return;
            }

            const pasted = pasteClipboardFragment({
              fragment,
              host,
              createLink,
              createNode,
              context,
              offset: options.pasteOffset
            });

            if (isPromiseLike(pasted)) {
              return pasted.then(() => undefined);
            }
          }
        }
      ];
    });
  }
};

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
}
