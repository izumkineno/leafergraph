import type {
  LeaferGraph,
  LeaferGraphContextMenuContext,
  LeaferGraphContextMenuItem,
  LeaferGraphContextMenuResolver
} from "leafergraph";

import type {
  EditorCommandBus,
  EditorCommandRequest
} from "../commands/command_bus";
import type { EditorNodeSelectionController } from "../state/selection";
import { isEditorLinkMenuBindingMeta } from "./context_menu_bindings";

/**
 * editor 菜单解析器创建参数。
 *
 * @remarks
 * 主包继续只负责菜单基础设施；
 * editor 在这里拼出节点 / 连线 / 画布三类菜单语义，并统一接到命令总线。
 */
export interface CreateEditorContextMenuResolverOptions {
  graph: LeaferGraph;
  selection: EditorNodeSelectionController;
  resolveCommandBus(): EditorCommandBus;
  onRemoveLink(linkId: string): void;
  onStartReconnect(linkId: string): void;
}

/** 菜单打开前钩子创建参数。 */
export interface CreateEditorContextMenuBeforeOpenHandlerOptions {
  selection: EditorNodeSelectionController;
  resolveCommandBus(): EditorCommandBus;
}

/** 生成节点级菜单项。 */
function resolveNodeContextMenuItems(
  context: LeaferGraphContextMenuContext,
  options: CreateEditorContextMenuResolverOptions
): LeaferGraphContextMenuItem[] {
  const commandBus = options.resolveCommandBus();
  const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
  const nodeTitle = String(context.bindingMeta?.nodeTitle ?? nodeId);
  const isSelected = options.selection.isSelected(nodeId);
  const isMultipleSelected = options.selection.hasMultipleSelected();
  const selectedCount = options.selection.selectedNodeIds.length;
  const useBatchAction = isSelected && isMultipleSelected;
  const copyRequest: EditorCommandRequest = useBatchAction
    ? { type: "selection.copy" }
    : { type: "clipboard.copy-node", nodeId };
  const cutRequest: EditorCommandRequest = { type: "clipboard.cut-selection" };
  const duplicateRequest: EditorCommandRequest = useBatchAction
    ? { type: "selection.duplicate" }
    : (() => {
        const snapshot = options.graph.getNodeSnapshot(nodeId);
        return {
          type: "node.duplicate" as const,
          nodeId,
          x: (snapshot?.layout.x ?? 0) + 48,
          y: (snapshot?.layout.y ?? 0) + 48
        };
      })();
  const playRequest: EditorCommandRequest = { type: "node.play", nodeId };
  const resetSizeRequest: EditorCommandRequest = {
    type: "node.reset-size",
    nodeId
  };
  const removeRequest: EditorCommandRequest = useBatchAction
    ? { type: "selection.remove" }
    : { type: "node.remove", nodeId };
  const copyState = commandBus.resolveCommandState(copyRequest);
  const cutState = commandBus.resolveCommandState(cutRequest);
  const duplicateState = commandBus.resolveCommandState(duplicateRequest);
  const playState = commandBus.resolveCommandState(playRequest);
  const resetSizeState = commandBus.resolveCommandState(resetSizeRequest);
  const removeState = commandBus.resolveCommandState(removeRequest);

  return [
    {
      key: "copy-node",
      label: useBatchAction ? `复制所选 ${selectedCount} 个节点` : `复制 ${nodeTitle}`,
      shortcut: copyState.shortcut,
      description: copyState.description,
      disabled: copyState.disabled,
      danger: copyState.danger,
      onSelect() {
        commandBus.execute(copyRequest);
      }
    },
    {
      key: "cut-node",
      label: useBatchAction ? `剪切所选 ${selectedCount} 个节点` : `剪切 ${nodeTitle}`,
      shortcut: cutState.shortcut,
      description: cutState.description,
      disabled: cutState.disabled,
      danger: cutState.danger,
      onSelect() {
        if (!useBatchAction) {
          options.selection.select(nodeId);
        }

        commandBus.execute(cutRequest);
      }
    },
    {
      key: "duplicate-node",
      label: useBatchAction ? "复制并粘贴选区" : "复制并粘贴",
      shortcut: duplicateState.shortcut,
      description: duplicateState.description,
      disabled: duplicateState.disabled,
      danger: duplicateState.danger,
      onSelect() {
        commandBus.execute(duplicateRequest);
      }
    },
    {
      key: "execute-node",
      label: "从此节点开始运行",
      shortcut: playState.shortcut,
      description: playState.description,
      disabled: playState.disabled,
      danger: playState.danger,
      onSelect() {
        commandBus.execute(playRequest);
      }
    },
    {
      key: "reset-node-size",
      label: "重置节点尺寸",
      shortcut: resetSizeState.shortcut,
      description: resetSizeState.description,
      disabled: resetSizeState.disabled,
      danger: resetSizeState.danger,
      onSelect() {
        commandBus.execute(resetSizeRequest);
      }
    },
    { kind: "separator", key: "node-divider" },
    {
      key: "remove-node",
      label: useBatchAction ? `删除所选 ${selectedCount} 个节点` : "删除节点",
      shortcut: removeState.shortcut,
      description: removeState.description,
      disabled: removeState.disabled,
      danger: removeState.danger,
      onSelect() {
        commandBus.execute(removeRequest);
      }
    }
  ];
}

