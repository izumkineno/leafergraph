import type { LeaferContextMenuBuiltinFeatureDefinition } from "../types";

export const nodeDeleteFeature: LeaferContextMenuBuiltinFeatureDefinition = {
  id: "nodeDelete",
  register({ graph, registerResolver, removeNode, removeNodes }) {
    return registerResolver("node-delete", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveDeleteNodeIds(graph, nodeId);
      return [
        {
          key: "builtin-node-delete",
          label: selectedNodeIds.length > 1 ? "删除选中节点" : "删除节点",
          order: 90,
          danger: true,
          onSelect() {
            const nextSelectedNodeIds = resolveDeleteNodeIds(graph, nodeId);
            if (nextSelectedNodeIds.length > 1) {
              removeNodes(nextSelectedNodeIds, context);
              return;
            }

            removeNode(nodeId, context);
          }
        }
      ];
    });
  }
};

function resolveDeleteNodeIds(
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
