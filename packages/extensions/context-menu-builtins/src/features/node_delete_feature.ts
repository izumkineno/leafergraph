import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition
} from "../types";
import { resolveEditingNodeIds } from "../editing";

export const nodeDeleteFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeDelete",
  register({ host, registerResolver, removeNode, removeNodes, resolveShortcutLabel }) {
    return registerResolver("node-delete", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveEditingNodeIds(host, nodeId);
      return [
        {
          key: "builtin-node-delete",
          label: selectedNodeIds.length > 1 ? "删除选中节点" : "删除节点",
          shortcut: resolveShortcutLabel("graph.delete-selection"),
          order: 90,
          danger: true,
          async onSelect() {
            const nextSelectedNodeIds = resolveEditingNodeIds(host, nodeId);
            if (nextSelectedNodeIds.length > 1) {
              await removeNodes(nextSelectedNodeIds, context);
              return;
            }

            await removeNode(nodeId, context);
          }
        }
      ];
    });
  }
};
