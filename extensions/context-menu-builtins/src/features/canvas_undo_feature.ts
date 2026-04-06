import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const canvasUndoFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasUndo",
  register({ history, registerResolver, resolveShortcutLabel }) {
    return registerResolver("canvas-undo", (context) => {
      if (context.target.kind !== "canvas" || !history) {
        return [];
      }

      return [
        {
          key: "builtin-canvas-undo",
          label: "撤回",
          shortcut: resolveShortcutLabel("graph.undo"),
          order: 8,
          disabled: !(history.canUndo?.() ?? true),
          onSelect() {
            history.undo();
          }
        }
      ];
    });
  }
};
