import type { LeaferContextMenuBuiltinFeatureDefinition } from "../types";

export const nodeCopyFeature: LeaferContextMenuBuiltinFeatureDefinition = {
  id: "nodeCopy",
  register({ clipboard, graph, registerResolver }) {
    return registerResolver("node-copy", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const snapshot = graph.getNodeSnapshot(nodeId);
      return [
        {
          key: "builtin-node-copy",
          label: "复制节点",
          order: 20,
          disabled: !snapshot,
          onSelect() {
            const latestSnapshot = graph.getNodeSnapshot(nodeId);
            if (!latestSnapshot) {
              clipboard.clear();
              return;
            }

            const nodeIds = new Set([latestSnapshot.id]);
            const links = graph.findLinksByNode(nodeId).filter((link) => {
              return (
                nodeIds.has(link.source.nodeId) &&
                nodeIds.has(link.target.nodeId)
              );
            });

            clipboard.setFragment({
              nodes: [latestSnapshot],
              links
            });
          }
        }
      ];
    });
  }
};