/** 生成连线级菜单项。 */
function resolveLinkContextMenuItems(
  context: LeaferGraphContextMenuContext,
  options: CreateEditorContextMenuResolverOptions
): LeaferGraphContextMenuItem[] {
  const commandBus = options.resolveCommandBus();
  const linkMeta = isEditorLinkMenuBindingMeta(context.bindingMeta)
    ? context.bindingMeta
    : undefined;
  const linkId = String(linkMeta?.linkId ?? context.bindingKey);
  const sourceNodeId = String(linkMeta?.sourceNodeId ?? "");
  const sourceSlot = Number(linkMeta?.sourceSlot ?? 0);
  const targetNodeId = String(linkMeta?.targetNodeId ?? "");
  const targetSlot = Number(linkMeta?.targetSlot ?? 0);
  const removeRequest: EditorCommandRequest = { type: "link.remove", linkId };
  const reconnectRequest: EditorCommandRequest = {
    type: "link.reconnect",
    linkId,
    input: {}
  };
  const removeState = commandBus.resolveCommandState(removeRequest);
  const reconnectState = commandBus.resolveCommandState(reconnectRequest);

  return [
    {
      key: "remove-link",
      label: "删除连线",
      shortcut: removeState.shortcut,
      description: `断开 ${sourceNodeId}[${sourceSlot}] -> ${targetNodeId}[${targetSlot}]`,
      disabled: removeState.disabled,
      danger: removeState.danger,
      onSelect() {
        options.onRemoveLink(linkId);
      }
    },
    {
      key: "reconnect-link",
      label: "重新连接",
      shortcut: reconnectState.shortcut,
      description: reconnectState.description,
      disabled: reconnectState.disabled,
      danger: reconnectState.danger,
      onSelect() {
        options.onStartReconnect(linkId);
      }
    }
  ];
}

/** 生成画布级菜单项。 */
function resolveCanvasContextMenuItems(
  context: LeaferGraphContextMenuContext,
  options: CreateEditorContextMenuResolverOptions
): LeaferGraphContextMenuItem[] {
  const commandBus = options.resolveCommandBus();
  const createNodeRequest: EditorCommandRequest = {
    type: "canvas.create-node",
    context
  };
  const createNodeState = commandBus.resolveCommandState(createNodeRequest);
  const fitViewRequest: EditorCommandRequest = { type: "canvas.fit-view" };
  const fitViewState = commandBus.resolveCommandState(fitViewRequest);
  const items: LeaferGraphContextMenuItem[] = [
    {
      key: "create-node-here",
      label: "在这里创建节点",
      shortcut: createNodeState.shortcut,
      description: createNodeState.description,
      disabled: createNodeState.disabled,
      danger: createNodeState.danger,
      onSelect() {
        commandBus.execute(createNodeRequest);
      }
    },
    {
      key: "fit-view",
      label: "适配视图",
      shortcut: fitViewState.shortcut,
      description: fitViewState.description,
      disabled: fitViewState.disabled,
      danger: fitViewState.danger,
      onSelect() {
        commandBus.execute(fitViewRequest);
      }
    }
  ];

  const pasteRequest: EditorCommandRequest = {
    type: "clipboard.paste",
    point: context.pagePoint
  };
  const pasteState = commandBus.resolveCommandState(pasteRequest);

  if (!pasteState.disabled) {
    items.splice(1, 0, {
      key: "paste-copied-node",
      label: "粘贴已复制节点",
      shortcut: pasteState.shortcut,
      description: pasteState.description,
      disabled: pasteState.disabled,
      danger: pasteState.danger,
      onSelect() {
        commandBus.execute(pasteRequest);
      }
    });
  }

  return items;
}

/**
 * 创建 editor 右键菜单解析器。
 *
 * @remarks
 * 这一层只负责菜单语义，不承担主包菜单 DOM、定位或事件基础设施。
 */
export function createEditorContextMenuResolver(
  options: CreateEditorContextMenuResolverOptions
): LeaferGraphContextMenuResolver {
  return (context) => {
    if (context.bindingKind === "node") {
      return resolveNodeContextMenuItems(context, options);
    }

    if (
      context.bindingKind === "custom" &&
      isEditorLinkMenuBindingMeta(context.bindingMeta)
    ) {
      return resolveLinkContextMenuItems(context, options);
    }

    return resolveCanvasContextMenuItems(context, options);
  };
}

/**
 * 创建菜单打开前钩子。
 *
 * @remarks
 * 节点菜单打开前同步当前选区，画布菜单打开前清空选区，
 * 保持菜单动作和当前命中状态一致。
 */
export function createEditorContextMenuBeforeOpenHandler(
  options: CreateEditorContextMenuBeforeOpenHandlerOptions
): (context: LeaferGraphContextMenuContext) => boolean | void {
  return (context) => {
    if (context.bindingKind === "node") {
      const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
      if (!options.selection.isSelected(nodeId)) {
        options.selection.select(nodeId);
      }
      return;
    }

    if (context.bindingKind === "canvas") {
      options.resolveCommandBus().execute({ type: "selection.clear" });
    }
  };
}
