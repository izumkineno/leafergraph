import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const canvasRedoFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasRedo",
  register({ history, registerResolver, resolveShortcutLabel }) {
    return registerResolver("canvas-redo", (context) => {
      if (context.target.kind !== "canvas" || !history) {
        return [];
      }

      return [
        {
          key: "builtin-canvas-redo",
          label: "重做",
          shortcut: resolveShortcutLabel("graph.redo"),
          order: 9,
          disabled: !(history.canRedo?.() ?? true),
          onSelect() {
            history.redo();
          }
        }
      ];
    });
  }
};
