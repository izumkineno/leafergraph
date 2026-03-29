import type { LeaferContextMenu } from "../leafer_context_menu";
import { getSharedLeaferContextMenuClipboardStore } from "./clipboard_store";
import { canvasAddNodeFeature } from "./features/canvas_add_node_feature";
import { canvasControlsFeature } from "./features/canvas_controls_feature";
import { canvasPasteFeature } from "./features/canvas_paste_feature";
import { linkDeleteFeature } from "./features/link_delete_feature";
import { nodeCopyFeature } from "./features/node_copy_feature";
import { nodeDeleteFeature } from "./features/node_delete_feature";
import { nodeRunFromHereFeature } from "./features/node_run_from_here_feature";
import type {
  LeaferContextMenuBuiltinFeatureDefinition,
  LeaferContextMenuBuiltinFeatureFlags,
  LeaferContextMenuBuiltinOptions
} from "./types";

const BUILTIN_FEATURE_DEFINITIONS: readonly LeaferContextMenuBuiltinFeatureDefinition[] = [
  canvasControlsFeature,
  canvasAddNodeFeature,
  canvasPasteFeature,
  nodeRunFromHereFeature,
  nodeCopyFeature,
  nodeDeleteFeature,
  linkDeleteFeature
];

export function registerLeaferContextMenuBuiltins(
  menu: LeaferContextMenu,
  options: LeaferContextMenuBuiltinOptions
): () => void {
  const cleanups: Array<() => void> = [];
  const clipboard =
    options.clipboard ?? getSharedLeaferContextMenuClipboardStore();

  for (const definition of BUILTIN_FEATURE_DEFINITIONS) {
    if (!isBuiltinFeatureEnabled(options.features, definition.id)) {
      continue;
    }

    cleanups.push(
      definition.register({
        menu,
        graph: options.graph,
        clipboard,
        options,
        registerResolver: (key, resolver) =>
          menu.registerResolver(`builtin:${definition.id}:${key}`, resolver),
        createNode: (input, context) =>
          options.nodeFactory?.(input, context) ?? options.graph.createNode(input),
        createLink: (input, context) =>
          options.createLink?.(input, context) ?? options.graph.createLink(input),
        play: (context) => {
          if (options.play) {
            options.play(context);
            return;
          }

          options.graph.play();
        },
        step: (context) => {
          if (options.step) {
            options.step(context);
            return;
          }

          options.graph.step();
        },
        stop: (context) => {
          if (options.stop) {
            options.stop(context);
            return;
          }

          options.graph.stop();
        },
        fitView: (context) => {
          if (options.fitView) {
            options.fitView(context);
            return;
          }

          options.graph.fitView();
        },
        playFromNode: (nodeId, context) => {
          if (options.playFromNode) {
            options.playFromNode(nodeId, context);
            return;
          }

          options.graph.playFromNode(nodeId, { source: "context-menu" });
        },
        removeNode: (nodeId, context) => {
          if (options.removeNode) {
            options.removeNode(nodeId, context);
            return;
          }

          options.graph.removeNode(nodeId);
        },
        removeLink: (linkId, context) => {
          if (options.removeLink) {
            options.removeLink(linkId, context);
            return;
          }

          options.graph.removeLink(linkId);
        },
        createDefaultNodeProjection: (type) => {
          const definition = options.graph.listNodes().find((entry) => entry.type === type);
          if (!definition) {
            return {
              title: type,
              category: "未分类"
            };
          }

          return {
            title: definition.title?.trim() || definition.type,
            category: definition.category?.trim() || "未分类",
            description: definition.description?.trim() || undefined
          };
        }
      })
    );
  }

  return () => {
    for (const cleanup of cleanups.splice(0, cleanups.length).reverse()) {
      cleanup();
    }
  };
}

function isBuiltinFeatureEnabled(
  features: LeaferContextMenuBuiltinFeatureFlags,
  key: keyof LeaferContextMenuBuiltinFeatureFlags
): boolean {
  const feature = features[key];
  if (feature === undefined) {
    return false;
  }

  if (typeof feature === "boolean") {
    return feature;
  }

  return feature.enabled ?? true;
}
