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
          async onSelect() {
            const nextSelectedNodeIds = host.listSelectedNodeIds();
            if (!nextSelectedNodeIds.length) {
              return;
            }

            await removeNodes(nextSelectedNodeIds, context);
            host.setSelectedNodeIds([], "replace");
          }
        }
      ];
    });
  }
};
