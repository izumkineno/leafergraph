import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition
} from "../types";
import { resolveContextAnchorPoint } from "../editing";

export const canvasPasteFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasPaste",
  register({
    editingController,
    registerResolver,
    createLink,
    createNode,
    resolveShortcutLabel
  }) {
    return registerResolver("canvas-paste", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      return [
        {
          key: "builtin-canvas-paste",
          label: "粘贴",
          shortcut: resolveShortcutLabel("graph.paste"),
          order: 40,
          disabled: !editingController.canPasteClipboard(),
          onSelect() {
            if (!editingController.canPasteClipboard()) {
              return;
            }

            editingController.pasteClipboard({
              anchorPoint: resolveContextAnchorPoint(context) ?? undefined,
              anchorToPoint: true,
              mutationAdapters: {
                createNode: (input) => createNode(input, context),
                createLink: (input) => createLink(input, context)
              }
            });
          }
        }
      ];
    });
  }
};
