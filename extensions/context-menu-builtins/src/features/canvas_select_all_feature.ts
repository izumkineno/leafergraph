import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const canvasSelectAllFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "canvasSelectAll",
  register({ host, registerResolver, resolveShortcutLabel }) {
    return registerResolver("canvas-select-all", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      const nodeIds = host.listNodeIds?.() ?? [];
      return [
        {
          key: "builtin-canvas-select-all",
          label: "全选节点",
          shortcut: resolveShortcutLabel("graph.select-all"),
          order: 14,
          disabled: !nodeIds.length,
          onSelect() {
            const nextNodeIds = host.listNodeIds?.() ?? [];
            if (!nextNodeIds.length) {
              return;
            }

            host.setSelectedNodeIds(nextNodeIds, "replace");
          }
        }
      ];
    });
  }
};
