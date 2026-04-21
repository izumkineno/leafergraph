import type { LeaferContextMenu } from "@leafergraph/extensions/context-menu";
import { getSharedLeaferGraphContextMenuClipboardStore } from "./clipboard_store";
import { canvasAddNodeFeature } from "./features/canvas_add_node_feature";
import { canvasControlsFeature } from "./features/canvas_controls_feature";
import { canvasDeleteSelectionFeature } from "./features/canvas_delete_selection_feature";
import { canvasPasteFeature } from "./features/canvas_paste_feature";
import { canvasRedoFeature } from "./features/canvas_redo_feature";
import { canvasSelectAllFeature } from "./features/canvas_select_all_feature";
import { canvasUndoFeature } from "./features/canvas_undo_feature";
import { linkDeleteFeature } from "./features/link_delete_feature";
import { nodeCopyFeature } from "./features/node_copy_feature";
import { nodeCutFeature } from "./features/node_cut_feature";
import { nodeDeleteFeature } from "./features/node_delete_feature";
import { nodeDuplicateFeature } from "./features/node_duplicate_feature";
import { nodeRunFromHereFeature } from "./features/node_run_from_here_feature";
import type {
  LeaferGraphContextMenuBuiltinFeatureDefinition,
  LeaferGraphContextMenuBuiltinFeatureFlags,
  LeaferGraphContextMenuBuiltinOptions
} from "./types";

const BUILTIN_FEATURE_DEFINITIONS: readonly LeaferGraphContextMenuBuiltinFeatureDefinition[] = [
  canvasUndoFeature,
  canvasRedoFeature,
  canvasSelectAllFeature,
  canvasControlsFeature,
  canvasAddNodeFeature,
  canvasPasteFeature,
  canvasDeleteSelectionFeature,
  nodeRunFromHereFeature,
  nodeCopyFeature,
  nodeCutFeature,
  nodeDuplicateFeature,
  nodeDeleteFeature,
  linkDeleteFeature
];

const DEFAULT_ENABLED_FEATURES = new Set<keyof LeaferGraphContextMenuBuiltinFeatureFlags>([
  "canvasUndo",
  "canvasRedo",
  "canvasSelectAll",
  "canvasControls",
  "canvasAddNode",
  "canvasPaste",
  "canvasDeleteSelection",
  "nodeRunFromHere",
  "nodeCopy",
  "nodeCut",
  "nodeDuplicate",
  "nodeDelete",
  "linkDelete"
]);

/**
 * 注册LeaferGraph 上下文菜单`Builtins`。
 *
 * @param menu - 菜单。
 * @param options - 可选配置项。
 * @returns 用于撤销当前注册的清理函数。
 */
export function registerLeaferGraphContextMenuBuiltins(
  menu: LeaferContextMenu,
  options: LeaferGraphContextMenuBuiltinOptions
): () => void {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
  const cleanups: Array<() => void> = [];
  const clipboard =
    options.clipboard ?? getSharedLeaferGraphContextMenuClipboardStore();
  const host = options.host;

  for (const definition of BUILTIN_FEATURE_DEFINITIONS) {
    // 再建立绑定与同步关系，让运行期交互能够稳定生效。
    if (!isBuiltinFeatureEnabled(options.features, definition.id)) {
      continue;
    }

    cleanups.push(
      definition.register({
        menu,
        host,
        clipboard,
        history: options.history,
        options,
        resolveShortcutLabel: (actionId) =>
          options.resolveShortcutLabel?.(actionId),
        registerResolver: (key, resolver) =>
          menu.registerResolver(`builtin:${definition.id}:${key}`, resolver),
        createNode: (input, context) => host.createNode(input, context),
        createLink: (input, context) => host.createLink(input, context),
        play: (context) => host.play(context),
        step: (context) => host.step(context),
        stop: (context) => host.stop(context),
        fitView: (context) => host.fitView(context),
        playFromNode: (nodeId, context) => host.playFromNode(nodeId, context),
        removeNode: (nodeId, context) => host.removeNode(nodeId, context),
        removeNodes: async (nodeIds, context) => {
          if (host.removeNodes) {
            await host.removeNodes(nodeIds, context);
            return;
          }

          for (const nodeId of nodeIds) {
            await host.removeNode(nodeId, context);
          }
        },
        removeLink: (linkId, context) => host.removeLink(linkId, context)
      })
    );
  }

  return () => {
    for (const cleanup of cleanups.splice(0, cleanups.length).reverse()) {
      cleanup();
    }
  };
}

/**
 * 处理 `isBuiltinFeatureEnabled` 相关逻辑。
 *
 * @param features - `features`。
 * @param key - 键值。
 * @returns 对应的判断结果。
 */
function isBuiltinFeatureEnabled(
  features: LeaferGraphContextMenuBuiltinFeatureFlags | undefined,
  key: keyof LeaferGraphContextMenuBuiltinFeatureFlags
): boolean {
  if (features === undefined || features[key] === undefined) {
    return DEFAULT_ENABLED_FEATURES.has(key);
  }

  const feature = features[key];
  if (typeof feature === "boolean") {
    return feature;
  }

  return feature.enabled ?? true;
}
