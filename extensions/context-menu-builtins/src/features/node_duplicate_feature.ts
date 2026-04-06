import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";
import {
  resolveContextAnchorPoint,
  resolveEditingNodeIds
} from "../editing";

export const nodeDuplicateFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeDuplicate",
  register({
    editingController,
    host,
    registerResolver,
    createLink,
    createNode,
    resolveShortcutLabel
  }) {
    return registerResolver("node-duplicate", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveEditingNodeIds(host, nodeId);
      return [
        {
          key: "builtin-node-duplicate",
          label: selectedNodeIds.length > 1 ? "复制副本" : "复制节点副本",
          shortcut: resolveShortcutLabel("graph.duplicate"),
          order: 22,
          disabled: !host.getNodeSnapshot(nodeId),
          onSelect() {
            editingController.duplicateNodeIds(resolveEditingNodeIds(host, nodeId), {
              anchorPoint: resolveContextAnchorPoint(context) ?? undefined,
              anchorToPoint: false,
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
