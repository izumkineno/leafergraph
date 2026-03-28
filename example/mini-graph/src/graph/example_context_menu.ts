/**
 * 最小执行链 demo 的右键菜单桥接模块。
 *
 * @remarks
 * 这个文件专门负责把 `@leafergraph/context-menu` 接到 `mini-graph`：
 * - 创建 Leafer-first 右键菜单实例
 * - 生成画布、节点、连线三类菜单
 * - 在 reset 之后重绑节点和连线目标
 *
 * 页面层和图生命周期 hook 只和这个模块交换最小接口，
 * 不直接持有菜单内部实现细节。
 */

import {
  createLeaferContextMenu,
  type LeaferContextMenuContext,
  type LeaferContextMenuItem
} from "@leafergraph/context-menu";
import type { LeaferGraph } from "leafergraph";
import {
  createExampleSeedLinks,
  createExampleSeedNodes
} from "./example_document";

/** 节点菜单上下文里需要稳定透传的最小节点元信息。 */
export interface ExampleContextMenuNodeMeta extends Record<string, unknown> {
  id: string;
  type: string;
  title: string;
}

/** 连线菜单上下文里需要稳定透传的最小连线元信息。 */
export interface ExampleContextMenuLinkMeta extends Record<string, unknown> {
  id: string;
  source: {
    nodeId: string;
    slot: number;
  };
  target: {
    nodeId: string;
    slot: number;
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
  appendLog(message: string): void;
  resolveNodeMeta(nodeId: string): ExampleContextMenuNodeMeta | undefined;
  resolveLinkMeta(linkId: string): ExampleContextMenuLinkMeta | undefined;
}

/** 外部只关心重绑和销毁，不暴露更多内部状态。 */
export interface ExampleContextMenuHandle {
  rebindTargets(): void;
  destroy(): void;
}

const EXAMPLE_NODE_IDS = createExampleSeedNodes()
  .map((node) => node.id)
  .filter(isDefinedString);
const EXAMPLE_LINK_IDS = createExampleSeedLinks()
  .map((link) => link.id)
  .filter(isDefinedString);

/**
 * 创建一个专供 `mini-graph` 使用的右键菜单控制器。
 *
 * @remarks
 * 画布菜单是固定挂载；
 * 节点和连线因为 reset 后会被重建，所以必须通过 `rebindTargets()` 重新绑定。
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
      return resolveExampleContextMenuItems(context, options);
    }
  });
  const nodeBindingKeys = new Set<string>();
  const linkBindingKeys = new Set<string>();

  /** 统一解绑一组动态 binding，避免 reset 后残留旧 view 引用。 */
  const unbindTrackedKeys = (keys: Set<string>): void => {
    for (const key of keys) {
      menu.unbindTarget(key);
    }

    keys.clear();
  };

  /** 按当前图里的示例节点重新挂接节点菜单。 */
  const bindNodeTargets = (): void => {
    for (const nodeId of EXAMPLE_NODE_IDS) {
      const nodeView = options.graph.getNodeView(nodeId);
      const nodeMeta = options.resolveNodeMeta(nodeId);
      if (!nodeView || !nodeMeta) {
        continue;
      }

      const bindingKey = createNodeBindingKey(nodeId);
      menu.bindTarget({
        key: bindingKey,
        kind: "node",
        target: nodeView,
        meta: nodeMeta,
        resolveTarget() {
          return {
            kind: "node",
            id: nodeId,
            meta: nodeMeta,
            data: nodeMeta
          };
        }
      });
      nodeBindingKeys.add(bindingKey);
    }
  };

  /** 按当前图里的示例连线重新挂接连线菜单。 */
  const bindLinkTargets = (): void => {
    for (const linkId of EXAMPLE_LINK_IDS) {
      const linkView = options.graph.getLinkView(linkId);
      const linkMeta = options.resolveLinkMeta(linkId);
      if (!linkView || !linkMeta) {
        continue;
      }

      const bindingKey = createLinkBindingKey(linkId);
      menu.bindTarget({
        key: bindingKey,
        kind: "link",
        target: linkView,
        meta: linkMeta,
        resolveTarget() {
          return {
            kind: "link",
            id: linkId,
            meta: linkMeta,
            data: linkMeta
          };
        }
      });
      linkBindingKeys.add(bindingKey);
    }
  };

  return {
    rebindTargets(): void {
      // reset 后旧 view 会失效，先关闭菜单并清空旧 binding，再绑定当前视图。
      menu.close();
      unbindTrackedKeys(nodeBindingKeys);
      unbindTrackedKeys(linkBindingKeys);
      bindNodeTargets();
      bindLinkTargets();
    },
    destroy(): void {
      unbindTrackedKeys(nodeBindingKeys);
      unbindTrackedKeys(linkBindingKeys);
      menu.destroy();
    }
  };
}

