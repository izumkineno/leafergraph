/**
 * 最小空画布 demo 的右键菜单桥接模块。
 *
 * @remarks
 * 这个文件只做两层接线：
 * - 先启用 `@leafergraph/context-menu-builtins` 内建节点图动作
 * - 再补上 `mini-graph` 自己特有的 demo 动作
 *
 * 这样通用右键能力能沉到包内复用，而 demo 仍能保留自己的说明性动作。
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
import type { GraphLink, NodeRuntimeState } from "@leafergraph/core/node";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput
} from "@leafergraph/core/contracts";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type {
  LeaferGraph,
} from "leafergraph";
import {
  EXAMPLE_EVENT_RELAY_NODE_TYPE,
  EXAMPLE_LONG_TASK_PROBE_NODE_TYPE,
  EXAMPLE_TICK_MONITOR_NODE_TYPE
} from "./example_demo_plugin";
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
  ensureAuthoringBasicNodesRegistered(): Promise<boolean>;
  playLongTaskProbeDemo(nodeId: string): void;
  listNodeIds(): readonly string[];
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState;
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  removeNode(nodeId: string): void;
  removeNodes(nodeIds: readonly string[]): void;
  removeLink(linkId: string): void;
  appendLog(message: string): void;
  clipboard: LeaferGraphContextMenuClipboardState;
  history?: {
    undo(): boolean;
    redo(): boolean;
    canUndo?(): boolean;
    canRedo?(): boolean;
  };
  resolveShortcutLabel?(
    actionId: LeaferGraphContextMenuBuiltinActionId
  ): string | undefined;
  resolveThemeMode(): LeaferGraphThemeMode;
}

const SYSTEM_ON_PLAY_NODE_TYPE = "system/on-play";
const SYSTEM_TIMER_NODE_TYPE = "system/timer";
const AUTHORING_BASIC_EVENT_QUEUE_NODE_TYPE = "events/queue";
const AUTHORING_BASIC_EVENT_DELAY_NODE_TYPE = "events/delay";
const AUTHORING_BASIC_EVENT_LOG_NODE_TYPE = "events/log";
const DEMO_CHAIN_NODE_GAP_X = 360;
const DELAY_DEMO_TIMER_INTERVAL_MS = 250;
const DELAY_DEMO_QUEUE_CAPACITY = 6;
const DELAY_DEMO_WAIT_MS = 1600;

/** 外部除了销毁外，还需要在节点和连线生命周期变化时同步菜单 target。 */
export interface ExampleContextMenuHandle {
  bindNodeTarget(nodeId: string): void;
  unbindNodeTarget(nodeId: string): void;
  bindLinkTarget(link: ExampleTrackedLinkEntry): void;
  unbindLinkTarget(linkId: string): void;
  isOpen(): boolean;
  destroy(): void;
}

/**
 * 创建一个专供 `mini-graph` 使用的右键菜单控制器。
 *
 * @remarks
 * - 通用功能全部来自 builtins
 * - demo 自己只额外注册 Reset / Clear Log / 信息记录等补丁动作
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createExampleContextMenu(
  options: CreateExampleContextMenuOptions
): ExampleContextMenuHandle {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const builtinsHost = createExampleBuiltinsHost(options);
  const menu = createLeaferContextMenu({
    app: options.graph.app,
    container: options.container,
    host: resolveContextMenuHost(options.container),
    resolveThemeMode: options.resolveThemeMode,
    // demo 端统一使用 hover 展开子菜单。
    config: {
      submenu: {
        triggerMode: "hover"
      }
    }
  });

  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  const disposeBuiltins = registerLeaferGraphContextMenuBuiltins(menu, {
    host: builtinsHost,
    clipboard: options.clipboard,
    history: options.history,
    resolveShortcutLabel: options.resolveShortcutLabel
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
    isOpen(): boolean {
      return menu.isOpen();
    },
    destroy(): void {
      disposeExampleResolver();
      disposeBuiltins();
      menu.destroy();
    }
  };
}

/**
 * 处理 `createExampleBuiltinsHost` 相关逻辑。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
function createExampleBuiltinsHost(
  options: CreateExampleContextMenuOptions
): LeaferGraphContextMenuBuiltinsHost {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
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
      return {
        nodeId: options.createNode(input).id
      };
    },
    createLink(input, _context) {
      return {
        linkId: options.createLink(input).id
      };
    },
    play(_context) {
      options.play();
    },
    step(_context) {
      options.step();
    },
    stop(_context) {
      options.stop();
    },
    fitView(_context) {
      options.fit();
    },
    // 再把 demo 自己的运行、日志和删除接线桥接到 builtins 宿主接口上。
    playFromNode(nodeId, _context) {
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
    removeNode(nodeId, _context) {
      options.removeNode(nodeId);
    },
    removeNodes(nodeIds, _context) {
      options.removeNodes(nodeIds);
    },
    removeLink(linkId, _context) {
      options.removeLink(linkId);
    }
  };

  // 再把组装好的宿主适配对象交给 builtins 注册链使用。
  return host;
}

/**
 *  demo 额外菜单项只保留说明型动作，不再重复实现通用内建动作。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 创建后的结果对象。
 */
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

  return createCanvasMenuItems(options, context);
}

