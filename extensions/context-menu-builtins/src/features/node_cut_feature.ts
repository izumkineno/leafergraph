import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";
import {
  resolveEditingNodeIds
} from "../editing";

export const nodeCutFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeCut",
  register({
    editingController,
    host,
    registerResolver,
    removeNode,
    removeNodes,
    resolveShortcutLabel
  }) {
    return registerResolver("node-cut", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveEditingNodeIds(host, nodeId);
      return [
        {
          key: "builtin-node-cut",
          label: selectedNodeIds.length > 1 ? "剪切选中节点" : "剪切节点",
          shortcut: resolveShortcutLabel("graph.cut"),
          order: 21,
          danger: true,
          disabled: !host.getNodeSnapshot(nodeId),
          onSelect() {
            const nextSelectedNodeIds = resolveEditingNodeIds(host, nodeId);
            const fragment = editingController.cutNodeIds(nextSelectedNodeIds, {
              mutationAdapters: {
                removeNode: (editingNodeId) => {
                  removeNode(editingNodeId, context);
                },
                removeNodes: (editingNodeIds) => {
                  removeNodes(editingNodeIds, context);
                }
              }
            });
            if (!fragment) {
              return;
            }
          }
        }
      ];
    });
  }
};
