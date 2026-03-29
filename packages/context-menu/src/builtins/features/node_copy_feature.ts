import type { LeaferContextMenuBuiltinFeatureDefinition } from "../types";

export const nodeCopyFeature: LeaferContextMenuBuiltinFeatureDefinition = {
  id: "nodeCopy",
  register({ clipboard, graph, registerResolver }) {
    return registerResolver("node-copy", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveCopyNodeIds(graph, nodeId);
      const snapshot = graph.getNodeSnapshot(nodeId);
      return [
        {
          key: "builtin-node-copy",
          label: selectedNodeIds.length > 1 ? "复制选中节点" : "复制节点",
          order: 20,
          disabled: !snapshot,
          onSelect() {
            const nextSelectedNodeIds = resolveCopyNodeIds(graph, nodeId);
            const snapshots = nextSelectedNodeIds
              .map((selectedNodeId) => graph.getNodeSnapshot(selectedNodeId))
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            if (!snapshots.length) {
              clipboard.clear();
              return;
            }

            const copiedNodeIds = new Set(snapshots.map((entry) => entry.id));
            const links = collectInnerLinks(graph, copiedNodeIds);

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
  graph: Pick<
    import("leafergraph").LeaferGraph,
    "isNodeSelected" | "listSelectedNodeIds"
  >,
  nodeId: string
): string[] {
  if (!graph.isNodeSelected(nodeId)) {
    return [nodeId];
  }

  const selectedNodeIds = graph.listSelectedNodeIds();
  return selectedNodeIds.length ? selectedNodeIds : [nodeId];
}

function collectInnerLinks(
  graph: Pick<import("leafergraph").LeaferGraph, "findLinksByNode">,
  nodeIds: ReadonlySet<string>
) {
  const linksById = new Map<string, ReturnType<typeof graph.findLinksByNode>[number]>();

  for (const nodeId of nodeIds) {
    for (const link of graph.findLinksByNode(nodeId)) {
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