/**
 *  画布菜单只保留 demo 专属动作，其余运行与建点能力全部走 builtins。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 创建后的结果对象。
 */
function createCanvasMenuItems(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): LeaferContextMenuItem[] {
  return [
    {
      key: "demo-canvas-insert-animation-chain",
      label: "插入动画示例链",
      description: "Start Event -> Timer -> Event Relay -> Tick Monitor",
      order: 72,
      onSelect() {
        insertAnimationDemoChain(options, context);
      }
    },
    {
      key: "demo-canvas-insert-long-task-chain",
      label: "插入长任务测试链",
      description: "Start Event -> Long Task Probe -> Tick Monitor，并自动演示运行进度",
      order: 73,
      onSelect() {
        insertLongTaskProbeDemoChain(options, context);
      }
    },
    {
      key: "demo-canvas-insert-delay-long-task-chain",
      label: "插入 Delay 长任务示例链",
      description:
        "Start Event -> Timer -> Queue -> Delay -> Log Event，首次使用会按需加载 authoring-basic-nodes",
      order: 74,
      onSelect() {
        void insertDelayLongTaskDemoChain(options, context);
      }
    },
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

/**
 * 插入动画`Demo` 链路。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 无返回值。
 */
function insertAnimationDemoChain(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): void {
  // 先整理当前阶段需要的输入、状态与依赖。
  const origin = resolveCanvasCreatePosition(context);

  try {
    const startNode = options.createNode({
      type: SYSTEM_ON_PLAY_NODE_TYPE,
      x: origin.x,
      y: origin.y
    });
    const timerNode = options.createNode({
      type: SYSTEM_TIMER_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X,
      y: origin.y
    });
    const relayNode = options.createNode({
      type: EXAMPLE_EVENT_RELAY_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X * 2,
      y: origin.y
    });
    const monitorNode = options.createNode({
      type: EXAMPLE_TICK_MONITOR_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X * 3,
      y: origin.y
    });

    // 再执行核心逻辑，并把结果或副作用统一收口。
    options.createLink({
      source: { nodeId: startNode.id, slot: 0 },
      target: { nodeId: timerNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: timerNode.id, slot: 0 },
      target: { nodeId: relayNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: relayNode.id, slot: 0 },
      target: { nodeId: monitorNode.id, slot: 0 }
    });

    options.fit();
    options.appendLog(
      "已插入动画示例链：Start Event -> Timer -> Event Relay -> Tick Monitor"
    );
  } catch (error) {
    options.appendLog(
      error instanceof Error
        ? `插入动画示例链失败：${error.message}`
        : "插入动画示例链失败"
    );
  }
}

/**
 * 插入长任务测试链，并自动回放一段 probe 状态演示。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 无返回值。
 */
function insertLongTaskProbeDemoChain(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): void {
  const origin = resolveCanvasCreatePosition(context);

  try {
    const startNode = options.createNode({
      type: SYSTEM_ON_PLAY_NODE_TYPE,
      x: origin.x,
      y: origin.y
    });
    const probeNode = options.createNode({
      type: EXAMPLE_LONG_TASK_PROBE_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X,
      y: origin.y
    });
    const monitorNode = options.createNode({
      type: EXAMPLE_TICK_MONITOR_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X * 2,
      y: origin.y
    });

    options.createLink({
      source: { nodeId: startNode.id, slot: 0 },
      target: { nodeId: probeNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: probeNode.id, slot: 0 },
      target: { nodeId: monitorNode.id, slot: 0 }
    });

    options.graph.setSelectedNodeIds([probeNode.id], "replace");
    options.fit();
    options.playLongTaskProbeDemo(probeNode.id);
    options.appendLog(
      "已插入长任务测试链：Start Event -> Long Task Probe -> Tick Monitor"
    );
  } catch (error) {
    options.appendLog(
      error instanceof Error
        ? `插入长任务测试链失败：${error.message}`
        : "插入长任务测试链失败"
    );
  }
}

/**
 * 插入 Delay 长任务示例链，并直接触发一次等待进度演示。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 无返回值。
 */
async function insertDelayLongTaskDemoChain(
  options: CreateExampleContextMenuOptions,
  context: LeaferContextMenuContext
): Promise<void> {
  const origin = resolveCanvasCreatePosition(context);

  if (!hasNodeType(options, AUTHORING_BASIC_EVENT_DELAY_NODE_TYPE)) {
    const ready = await options.ensureAuthoringBasicNodesRegistered();
    if (!ready) {
      options.appendLog("插入 Delay 长任务示例链失败：authoring-basic-nodes 未就绪");
      return;
    }
  }

  if (
    !hasNodeType(options, AUTHORING_BASIC_EVENT_QUEUE_NODE_TYPE) ||
    !hasNodeType(options, AUTHORING_BASIC_EVENT_DELAY_NODE_TYPE) ||
    !hasNodeType(options, AUTHORING_BASIC_EVENT_LOG_NODE_TYPE)
  ) {
    options.appendLog(
      "插入 Delay 长任务示例链失败：缺少 events/queue、events/delay 或 events/log 节点定义"
    );
    return;
  }

  try {
    const startNode = options.createNode({
      type: SYSTEM_ON_PLAY_NODE_TYPE,
      x: origin.x,
      y: origin.y
    });
    const timerNode = options.createNode({
      type: SYSTEM_TIMER_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X,
      y: origin.y
    });
    const queueNode = options.createNode({
      type: AUTHORING_BASIC_EVENT_QUEUE_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X * 2,
      y: origin.y
    });
    const delayNode = options.createNode({
      type: AUTHORING_BASIC_EVENT_DELAY_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X * 3,
      y: origin.y
    });
    const logNode = options.createNode({
      type: AUTHORING_BASIC_EVENT_LOG_NODE_TYPE,
      x: origin.x + DEMO_CHAIN_NODE_GAP_X * 4,
      y: origin.y
    });

    options.graph.setNodeWidgetValue(timerNode.id, 0, DELAY_DEMO_TIMER_INTERVAL_MS);
    options.graph.setNodeWidgetValue(queueNode.id, 0, DELAY_DEMO_QUEUE_CAPACITY);
    options.graph.setNodeWidgetValue(delayNode.id, 0, DELAY_DEMO_WAIT_MS);
    options.createLink({
      source: { nodeId: startNode.id, slot: 0 },
      target: { nodeId: timerNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: timerNode.id, slot: 0 },
      target: { nodeId: queueNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: queueNode.id, slot: 0 },
      target: { nodeId: delayNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: delayNode.id, slot: 0 },
      target: { nodeId: logNode.id, slot: 0 }
    });
    options.createLink({
      source: { nodeId: delayNode.id, slot: 0 },
      target: { nodeId: queueNode.id, slot: 1 }
    });

    options.graph.setSelectedNodeIds([delayNode.id], "replace");
    options.fit();
    options.play();
    options.appendLog(
      `已插入 Delay 长任务示例链：Start Event -> Timer ${DELAY_DEMO_TIMER_INTERVAL_MS}ms -> Queue ${DELAY_DEMO_QUEUE_CAPACITY} -> Delay ${DELAY_DEMO_WAIT_MS}ms -> Log Event`
    );
  } catch (error) {
    options.appendLog(
      error instanceof Error
        ? `插入 Delay 长任务示例链失败：${error.message}`
        : "插入 Delay 长任务示例链失败"
    );
  }
}

/**
 *  节点菜单只追加说明型动作，删除与运行动作交给 builtins。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 创建后的结果对象。
 */
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

/**
 *  连线菜单只追加说明型动作，删除动作交给 builtins。
 *
 * @param options - 可选配置项。
 * @param context - 当前上下文。
 * @returns 创建后的结果对象。
 */
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

/**
 *  菜单浮层统一挂到文档 body，避免被 demo 画布容器裁剪。
 *
 * @param container - `container`。
 * @returns 处理后的结果。
 */
function resolveContextMenuHost(container: HTMLElement): HTMLElement {
  return container.ownerDocument.body ?? container;
}

/**
 * 判断当前注册表里是否已经存在指定节点类型。
 *
 * @param options - 可选配置项。
 * @param nodeType - 节点类型。
 * @returns 是否存在。
 */
function hasNodeType(
  options: CreateExampleContextMenuOptions,
  nodeType: string
): boolean {
  return options.graph.listNodes().some((node) => node.type === nodeType);
}

/**
 * 解析画布创建位置。
 *
 * @param context - 当前上下文。
 * @returns 处理后的结果。
 */
function resolveCanvasCreatePosition(context: Pick<
  LeaferContextMenuContext,
  "pagePoint" | "worldPoint" | "containerPoint"
>) {
  if (
    Number.isFinite(context.pagePoint.x) &&
    Number.isFinite(context.pagePoint.y)
  ) {
    return {
      x: context.pagePoint.x,
      y: context.pagePoint.y
    };
  }

  if (context.worldPoint) {
    return {
      x: context.worldPoint.x,
      y: context.worldPoint.y
    };
  }

  return {
    x: context.containerPoint.x,
    y: context.containerPoint.y
  };
}

/**
 *  节点 target 统一使用稳定 binding key，方便重绑和清理。
 *
 * @param nodeId - 目标节点 ID。
 * @returns 创建后的结果对象。
 */
function createNodeMenuBindingKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/**
 *  连线 target 也使用稳定 binding key，确保删除或 reset 时能精确解绑。
 *
 * @param linkId - 目标连线 ID。
 * @returns 创建后的结果对象。
 */
function createLinkMenuBindingKey(linkId: string): string {
  return `link:${linkId}`;
}

/**
 * 把具体节点视图挂到菜单系统里。
 *
 * `graph.getNodeView(...)` 返回的是当前可监听的 Leafer 宿主；
 * 这里顺手把节点标题和类型一起放进 meta，避免菜单 resolver 再反查 graph。
 *
 * @param menu - 菜单。
 * @param options - 可选配置项。
 * @param nodeId - 目标节点 ID。
 * @returns 无返回值。
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
 *
 * @param menu - 菜单。
 * @param options - 可选配置项。
 * @param link - 连线。
 * @returns 无返回值。
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

/**
 *  从 target meta 中安全读取字符串字段，避免菜单层依赖内部宿主结构。
 *
 * @param context - 当前上下文。
 * @param key - 键值。
 * @returns 处理后的结果。
 */
function resolveTargetMetaText(
  context: LeaferContextMenuContext,
  key: "title" | "type" | "sourceNodeId" | "sourceSlot" | "targetNodeId" | "targetSlot"
): string | undefined {
  const value = context.target.meta?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 *  节点菜单只关心标题和类型，因此这里再包一层语义更清楚的 helper。
 *
 * @param context - 当前上下文。
 * @param key - 键值。
 * @returns 处理后的结果。
 */
function resolveNodeTargetText(
  context: LeaferContextMenuContext,
  key: "title" | "type"
): string | undefined {
  return resolveTargetMetaText(context, key);
}

/**
 *  统一格式化连线说明，供菜单里的日志输出和删除反馈复用。
 *
 * @param input - 输入参数。
 * @returns 处理后的结果。
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
