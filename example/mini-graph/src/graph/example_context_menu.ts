/**
 * 最小空画布 demo 的右键菜单桥接模块。
 *
 * @remarks
 * 当前 demo 已经收口成默认空画布，因此这里只保留：
 * - Leafer-first 右键菜单实例创建
 * - 画布菜单项解析
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
  ExampleRegisteredNodeEntry
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
  appendLog(message: string): void;
}

/** 外部当前只需要销毁入口。 */
export interface ExampleContextMenuHandle {
  destroy(): void;
}

/**
 * 创建一个专供 `mini-graph` 使用的右键菜单控制器。
 *
 * @remarks
 * 由于默认场景只有空画布，这里不再维护节点或连线 target 的重绑逻辑。
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
      return createCanvasMenuItems(options, context);
    }
  });

  return {
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
