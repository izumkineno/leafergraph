/**
 * 最小空画布 demo 的右键菜单桥接模块。
 *
 * @remarks
 * 这个文件只做两层接线：
 * - 先启用 `@leafergraph/context-menu` 内建通用功能
 * - 再补上 `mini-graph` 自己特有的 demo 动作
 *
 * 这样通用右键能力能沉到包内复用，而 demo 仍能保留自己的说明性动作。
 */

import {
  createLeaferContextMenu,
  registerLeaferContextMenuBuiltins,
  type LeaferContextMenu,
  type LeaferContextMenuContext,
  type LeaferContextMenuItem
} from "@leafergraph/context-menu";
import type { NodeRuntimeState } from "@leafergraph/node";
import type {
  GraphLink,
  LeaferGraph,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput
} from "leafergraph";
import type { ExampleTrackedLinkEntry } from "./use_example_graph";

/** 创建 demo 菜单时需要的宿主能力。 */
export interface CreateExampleContextMenuOptions {
  graph: LeaferGraph;
  container: HTMLElement;
  play(): void;
  step(): void;
  stop(): void;
  fit(): void;
  reset(): void;
  clearLog(): void;
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState;
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  removeNode(nodeId: string): void;
  removeNodes(nodeIds: readonly string[]): void;
  removeLink(linkId: string): void;
  appendLog(message: string): void;
}

/** 外部除了销毁外，还需要在节点和连线生命周期变化时同步菜单 target。 */
export interface ExampleContextMenuHandle {
  bindNodeTarget(nodeId: string): void;
  unbindNodeTarget(nodeId: string): void;
  bindLinkTarget(link: ExampleTrackedLinkEntry): void;
  unbindLinkTarget(linkId: string): void;
  destroy(): void;
}

/**
 * 创建一个专供 `mini-graph` 使用的右键菜单控制器。
 *
 * @remarks
 * - 通用功能全部来自 builtins
 * - demo 自己只额外注册 Reset / Clear Log / 信息记录等补丁动作
 */
export function createExampleContextMenu(
  options: CreateExampleContextMenuOptions
): ExampleContextMenuHandle {
  const menu = createLeaferContextMenu({
    app: options.graph.app,
    container: options.container,
    host: resolveContextMenuHost(options.container),
    // demo 端统一使用 hover 展开子菜单。
    submenuTriggerMode: "hover"
  });

  const disposeBuiltins = registerLeaferContextMenuBuiltins(menu, {
    graph: options.graph,
    features: {
      canvasAddNode: true,
      canvasPaste: true,
      canvasControls: true,
      nodeRunFromHere: true,
      nodeCopy: true,
      nodeDelete: true,
      linkDelete: true
    },
    play() {
      options.play();
    },
    step() {
      options.step();
    },
    stop() {
      options.stop();
    },
    fitView() {
      options.fit();
    },
    playFromNode(nodeId) {
      const changed = options.graph.playFromNode(nodeId, {
        source: "context-menu"
      });
      const snapshot = options.graph.getNodeSnapshot(nodeId);
      options.appendLog(
        changed
          ? `已从节点开始运行：${snapshot?.title?.trim() || nodeId}`
          : `从该节点开始运行未产生新执行：${snapshot?.title?.trim() || nodeId}`
      );
    },
    nodeFactory(input) {
      return options.createNode(input);
    },
    createLink(input) {
      return options.createLink(input);
    },
    removeNode(nodeId) {
      options.removeNode(nodeId);
    },
    removeNodes(nodeIds) {
      options.removeNodes(nodeIds);
    },
    removeLink(linkId) {
      options.removeLink(linkId);
    }
  });

  const disposeExampleResolver = menu.registerResolver(
    "mini-graph-extra",
    (context) => createExampleMenuItems(options, context)
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
    destroy(): void {
      disposeExampleResolver();
      disposeBuiltins();
      menu.destroy();
    }
  };
}

/** demo 额外菜单项只保留说明型动作，不再重复实现通用内建动作。 */
function createExampleMenuItems(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  if (context.target.kind === "node") {
    return createNodeMenuItems(options, context);
  }

  if (context.target.kind === "link") {
    return createLinkMenuItems(options, context);
  }

  return createCanvasMenuItems(options);
}

/** 画布菜单只保留 demo 专属动作，其余运行与建点能力全部走 builtins。 */
function createCanvasMenuItems(
  options: CreateExampleContextMenuOptions
): LeaferContextMenuItem[] {
  return [
    {
      key: "demo-canvas-clear-log",
      label: "Clear Log",
      order: 80,
      onSelect() {
        options.clearLog();
        options.appendLog("已通过右键菜单清空运行日志");
      }
    },
    { kind: "separator", key: "demo-canvas-divider", order: 89 },
    {
      key: "demo-canvas-reset",
      label: "Reset Example",
      order: 90,
      onSelect() {
        options.reset();
      }
    }
  ];
}

/** 节点菜单只追加说明型动作，删除与运行动作交给 builtins。 */
function createNodeMenuItems(
  options: CreateExampleContextMenuOptions,
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

/** 连线菜单只追加说明型动作，删除动作交给 builtins。 */
function createLinkMenuItems(
  options: CreateExampleContextMenuOptions,
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

/** 菜单浮层统一挂到文档 body，避免被 demo 画布容器裁剪。 */
function resolveContextMenuHost(container: HTMLElement): HTMLElement {
  return container.ownerDocument.body ?? container;
}

/** 节点 target 统一使用稳定 binding key，方便重绑和清理。 */
function createNodeMenuBindingKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/** 连线 target 也使用稳定 binding key，确保删除或 reset 时能精确解绑。 */
function createLinkMenuBindingKey(linkId: string): string {
  return `link:${linkId}`;
}

/**
 * 把具体节点视图挂到菜单系统里。
 *
 * `graph.getNodeView(...)` 返回的是当前可监听的 Leafer 宿主；
 * 这里顺手把节点标题和类型一起放进 meta，避免菜单 resolver 再反查 graph。
 */
function bindNodeContextMenuTarget(
  menu: LeaferContextMenu,
  options: CreateExampleContextMenuOptions,
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
 * 把具体连线视图挂到菜单系统里。
 *
 * 连线当前没有公开的 snapshot 读取接口，
 * 因此 demo 直接使用 hook 维护的最小连线元信息作为菜单 meta。
 */
function bindLinkContextMenuTarget(
  menu: LeaferContextMenu,
  options: CreateExampleContextMenuOptions,
  link: ExampleTrackedLinkEntry
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

/** 从 target meta 中安全读取字符串字段，避免菜单层依赖内部宿主结构。 */
function resolveTargetMetaText(
  context: LeaferContextMenuContext,
  key: "title" | "type" | "sourceNodeId" | "sourceSlot" | "targetNodeId" | "targetSlot"
): string | undefined {
  const value = context.target.meta?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** 节点菜单只关心标题和类型，因此这里再包一层语义更清楚的 helper。 */
function resolveNodeTargetText(
  context: LeaferContextMenuContext,
  key: "title" | "type"
): string | undefined {
  return resolveTargetMetaText(context, key);
}

/** 统一格式化连线说明，供菜单里的日志输出和删除反馈复用。 */
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
