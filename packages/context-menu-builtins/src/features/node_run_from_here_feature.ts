import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const nodeRunFromHereFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "nodeRunFromHere",
  register({ playFromNode, registerResolver }) {
    return registerResolver("node-run-from-here", (context) => {
      const nodeId = context.target.kind === "node" ? context.target.id : undefined;
      if (!nodeId) {
        return [];
      }

      return [
        {
          key: "builtin-node-run-from-here",
          label: "从该节点开始运行",
          order: 10,
          async onSelect() {
            await playFromNode(nodeId, context);
          }
        }
      ];
    });
  }
};
