import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition,
  LeaferGraphContextMenuBuiltinsHost
} from "../types";

export const nodeDeleteFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeDelete",
  register({ host, registerResolver, removeNode, removeNodes }) {
    return registerResolver("node-delete", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      const selectedNodeIds = resolveDeleteNodeIds(host, nodeId);
      return [
        {
          key: "builtin-node-delete",
          label: selectedNodeIds.length > 1 ? "删除选中节点" : "删除节点",
          order: 90,
          danger: true,
          onSelect() {
            const nextSelectedNodeIds = resolveDeleteNodeIds(host, nodeId);
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
