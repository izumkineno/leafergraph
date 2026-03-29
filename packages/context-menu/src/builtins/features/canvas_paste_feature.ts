import { createCreateNodeInputFromNodeSnapshot } from "leafergraph";
import type { LeaferContextMenuContext } from "../../leafer_context_menu";
import type {
  LeaferContextMenuBuiltinFeatureDefinition,
  LeaferContextMenuBuiltinFeatureRegistrationContext,
  LeaferContextMenuClipboardFragment
} from "../types";

const DEFAULT_PASTE_OFFSET = {
  x: 24,
  y: 24
} as const;

export const canvasPasteFeature: LeaferContextMenuBuiltinFeatureDefinition = {
  id: "canvasPaste",
  register({ clipboard, graph, options, registerResolver, createLink, createNode }) {
    return registerResolver("canvas-paste", (context) => {
      if (context.target.kind !== "canvas") {
        return [];
      }

      const fragment = clipboard.getFragment();
      return [
        {
          key: "builtin-canvas-paste",
          label: "粘贴",
          order: 40,
          disabled: !fragment?.nodes.length,
          onSelect() {
            if (!fragment?.nodes.length) {
              return;
            }

            const offset = options.pasteOffset ?? DEFAULT_PASTE_OFFSET;
            pasteClipboardFragment({
              fragment,
              graph,
              createLink,
              createNode,
              context,
              offset
            });
          }
        }
      ];
    });
  }
};

function pasteClipboardFragment(input: {
  fragment: LeaferContextMenuClipboardFragment;
  graph: Pick<import("leafergraph").LeaferGraph, "setSelectedNodeIds">;
  createNode: LeaferContextMenuBuiltinFeatureRegistrationContext["createNode"];
  createLink: LeaferContextMenuBuiltinFeatureRegistrationContext["createLink"];
  context: LeaferContextMenuContext;
  offset: {
    x: number;
    y: number;
  };
}): void {
  const origin = resolveFragmentOrigin(input.fragment);
  const targetOrigin = input.context.worldPoint
    ? {
        x: input.context.worldPoint.x + input.offset.x,
        y: input.context.worldPoint.y + input.offset.y
      }
    : {
        x: origin.x + input.offset.x,
        y: origin.y + input.offset.y
      };
  const delta = {
    x: targetOrigin.x - origin.x,
    y: targetOrigin.y - origin.y
  };
  const nodeIdMap = new Map<string, string>();
  const createdNodeIds: string[] = [];

  for (const snapshot of input.fragment.nodes) {
    const nextNodeInput = createCreateNodeInputFromNodeSnapshot(snapshot);
    const createdNode = input.createNode(
      {
        ...nextNodeInput,
        id: undefined,
        x: snapshot.layout.x + delta.x,
        y: snapshot.layout.y + delta.y
      },
      input.context
    );
    nodeIdMap.set(snapshot.id, createdNode.id);
    createdNodeIds.push(createdNode.id);
  }

  for (const link of input.fragment.links) {
    const sourceNodeId = nodeIdMap.get(link.source.nodeId);
    const targetNodeId = nodeIdMap.get(link.target.nodeId);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    input.createLink({
      source: {
        nodeId: sourceNodeId,
        slot: link.source.slot
      },
      target: {
        nodeId: targetNodeId,
        slot: link.target.slot
      }
    }, input.context);
  }

  input.graph.setSelectedNodeIds(createdNodeIds, "replace");
}

function resolveFragmentOrigin(fragment: LeaferContextMenuClipboardFragment): {
  x: number;
  y: number;
} {
  const [firstNode] = fragment.nodes;
  if (!firstNode) {
    return { x: 0, y: 0 };
  }

  return fragment.nodes.reduce(
    (current, node) => ({
      x: Math.min(current.x, node.layout.x),
      y: Math.min(current.y, node.layout.y)
    }),
    {
      x: firstNode.layout.x,
      y: firstNode.layout.y
    }
  );
}
