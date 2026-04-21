import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const canvasDeleteSelectionFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasDeleteSelection",
  register({ host, registerResolver, removeNodes, resolveShortcutLabel }) {
    return registerResolver("canvas-delete-selection", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      const selectedNodeIds = host.listSelectedNodeIds();
      return [
        {
          key: "builtin-canvas-delete-selection",
          label: "删除选中节点",
          shortcut: resolveShortcutLabel("graph.delete-selection"),
          order: 90,
          danger: true,
          disabled: !selectedNodeIds.length,
          onSelect() {
            const nextSelectedNodeIds = host.listSelectedNodeIds();
            if (!nextSelectedNodeIds.length) {
              return;
            }

            const removal = removeNodes(nextSelectedNodeIds, context);
            if (isPromiseLike(removal)) {
              return removal.then(() => {
                host.setSelectedNodeIds([], "replace");
              });
            }

            host.setSelectedNodeIds([], "replace");
          }
        }
      ];
    });
  }
};

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
}
