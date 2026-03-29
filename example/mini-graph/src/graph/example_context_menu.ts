/**
 * 最小空画布 demo 的右键菜单桥接模块。
 *
 * @remarks
 * 当前 demo 仍然保持“最小宿主页”定位，但右键菜单已经承担三类职责：
 * - Leafer-first 右键菜单实例创建
 * - 画布 / 节点 / 连线 菜单项解析
 * - 节点 / 连线 target 绑定与解绑
 * - 统一销毁入口
 */

import {
  createLeaferContextMenu,
  type LeaferContextMenuContext,
  type LeaferContextMenuItem
} from "@leafergraph/context-menu";
import type { LeaferGraph } from "leafergraph";
import type {
  ExampleCreateNodeFromRegistryInput,
  ExampleRegisteredNodeEntry,
  ExampleTrackedLinkEntry
} from "./use_example_graph";

interface LeaferWorldPointResolver {
  getWorldPointByClient?(
    clientPoint: {
      clientX: number;
      clientY: number;
    },
    updateClient?: boolean
  ): {
    x: number;
    y: number;
  };
}

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
  listRegisteredNodes(): ExampleRegisteredNodeEntry[];
  createNodeFromRegistry(input: ExampleCreateNodeFromRegistryInput): void;
  removeNode(nodeId: string): void;
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
 * 画布 target 由菜单包默认处理；节点和连线 target 则由 demo 在这里显式绑定。
 */
export function createExampleContextMenu(
  options: CreateExampleContextMenuOptions
): ExampleContextMenuHandle {
  const menu = createLeaferContextMenu({
    app: options.graph.app,
    container: options.container,
    host: resolveContextMenuHost(options.container),
    // demo 端统一用 hover 展开子菜单；混合设备是否需要退化由菜单包内部判断。
    submenuTriggerMode: "hover",
    resolveItems(context) {
      if (context.target.kind === "node") {
        return createNodeMenuItems(options, context);
      }

      if (context.target.kind === "link") {
        return createLinkMenuItems(options, context);
      }

      return createCanvasMenuItems(options, context);
    }
  });

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
      menu.destroy();
    }
  };
}

/** 画布菜单：承载运行控制和 demo 辅助动作。 */
function createCanvasMenuItems(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  return [
    {
      kind: "submenu",
      key: "canvas-runtime",
      label: "运行控制",
      children: [
        {
          key: "canvas-play",
          label: "Play",
          onSelect() {
            options.play();
          }
        },
        {
          key: "canvas-step",
          label: "Step",
          onSelect() {
            options.step();
          }
        },
        {
          key: "canvas-stop",
          label: "Stop",
          onSelect() {
            options.stop();
          }
        }
      ]
    },
    {
      kind: "submenu",
      key: "canvas-actions",
      label: "画布操作",
      children: [
        {
          key: "canvas-fit",
          label: "Fit View",
          onSelect() {
            options.fit();
          }
        },
        {
          key: "canvas-clear-log",
          label: "Clear Log",
          onSelect() {
            options.clearLog();
            options.appendLog("已通过右键菜单清空运行日志");
          }
        }
      ]
    },
    {
      kind: "submenu",
      key: "canvas-add-node",
      label: "从注册表添加节点",
      children: createRegisteredNodeCategoryItems(options, context)
    },
    { kind: "separator", key: "canvas-divider" },
    {
      key: "canvas-reset",
      label: "Reset Example",
      onSelect() {
        options.reset();
      }
    }
  ];
}

/** 按分类组织当前已注册节点，让菜单层级在节点增多时仍然清晰。 */
function createRegisteredNodeCategoryItems(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  const registeredNodes = options.listRegisteredNodes();
  if (!registeredNodes.length) {
    return [
      {
        key: "canvas-add-node-empty",
        label: "暂无可添加节点",
        disabled: true
      }
    ];
  }

  const groupedNodes = new Map<string, ExampleRegisteredNodeEntry[]>();
  for (const entry of registeredNodes) {
    const currentEntries = groupedNodes.get(entry.category);
    if (currentEntries) {
      currentEntries.push(entry);
      continue;
    }

    groupedNodes.set(entry.category, [entry]);
  }

  const categoryItems: LeaferContextMenuItem[] = [];
  for (const [category, entries] of groupedNodes) {
    const children = entries.map((entry) =>
      createRegisteredNodeActionItem(options, context, entry)
    );
    if (!children.length) {
      continue;
    }

    categoryItems.push({
      kind: "submenu",
      key: `canvas-add-node-category:${category}`,
      label: category,
      children
    });
  }

  return categoryItems.length
    ? categoryItems
    : [
        {
          key: "canvas-add-node-empty",
          label: "暂无可添加节点",
          disabled: true
        }
      ];
}

/** 单个节点菜单项只负责把类型和坐标交给 hook，由 hook 完成真正建点。 */
function createRegisteredNodeActionItem(
  options: CreateExampleContextMenuOptions,
  rootContext: LeaferContextMenuContext,
  entry: ExampleRegisteredNodeEntry
): LeaferContextMenuItem {
  return {
    key: `canvas-add-node:${entry.type}`,
    label: entry.title,
    description: entry.description,
    onSelect(actionContext) {
      options.createNodeFromRegistry({
        type: entry.type,
        position: resolveCreateNodePosition(options, actionContext ?? rootContext)
      });
    }
  };
}

/** 节点菜单只保留最小但实用的上下文动作。 */
function createNodeMenuItems(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  const nodeId = context.target.id;
  const nodeTitle = resolveNodeTargetText(context, "title");
  const nodeType = resolveNodeTargetText(context, "type");

  return [
    {
      key: "node-log-info",
      label: "记录节点信息",
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
    { kind: "separator", key: "node-divider" },
    {
      key: "node-remove",
      label: "删除节点",
      danger: true,
      disabled: !nodeId,
      onSelect() {
        if (!nodeId) {
          options.appendLog("当前节点缺少 nodeId，无法删除");
          return;
        }

        options.removeNode(nodeId);
      }
    }
  ];
}

/** 连线菜单聚焦在“看清端点”和“立即删除”这两类最小动作。 */
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
      key: "link-log-info",
      label: "记录连线信息",
      disabled: !linkId,
      onSelect() {
        if (!linkId) {
          options.appendLog("当前连线缺少 linkId，无法记录连线信息");
          return;
        }

        options.appendLog(`连线信息：${summary}`);
      }
    },
    { kind: "separator", key: "link-divider" },
    {
      key: "link-remove",
      label: "删除连线",
      danger: true,
      disabled: !linkId,
      onSelect() {
        if (!linkId) {
          options.appendLog("当前连线缺少 linkId，无法删除");
          return;
        }

        options.removeLink(linkId);
      }
    }
  ];
}

/** 优先使用 Leafer 菜单事件给出的图坐标；缺失时回退到当前可视区域中心。 */
function resolveCreateNodePosition(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): {
  x: number;
  y: number;
} {
  if (context.worldPoint) {
    return {
      x: context.worldPoint.x,
      y: context.worldPoint.y
    };
  }

  const rect = options.container.getBoundingClientRect();
  const app = options.graph.app as typeof options.graph.app & LeaferWorldPointResolver;
  const worldPoint = app.getWorldPointByClient?.(
    {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    },
    true
  );

  if (worldPoint) {
    return worldPoint;
  }

  return {
    x: context.containerPoint.x,
    y: context.containerPoint.y
  };
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
  menu: ReturnType<typeof createLeaferContextMenu>,
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
  menu: ReturnType<typeof createLeaferContextMenu>,
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
