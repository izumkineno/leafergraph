/**
 * runtime-bridge-node-demo 的右键菜单桥接模块。
 *
 * @remarks
 * 参考 mini-graph 的分层设计：
 * - 先启用 `@leafergraph/context-menu-builtins` 内建节点图动作
 * - 再补上 demo 特有的便捷动作
 * - 所有操作通过 runtime-bridge 提交到服务端
 */

import {
  createLeaferContextMenu,
  type LeaferContextMenu,
  type LeaferContextMenuContext,
  type LeaferContextMenuItem
} from "@leafergraph/context-menu";
import {
  registerLeaferGraphContextMenuBuiltins,
  type LeaferGraphContextMenuBuiltinActionId,
  type LeaferGraphContextMenuClipboardState,
  type LeaferGraphContextMenuBuiltinsHost
} from "@leafergraph/context-menu-builtins";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type {
  LeaferGraph,
} from "leafergraph";
import type {
  LeaferGraphRuntimeBridgeClient,
  LeaferGraphRuntimeBridgeEditingAdapter
} from "@leafergraph/runtime-bridge/client";

/** 创建 demo 菜单时需要的宿主能力。 */
export interface CreateDemoContextMenuOptions {
  graph: LeaferGraph;
  bridgeClient: LeaferGraphRuntimeBridgeClient;
  editingAdapter: LeaferGraphRuntimeBridgeEditingAdapter;
  container: HTMLElement;
  fit(): void;
  resolveThemeMode(): LeaferGraphThemeMode;
  appendLog(message: string): void;
  clipboard: LeaferGraphContextMenuClipboardState;
  resolveShortcutLabel?(
    actionId: LeaferGraphContextMenuBuiltinActionId
  ): string | undefined;
  listNodeIds(): readonly string[];
}

/** 外部除了销毁外，还需要在节点和连线生命周期变化时同步菜单 target。 */
export interface DemoContextMenuHandle {
  bindNodeTarget(nodeId: string): void;
  unbindNodeTarget(nodeId: string): void;
  bindLinkTarget(link: DemoTrackedLinkEntry): void;
  unbindLinkTarget(linkId: string): void;
  isOpen(): boolean;
  destroy(): void;
}

/** demo 内部维护的最小连线投影，专供右键菜单绑定。 */
export interface DemoTrackedLinkEntry {
  id: string;
  sourceNodeId: string;
  sourceSlot: string;
  targetNodeId: string;
  targetSlot: string;
}

/**
 * 创建一个专供 runtime-bridge-node-demo 使用的右键菜单控制器。
 *
 * @remarks
 * - 通用功能全部来自 builtins
 * - demo 自己只额外补充便捷操作
 *
 * @param options - 配置选项。
 * @returns 创建后的结果对象。
 */
export function createDemoContextMenu(
  options: CreateDemoContextMenuOptions
): DemoContextMenuHandle {
  const builtinsHost = createDemoBuiltinsHost(options);
  const menu = createLeaferContextMenu({
    app: options.graph.app,
    container: options.container,
    host: resolveContextMenuHost(options.container),
    resolveThemeMode: options.resolveThemeMode,
    config: {
      submenu: {
        triggerMode: "hover"
      }
    }
  });

  const disposeBuiltins = registerLeaferGraphContextMenuBuiltins(menu, {
    host: builtinsHost,
    clipboard: options.clipboard,
    resolveShortcutLabel: options.resolveShortcutLabel
  });

  const disposeDemoResolver = menu.registerResolver(
    "runtime-bridge-demo-extra",
    (context) => createDemoMenuItems(options, context)
  );

  return {
    bindNodeTarget(nodeId): void {
      bindNodeContextMenuTarget(menu, options, nodeId);
    },
    unbindNodeTarget(nodeId): void {
      menu.unbindTarget(createNodeMenuBindingKey(nodeId));
    },
    bindLinkTarget(link): void {
      bindLinkContextMenuTarget(menu, options, link);
    },
    unbindLinkTarget(linkId): void {
      menu.unbindTarget(createLinkMenuBindingKey(linkId));
    },
    isOpen(): boolean {
      return menu.isOpen();
    },
    destroy(): void {
      disposeDemoResolver();
      disposeBuiltins();
      menu.destroy();
    }
  };
}

/**
 * 创建 builtins host 适配对象。
 *
 * @param options - 配置选项。
 * @returns 适配后的宿主对象。
 */
