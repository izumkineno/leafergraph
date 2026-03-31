import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition
} from "../types";
import {
  resolveEditingNodeIds,
  writeClipboardFragment
} from "../editing";

export const nodeCopyFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeCopy",
  register({ clipboard, host, registerResolver, resolveShortcutLabel }) {
    return registerResolver("node-copy", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveEditingNodeIds(host, nodeId);
      const hasSnapshot = Boolean(host.getNodeSnapshot(nodeId));
      return [
        {
          key: "builtin-node-copy",
          label: selectedNodeIds.length > 1 ? "复制选中节点" : "复制节点",
          shortcut: resolveShortcutLabel("graph.copy"),
          order: 20,
          disabled: !hasSnapshot,
          onSelect() {
            writeClipboardFragment({
              clipboard,
              host,
              nodeIds: resolveEditingNodeIds(host, nodeId)
            });
          }
        }
      ];
    });
  }
};
