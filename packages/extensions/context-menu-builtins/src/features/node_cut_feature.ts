import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";
import {
  resolveEditingNodeIds,
  writeClipboardFragment
} from "../editing";

export const nodeCutFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeCut",
  register({
    clipboard,
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
            const fragment = writeClipboardFragment({
              clipboard,
              host,
              nodeIds: nextSelectedNodeIds
            });
            if (!fragment) {
              return;
            }

            if (nextSelectedNodeIds.length > 1) {
              const removal = removeNodes(nextSelectedNodeIds, context);
              if (isPromiseLike(removal)) {
                return removal.then(() => {
                  host.setSelectedNodeIds([], "replace");
                });
              }
            } else {
              const removal = removeNode(nextSelectedNodeIds[0], context);
              if (isPromiseLike(removal)) {
                return removal.then(() => {
                  host.setSelectedNodeIds([], "replace");
                });
              }
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
