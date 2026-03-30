import type { GraphLink } from "@leafergraph/node";
import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition,
  LeaferGraphContextMenuBuiltinsHost
} from "../types";

export const nodeCopyFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeCopy",
  register({ clipboard, host, registerResolver }) {
    return registerResolver("node-copy", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveCopyNodeIds(host, nodeId);
      const snapshot = host.getNodeSnapshot(nodeId);
      return [
        {
          key: "builtin-node-copy",
          label: selectedNodeIds.length > 1 ? "复制选中节点" : "复制节点",
          order: 20,
          disabled: !snapshot,
          onSelect() {
            const nextSelectedNodeIds = resolveCopyNodeIds(host, nodeId);
            const snapshots = nextSelectedNodeIds
              .map((selectedNodeId) => host.getNodeSnapshot(selectedNodeId))
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            if (!snapshots.length) {
              clipboard.clear();
              return;
            }

            const copiedNodeIds = new Set(snapshots.map((entry) => entry.id));
            const links = collectInnerLinks(host, copiedNodeIds);

            clipboard.setFragment({
              nodes: snapshots,
              links
            });
          }
        }
      ];
    });
  }
};

function resolveCopyNodeIds(
  host: Pick<
    LeaferGraphContextMenuBuiltinsHost,
    "isNodeSelected" | "listSelectedNodeIds"
  >,
  nodeId: string
): string[] {
  if (!host.isNodeSelected(nodeId)) {
    return [nodeId];
  }

  const selectedNodeIds = host.listSelectedNodeIds();
  return selectedNodeIds.length ? selectedNodeIds : [nodeId];
}

function collectInnerLinks(
  host: Pick<LeaferGraphContextMenuBuiltinsHost, "findLinksByNode">,
  nodeIds: ReadonlySet<string>
): GraphLink[] {
  const linksById = new Map<string, ReturnType<typeof host.findLinksByNode>[number]>();

  for (const nodeId of nodeIds) {
    for (const link of host.findLinksByNode(nodeId)) {
      if (
        nodeIds.has(link.source.nodeId) &&
        nodeIds.has(link.target.nodeId)
      ) {
        linksById.set(link.id, link);
      }
    }
  }

  return [...linksById.values()];
}