function createDemoBuiltinsHost(
  options: CreateDemoContextMenuOptions
): LeaferGraphContextMenuBuiltinsHost {
  const host: LeaferGraphContextMenuBuiltinsHost = {
    listNodes() {
      return options.graph.listNodes();
    },
    listNodeIds() {
      return options.listNodeIds();
    },
    getNodeSnapshot(nodeId) {
      return options.graph.getNodeSnapshot(nodeId);
    },
    findLinksByNode(nodeId) {
      return options.graph.findLinksByNode(nodeId);
    },
    isNodeSelected(nodeId) {
      return options.graph.isNodeSelected(nodeId);
    },
    listSelectedNodeIds() {
      return options.graph.listSelectedNodeIds();
    },
    setSelectedNodeIds(nodeIds, mode) {
      return options.graph.setSelectedNodeIds(nodeIds, mode);
    },
    createNode(input, _context) {
      return options.editingAdapter.createNode(input);
    },
    createLink(input, _context) {
      return options.editingAdapter.createLink(input);
    },
    fitView(_context) {
      options.fit();
    },
    async play(_context) {
      await options.bridgeClient.play();
    },
    async step(_context) {
      await options.bridgeClient.step();
    },
    async stop(_context) {
      await options.bridgeClient.stop();
    },
    async playFromNode(nodeId, _context) {
      const snapshot = options.graph.getNodeSnapshot(nodeId);
      await options.bridgeClient.playFromNode(nodeId);
      options.appendLog(
        `已从节点开始运行：${snapshot?.title?.trim() || nodeId}`
      );
    },
    removeNode(nodeId, _context) {
      return options.editingAdapter.removeNode(nodeId);
    },
    removeNodes(nodeIds, _context) {
      return options.editingAdapter.removeNodes(nodeIds);
    },
    removeLink(linkId, _context) {
      return options.editingAdapter.removeLink(linkId);
    }
  };

  return host;
}

/**
 * 创建 demo 额外菜单项。
 *
 * @param options - 配置选项。
 * @param context - 当前上下文。
 * @returns 菜单项数组。
 */
function createDemoMenuItems(
  options: CreateDemoContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  if (context.target.kind === "node") {
    return createNodeMenuItems(options, context);
  }

  if (context.target.kind === "link") {
    return createLinkMenuItems(options, context);
  }

  return createCanvasMenuItems(options, context);
}

/**
 * 创建画布菜单。
 *
 * @param options - 配置选项。
 * @param context - 当前上下文。
 * @returns 菜单项数组。
 */
function createCanvasMenuItems(
  options: CreateDemoContextMenuOptions,
  _context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  return [
    {
      key: "demo-canvas-fit-view",
      label: "适配视图",
      order: 10,
      onSelect() {
        options.fit();
        options.appendLog("已执行适配视图");
      }
    },
    {
      key: "demo-canvas-request-snapshot",
      label: "拉取最新快照",
      order: 20,
      onSelect() {
        void options.bridgeClient.requestSnapshot();
        options.appendLog("已请求拉取最新服务端快照");
      }
    },
    { kind: "separator", key: "demo-canvas-divider", order: 89 }
  ];
}

/**
 * 创建节点菜单。
 *
 * @param options - 配置选项。
 * @param context - 当前上下文。
 * @returns 菜单项数组。
 */
function createNodeMenuItems(
  options: CreateDemoContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  const nodeId = context.target.id;
  const nodeTitle = resolveNodeTargetText(context, "title");
  const nodeType = resolveNodeTargetText(context, "type");

  return [
    {
      key: "demo-node-log-info",
      label: "记录节点信息",
      order: 80,
      disabled: !nodeId,
      onSelect() {
        if (!nodeId) {
          options.appendLog("当前节点缺少 nodeId，无法记录节点信息");
          return;
        }

        options.appendLog(
          `节点信息：${nodeTitle || nodeId} · ${nodeType || "unknown"}`
        );
      }
    },
    { kind: "separator", key: "demo-node-divider", order: 89 }
  ];
}

/**
 * 创建连线菜单。
 *
 * @param options - 配置选项。
 * @param context - 当前上下文。
 * @returns 菜单项数组。
 */