/** 根据当前 target kind 解析 demo 需要展示的菜单项。 */
function resolveExampleContextMenuItems(
  context: LeaferContextMenuContext,
  options: CreateExampleContextMenuOptions
): LeaferContextMenuItem[] {
  switch (context.target.kind) {
    case "node":
      return createNodeMenuItems(context, options);
    case "link":
      return createLinkMenuItems(context, options);
    default:
      return createCanvasMenuItems(options);
  }
}

/** 画布菜单：承载运行控制和 demo 辅助动作。 */
function createCanvasMenuItems(
  options: CreateExampleContextMenuOptions
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

/** 节点菜单：演示节点级 target 分类和节点元信息读取。 */
function createNodeMenuItems(
  context: LeaferContextMenuContext,
  options: CreateExampleContextMenuOptions
): LeaferContextMenuItem[] {
  const nodeId = typeof context.target.id === "string" ? context.target.id : undefined;
  const nodeMeta =
    (context.target.meta as ExampleContextMenuNodeMeta | undefined) ??
    (nodeId ? options.resolveNodeMeta(nodeId) : undefined);

  if (!nodeId || !nodeMeta) {
    return createCanvasMenuItems(options);
  }

  return [
    {
      key: `node-play-${nodeId}`,
      label: "从该节点开始执行",
      description: `${nodeMeta.title} · ${nodeMeta.type}`,
      onSelect() {
        const started = options.graph.playFromNode(nodeId, {
          source: "context-menu"
        });
        options.appendLog(
          started
            ? `已从节点 ${nodeMeta.title} 开始执行`
            : `节点 ${nodeMeta.title} 当前不可直接执行`
        );
      }
    },
    {
      key: `node-log-${nodeId}`,
      label: "记录节点信息",
      description: nodeMeta.id,
      onSelect() {
        options.appendLog(formatNodeMetaMessage(nodeMeta));
      }
    },
    { kind: "separator", key: `node-divider-${nodeId}` },
    {
      key: `node-fit-${nodeId}`,
      label: "Fit View",
      onSelect() {
        options.fit();
      }
    }
  ];
}

/** 连线菜单：演示 link target 分类与连线信息投影。 */
function createLinkMenuItems(
  context: LeaferContextMenuContext,
  options: CreateExampleContextMenuOptions
): LeaferContextMenuItem[] {
  const linkId = typeof context.target.id === "string" ? context.target.id : undefined;
  const linkMeta =
    (context.target.meta as ExampleContextMenuLinkMeta | undefined) ??
    (linkId ? options.resolveLinkMeta(linkId) : undefined);

  if (!linkId || !linkMeta) {
    return createCanvasMenuItems(options);
  }

  return [
    {
      key: `link-log-${linkId}`,
      label: "记录连线信息",
      description: `${linkMeta.source.nodeId} -> ${linkMeta.target.nodeId}`,
      onSelect() {
        options.appendLog(formatLinkMetaMessage(linkMeta));
      }
    },
    { kind: "separator", key: `link-divider-${linkId}` },
    {
      key: `link-fit-${linkId}`,
      label: "Fit View",
      onSelect() {
        options.fit();
      }
    }
  ];
}

/** 节点 binding key 使用固定前缀，方便 reset 时成组解绑。 */
function createNodeBindingKey(nodeId: string): string {
  return `example-node:${nodeId}`;
}

/** 连线 binding key 使用固定前缀，方便 reset 时成组解绑。 */
function createLinkBindingKey(linkId: string): string {
  return `example-link:${linkId}`;
}

/** 菜单浮层统一挂到文档 body，避免被 demo 画布容器裁剪。 */
function resolveContextMenuHost(container: HTMLElement): HTMLElement {
  return container.ownerDocument.body ?? container;
}

/** 把节点元信息格式化成适合日志面板显示的短文本。 */
function formatNodeMetaMessage(meta: ExampleContextMenuNodeMeta): string {
  return `节点 ${meta.title} · ${meta.type} · id=${meta.id}`;
}

/** 把连线元信息格式化成适合日志面板显示的短文本。 */
function formatLinkMetaMessage(meta: ExampleContextMenuLinkMeta): string {
  return `连线 ${meta.id} · ${meta.source.nodeId}[${meta.source.slot}] -> ${meta.target.nodeId}[${meta.target.slot}]`;
}

/** 把 seed 里的可选 id 过滤成稳定字符串，方便后续绑定。 */
function isDefinedString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
