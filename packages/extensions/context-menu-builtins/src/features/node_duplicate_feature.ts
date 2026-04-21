import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";
import {
  createClipboardFragment,
  pasteClipboardFragment,
  resolveEditingNodeIds
} from "../editing";

export const nodeDuplicateFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeDuplicate",
  register({
    host,
    options,
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
            const fragment = createClipboardFragment({
              host,
              nodeIds: resolveEditingNodeIds(host, nodeId)
            });
            if (!fragment) {
              return;
            }

            return pasteClipboardFragment({
              fragment,
              host,
              createLink,
              createNode,
              context,
              offset: options.pasteOffset,
              anchorToContextWorldPoint: false
            });
          }
        }
      ];
    });
  }
};