function createLinkMenuItems(
  options: CreateDemoContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  const linkId = context.target.id;
  const sourceNodeId = resolveTargetMetaText(context, "sourceNodeId");
  const sourceSlot = resolveTargetMetaText(context, "sourceSlot");
  const targetNodeId = resolveTargetMetaText(context, "targetNodeId");
  const targetSlot = resolveTargetMetaText(context, "targetSlot");
  const summary = resolveLinkSummary({
    linkId,
    sourceNodeId,
    sourceSlot,
    targetNodeId,
    targetSlot
  });

  return [
    {
      key: "demo-link-log-info",
      label: "记录连线信息",
      order: 80,
      disabled: !linkId,
      onSelect() {
        if (!linkId) {
          options.appendLog("当前连线缺少 linkId，无法记录连线信息");
          return;
        }

        options.appendLog(`连线信息：${summary}`);
      }
    },
    { kind: "separator", key: "demo-link-divider", order: 89 }
  ];
}

/**
 * 菜单浮层统一挂到文档 body。
 *
 * @param container - 容器。
 * @returns 宿主元素。
 */
function resolveContextMenuHost(container: HTMLElement): HTMLElement {
  return container.ownerDocument.body ?? container;
}

/**
 * 创建节点菜单绑定 key。
 *
 * @param nodeId - 节点 ID。
 * @returns 绑定 key。
 */
function createNodeMenuBindingKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/**
 * 创建连线菜单绑定 key。
 *
 * @param linkId - 连线 ID。
 * @returns 绑定 key。
 */
function createLinkMenuBindingKey(linkId: string): string {
  return `link:${linkId}`;
}

/**
 * 绑定节点到菜单系统。
 *
 * @param menu - 菜单控制器。
 * @param options - 配置选项。
 * @param nodeId - 节点 ID。
 */
function bindNodeContextMenuTarget(
  menu: LeaferContextMenu,
  options: CreateDemoContextMenuOptions,
  nodeId: string
): void {
  const nodeView = options.graph.getNodeView(nodeId);
  if (!nodeView) {
    return;
  }

  const nodeSnapshot = options.graph.getNodeSnapshot(nodeId);
  menu.bindNode(createNodeMenuBindingKey(nodeId), nodeView, {
    id: nodeId,
    title: nodeSnapshot?.title?.trim() || nodeId,
    type: nodeSnapshot?.type
  });
}

/**
 * 绑定连线到菜单系统。
 *
 * @param menu - 菜单控制器。
 * @param options - 配置选项。
 * @param link - 连线信息。
 */
function bindLinkContextMenuTarget(
  menu: LeaferContextMenu,
  options: CreateDemoContextMenuOptions,
  link: DemoTrackedLinkEntry
): void {
  const linkView = options.graph.getLinkView(link.id);
  if (!linkView) {
    return;
  }

  menu.bindLink(createLinkMenuBindingKey(link.id), linkView, {
    id: link.id,
    sourceNodeId: link.sourceNodeId,
    sourceSlot: link.sourceSlot,
    targetNodeId: link.targetNodeId,
    targetSlot: link.targetSlot
  });
}

/**
 * 从 target meta 中安全读取字符串字段。
 *
 * @param context - 当前上下文。
 * @param key - 键名。
 * @returns 字段值。
 */
function resolveTargetMetaText(
  context: LeaferContextMenuContext,
  key: "title" | "type" | "sourceNodeId" | "sourceSlot" | "targetNodeId" | "targetSlot"
): string | undefined {
  const value = context.target.meta?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * 节点菜单专用 helper。
 *
 * @param context - 当前上下文。
 * @param key - 键名。
 * @returns 字段值。
 */
function resolveNodeTargetText(
  context: LeaferContextMenuContext,
  key: "title" | "type"
): string | undefined {
  return resolveTargetMetaText(context, key);
}

/**
 * 统一格式化连线说明。
 *
 * @param input - 输入参数。
 * @returns 格式化后的说明。
 */
function resolveLinkSummary(input: {
  linkId?: string;
  sourceNodeId?: string;
  sourceSlot?: string;
  targetNodeId?: string;
  targetSlot?: string;
}): string {
  if (
    input.sourceNodeId &&
    input.sourceSlot &&
    input.targetNodeId &&
    input.targetSlot
  ) {
    return `${input.sourceNodeId}:${input.sourceSlot} -> ${input.targetNodeId}:${input.targetSlot}`;
  }

  return input.linkId ?? "unknown";
}
