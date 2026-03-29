import type { LeaferContextMenuBuiltinFeatureDefinition } from "../types";

export const nodeDeleteFeature: LeaferContextMenuBuiltinFeatureDefinition = {
  id: "nodeDelete",
  register({ registerResolver, removeNode }) {
    return registerResolver("node-delete", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      return [
        {
          key: "builtin-node-delete",
          label: "删除节点",
          order: 90,
          danger: true,
          onSelect() {
            removeNode(nodeId, context);
          }
        }
      ];
    });
  }
};
