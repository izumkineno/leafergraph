import { useEffect, useRef } from "preact/hooks";

import {
  createLeaferGraph,
  createLeaferGraphContextMenu,
  type LeaferGraph,
  type LeaferGraphData,
  type LeaferGraphContextMenuContext,
  type LeaferGraphContextMenuItem,
  type LeaferGraphContextMenuManager,
  type LeaferGraphOptions
} from "leafergraph";
import {
  createEditorNodeCommandController,
  type EditorNodeCommandController
} from "../commands/node_commands";
import {
  createEditorCanvasCommandController,
  type EditorCanvasCommandController
} from "../commands/canvas_commands";
import { createEditorNodeSelection } from "../state/selection";
import {
  GRAPH_VIEWPORT_BACKGROUND_SIZE,
  resolveGraphViewportBackground,
  type EditorTheme
} from "../theme";

interface GraphViewportProps {
  graph: LeaferGraphData;
  modules?: LeaferGraphOptions["modules"];
  plugins?: LeaferGraphOptions["plugins"];
  quickCreateNodeType?: string;
  theme: EditorTheme;
}

/**
 * editor 当前关心的节点按下事件最小子集。
 * 这里只读取修饰键，不直接依赖 Leafer 完整事件类型，避免把 editor 绑死到具体实现细节。
 */
interface EditorNodePointerDownEvent {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  left?: boolean;
  right?: boolean;
  origin?: {
    button?: number;
  };
}

/**
 * editor 只需要 Leafer 的最小坐标换算能力，
 * 用来把宿主 DOM 指针位置转换成画布世界坐标。
 */
interface GraphViewportCoordinateHost {
  getWorldPointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
  getPagePointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
}

/**
 * editor 只需要树层最小事件订阅能力，
 * 用来监听视口缩放和平移后的坐标系变化。
 */
interface GraphViewportViewEventHost {
  on(type: string, listener: () => void): void;
  off(type: string, listener: () => void): void;
}

/** 左键框选在 DOM overlay 中使用的本地矩形。 */
interface GraphViewportSelectionBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 左键框选运行时状态。
 * `baseSelectedNodeIds` 用来支持 `Ctrl / Shift` 加选模式。
 */
interface GraphViewportMarqueeState {
  sequence: number;
  pointerId: number;
  append: boolean;
  startClientX: number;
  startClientY: number;
  startWorldX: number;
  startWorldY: number;
  baseSelectedNodeIds: readonly string[];
}

/**
 * 节点菜单挂载元信息。
 * editor 当前还没有完整选区和命令系统，因此先把节点级菜单真正需要的最小信息集中到这里。
 */
interface GraphViewportNodeMenuBindingMeta extends Record<string, unknown> {
  nodeId: string;
  nodeTitle: string;
  nodeType?: string;
}

/**
 * 为节点级菜单生成挂载 key。
 * 统一 key 规则后，新建、删除和未来的重绑逻辑都可以共用一条路径。
 */
function createNodeMenuBindingKey(nodeId: string): string {
  return `node:${nodeId}`;
}

/** 规范化节点菜单挂载元信息。 */
function createNodeMenuBindingMeta(node: {
  id: string;
  title: string;
  type?: string;
}): GraphViewportNodeMenuBindingMeta {
  return {
    nodeId: node.id,
    nodeTitle: node.title,
    nodeType: node.type
  };
}

/** 判断当前激活元素是否处于文本编辑场景，避免快捷键误删。 */
function isTextEditingElement(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName;
  return (
    element.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

/** 判断是否按下了当前平台的主命令修饰键。 */
function hasPrimaryCommandModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

/**
 * 绑定或刷新单个节点的右键菜单。
 * 这里显式先解绑再绑定，避免后续节点视图被替换时菜单仍然挂在旧图元上。
 */
function bindNodeContextMenu(
  graph: LeaferGraph,
  menu: LeaferGraphContextMenuManager,
  onSelectNode: (nodeId: string, event?: EditorNodePointerDownEvent) => void,
  node: {
    id: string;
    title: string;
    type?: string;
  }
): void {
  const key = createNodeMenuBindingKey(node.id);
  const view = graph.getNodeView(node.id);
  if (!view) {
    return;
  }

  view.on("pointer.down", (event: EditorNodePointerDownEvent) => {
    onSelectNode(node.id, event);
  });
  menu.unbindTarget(key);
  menu.bindNode(key, view, createNodeMenuBindingMeta(node));
}

/** 判断节点点击是否应该走“切换选区”路径。 */
function shouldToggleSelectionByPointerEvent(
  event?: EditorNodePointerDownEvent
): boolean {
  return Boolean(event?.ctrlKey || event?.metaKey || event?.shiftKey);
}

/** 统一判断一次节点按下是否来自右键。 */
function isSecondaryPointerDownEvent(
  event?: EditorNodePointerDownEvent
): boolean {
  return Boolean(
    event?.right || event?.button === 2 || event?.origin?.button === 2
  );
}

/** 由两个 client 点生成标准化的本地框选矩形。 */
function resolveSelectionBox(
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number,
  hostRect: DOMRect
): GraphViewportSelectionBox {
  const left = Math.min(startClientX, currentClientX) - hostRect.left;
  const top = Math.min(startClientY, currentClientY) - hostRect.top;
  const right = Math.max(startClientX, currentClientX) - hostRect.left;
  const bottom = Math.max(startClientY, currentClientY) - hostRect.top;

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

/** 判断两个世界坐标包围盒是否发生相交。 */
function intersectsWorldBounds(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * 把 editor 壳层和 LeaferGraph 实例连接起来。
 * 除了负责图初始化，这里也承担画布背景与 editor 主题同步的职责。
 */
export function GraphViewport({
  graph: graphData,
  modules,
  plugins,
  quickCreateNodeType,
  theme
}: GraphViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectionBoxRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<LeaferGraph | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    host.style.background = resolveGraphViewportBackground(theme);
    host.style.backgroundSize = GRAPH_VIEWPORT_BACKGROUND_SIZE;
    graphRef.current?.setThemeMode(theme);
  }, [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const graph = createLeaferGraph(host, {
      graph: graphData,
      modules,
      plugins,
      fill: resolveGraphViewportBackground(themeRef.current),
      themeMode: themeRef.current,
      widgetEditing: {
        enabled: true,
        useOfficialTextEditor: true,
        allowOptionsMenu: true
      }
    });
    graphRef.current = graph;
    const selection = createEditorNodeSelection(graph);
    const ownerWindow = host.ownerDocument.defaultView ?? window;
    let graphReady = false;
    let pointerDownSequence = 0;
    let hitNodePointerDownSequence = -1;
    let pendingCanvasSelectionFrame = 0;
    let pendingPointerWorldSyncFrame = 0;
    let spaceKeyPressed = false;
    let lastPointerClientPoint: { clientX: number; clientY: number } | null = null;
    let lastPointerWorldPoint: { x: number; y: number } | null = null;
    let lastPointerPagePoint: { x: number; y: number } | null = null;
    let pendingMarqueeSelection: GraphViewportMarqueeState | null = null;
    let activeMarqueeSelection: GraphViewportMarqueeState | null = null;
    const boundNodeIds = new Set<string>();
    let menu!: LeaferGraphContextMenuManager;
    let commands!: EditorNodeCommandController;
    let canvasCommands!: EditorCanvasCommandController;
    let disposed = false;
    const hideSelectionBox = (): void => {
      const selectionBox = selectionBoxRef.current;
      if (!selectionBox) {
        return;
      }

      selectionBox.dataset.visible = "false";
      selectionBox.style.opacity = "0";
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
    };
    const showSelectionBox = (box: GraphViewportSelectionBox): void => {
      const selectionBox = selectionBoxRef.current;
      if (!selectionBox) {
        return;
      }

      selectionBox.dataset.visible = "true";
      selectionBox.style.opacity = "1";
      selectionBox.style.left = `${box.left}px`;
      selectionBox.style.top = `${box.top}px`;
      selectionBox.style.width = `${box.width}px`;
      selectionBox.style.height = `${box.height}px`;
    };
    const resolveWorldPointByClient = (
      clientX: number,
      clientY: number
    ): { x: number; y: number } =>
      (
        graph.app as typeof graph.app & GraphViewportCoordinateHost
      ).getWorldPointByClient(
        {
          clientX,
          clientY
        },
        true
      );
    const resolvePagePointByClient = (
      clientX: number,
      clientY: number
    ): { x: number; y: number } =>
      (
        graph.app as typeof graph.app & GraphViewportCoordinateHost
      ).getPagePointByClient(
        {
          clientX,
          clientY
        },
        true
      );
    /** 用当前记住的 client 坐标，同时刷新 world / page 两套坐标。 */
    const refreshPointerPoints = (): void => {
      if (!lastPointerClientPoint) {
        return;
      }

      lastPointerWorldPoint = resolveWorldPointByClient(
        lastPointerClientPoint.clientX,
        lastPointerClientPoint.clientY
      );
      lastPointerPagePoint = resolvePagePointByClient(
        lastPointerClientPoint.clientX,
        lastPointerClientPoint.clientY
      );
    };
    /**
     * 统一记录“鼠标最后一次停留的 client 坐标”，
     * 并立即解析成当前视口下的 world / page 坐标，供命中与粘贴复用。
     */
    const syncPointerPointsByClient = (
      clientX: number,
      clientY: number
    ): void => {
      lastPointerClientPoint = { clientX, clientY };
      lastPointerWorldPoint = resolveWorldPointByClient(clientX, clientY);
      lastPointerPagePoint = resolvePagePointByClient(clientX, clientY);
    };
    /**
     * 视口缩放 / 平移后，同一组 client 坐标对应的世界坐标会变化。
     * 这里延后一帧重算，确保粘贴仍然落在鼠标当前位置。
     */
    const schedulePointerWorldPointRefresh = (): void => {
      if (!lastPointerClientPoint) {
        return;
      }

      if (pendingPointerWorldSyncFrame) {
        ownerWindow.cancelAnimationFrame(pendingPointerWorldSyncFrame);
      }

      pendingPointerWorldSyncFrame = ownerWindow.requestAnimationFrame(() => {
        pendingPointerWorldSyncFrame = 0;

        if (disposed) {
          return;
        }

        refreshPointerPoints();
      });
    };
    /**
     * 把依赖“当前视口矩阵”的动作延后一帧执行。
     * 这样在滚轮缩放、平移或 `fitView()` 紧接着触发粘贴时，
     * 可以尽量避免拿到尚未稳定的新旧混合坐标。
     */
    const runAfterViewportSettle = (callback: () => void): void => {
      ownerWindow.requestAnimationFrame(() => {
        if (disposed) {
          return;
        }

        refreshPointerPoints();
        callback();
      });
    };
    /**
     * 直接监听 Leafer 视口变换事件。
     * 只要画布缩放、滚动或 `fitView()` 发生，都会把同一鼠标 client 坐标重新换算成新的世界坐标。
     */
    const handleTreeTransform = (): void => {
      schedulePointerWorldPointRefresh();
    };
    const resolveMarqueeHitNodeIds = (
      marqueeState: GraphViewportMarqueeState,
      currentWorldPoint: { x: number; y: number }
    ): string[] => {
      const selectionBounds = {
        x: Math.min(marqueeState.startWorldX, currentWorldPoint.x),
        y: Math.min(marqueeState.startWorldY, currentWorldPoint.y),
        width: Math.abs(currentWorldPoint.x - marqueeState.startWorldX),
        height: Math.abs(currentWorldPoint.y - marqueeState.startWorldY)
      };
      const hitNodeIds: string[] = [];

      for (const nodeId of boundNodeIds) {
        const view = graph.getNodeView(nodeId);
        if (!view) {
          continue;
        }

        const nodeBounds = view.worldBoxBounds;
        if (
          intersectsWorldBounds(selectionBounds, {
            x: nodeBounds.x,
            y: nodeBounds.y,
            width: nodeBounds.width,
            height: nodeBounds.height
          })
        ) {
          hitNodeIds.push(nodeId);
        }
      }

      return hitNodeIds;
    };
    /**
     * 判断当前世界坐标是否命中了任意节点。
     * 框选只能从空白画布开始，因此这里需要在宿主原生 pointerdown 阶段先做一次几何过滤。
     */
    const hitNodeAtWorldPoint = (point: {
      x: number;
      y: number;
    }): boolean => {
      for (const nodeId of boundNodeIds) {
        const view = graph.getNodeView(nodeId);
        if (!view) {
          continue;
        }

        const nodeBounds = view.worldBoxBounds;
        if (
          point.x >= nodeBounds.x &&
          point.x <= nodeBounds.x + nodeBounds.width &&
          point.y >= nodeBounds.y &&
          point.y <= nodeBounds.y + nodeBounds.height
        ) {
          return true;
        }
      }

      return false;
    };
    /** 读取“当前鼠标应对应的 page 坐标”，用于节点创建和键盘粘贴。 */
    const resolveLatestPointerPagePoint = (): { x: number; y: number } | null => {
      if (lastPointerClientPoint) {
        lastPointerPagePoint = resolvePagePointByClient(
          lastPointerClientPoint.clientX,
          lastPointerClientPoint.clientY
        );
      }

      return lastPointerPagePoint;
    };
    /**
     * 统一收敛节点按下时的选中逻辑。
     * 这里除了更新选中态，还会记录“命中的是哪一次 pointerdown”。
     *
     * 之所以不再使用单个布尔值，是因为 Leafer 的 `pointer.down`
     * 可能晚于宿主原生 `pointerdown` 的微任务收尾触发，
     * 从而把上一次点击残留成脏状态，导致空白画布需要点两下才能取消选中。
     */
    const handleNodePointerDown = (
      nodeId: string,
      event?: EditorNodePointerDownEvent
    ): void => {
      hitNodePointerDownSequence = pointerDownSequence;

      /**
       * 右键命中已选中节点时，保留当前整组选区，
       * 这样节点菜单才能继续对多选态执行批量动作。
       */
      if (isSecondaryPointerDownEvent(event)) {
        if (!selection.isSelected(nodeId)) {
          selection.select(nodeId);
        }
        return;
      }

      if (shouldToggleSelectionByPointerEvent(event)) {
        selection.toggle(nodeId);
        return;
      }

      /**
       * 左键按在当前多选集合中的任一节点上时，保留整组选区，
       * 这样拖拽开始前不会先把多选误收缩成单选。
       */
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        return;
      }

      selection.select(nodeId);
    };
    const removeNodeFromMenu = (nodeId: string): void => {
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commands.removeSelectedNodes();
        return;
      }

      commands.removeNode(nodeId);
    };
    const pasteCopiedNodeAtLatestPointer = (): void => {
      const pointerPagePoint = resolveLatestPointerPagePoint();
      canvasCommands.pasteClipboardAt(pointerPagePoint);
    };
    const pasteCopiedNodeByKeyboard = (): void => {
      if (!graphReady || !canvasCommands.canPaste) {
        return;
      }

      runAfterViewportSettle(() => {
        if (!graphReady || !canvasCommands.canPaste) {
          return;
        }

        pasteCopiedNodeAtLatestPointer();
      });
    };
    const createNodeFromMenu = (
      context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady) {
        return;
      }

      canvasCommands.createNodeAt(context);
    };
    const copyNodeFromMenu = (nodeId: string): void => {
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commands.copySelectedNodes();
        return;
      }

      commands.copyNode(nodeId);
    };
    const cutNodeFromMenu = (nodeId: string): void => {
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commands.cutSelectedNodes();
        return;
      }

      selection.select(nodeId);
      commands.cutSelectedNodes();
    };
    const pasteCopiedNodeFromMenu = (
      context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady || !canvasCommands.canPaste) {
        return;
      }

      canvasCommands.pasteClipboardAt(context.pagePoint);
    };
    const duplicateNodeFromMenu = (
      nodeId: string,
      context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady) {
        return;
      }

      const snapshot = graph.getNodeSnapshot(nodeId);
      if (!snapshot) {
        return;
      }

      const baseX = snapshot.x ?? context.pagePoint.x;
      const baseY = snapshot.y ?? context.pagePoint.y;
      if (selection.hasMultipleSelected() && selection.isSelected(nodeId)) {
        commands.duplicateSelectedNodes();
        return;
      }

      commands.duplicateNode(nodeId, baseX + 48, baseY + 48);
    };
    const resetNodeSizeFromMenu = (nodeId: string): void => {
      if (!graphReady) {
        return;
      }

      commands.resetNodeSize(nodeId);
    };
    /**
     * 使用主包已经接入的 `@leafer-in/view` 能力执行适配视图。
     * 当前 editor 先只透传最小命令，不在这一层重复计算包围盒。
     */
    const fitGraphView = (): void => {
      if (!graphReady) {
        return;
      }

      canvasCommands.fitView();
    };
    const resolveContextMenuItems = (
      context: LeaferGraphContextMenuContext
    ): LeaferGraphContextMenuItem[] => {
      if (context.bindingKind === "node") {
        const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
        const nodeTitle = String(context.bindingMeta?.nodeTitle ?? nodeId);
        const isSelected = selection.isSelected(nodeId);
        const isMultipleSelected = selection.hasMultipleSelected();
        const selectedCount = selection.selectedNodeIds.length;
        const isCopiedSource = commands.isClipboardSourceNode(nodeId);
        const resizeMenuState = commands.resolveResizeState(nodeId);
        const useBatchAction = isSelected && isMultipleSelected;

        return [
          {
            key: "copy-node",
            label: useBatchAction ? `复制所选 ${selectedCount} 个节点` : `复制 ${nodeTitle}`,
            shortcut: "Ctrl+C",
            description: useBatchAction
              ? "把当前多选节点整体写入剪贴板，并保留相对布局"
              : isCopiedSource
              ? "当前节点已经在剪贴板中，再次复制会刷新快照"
              : "保存当前节点快照，供画布菜单粘贴使用",
            onSelect() {
              copyNodeFromMenu(nodeId);
            }
          },
          {
            key: "cut-node",
            label: useBatchAction ? `剪切所选 ${selectedCount} 个节点` : `剪切 ${nodeTitle}`,
            shortcut: "Ctrl+X",
            description: useBatchAction
              ? "把当前多选节点写入剪贴板后，从画布中批量移除"
              : "把当前节点写入剪贴板后，从画布中移除",
            onSelect() {
              cutNodeFromMenu(nodeId);
            }
          },
          {
            key: "duplicate-node",
            label: useBatchAction ? "复制并粘贴选区" : "复制并粘贴",
            shortcut: "Ctrl+D",
            description: useBatchAction
              ? "按当前多选节点的相对布局创建一组偏移副本"
              : "基于当前节点快照创建一个偏移副本",
            onSelect() {
              duplicateNodeFromMenu(nodeId, context);
            }
          },
          {
            key: "reset-node-size",
            label: "重置节点尺寸",
            description: resizeMenuState.description,
            disabled: resizeMenuState.disabled,
            onSelect() {
              resetNodeSizeFromMenu(nodeId);
            }
          },
          { kind: "separator", key: "node-divider" },
          {
            key: "remove-node",
            label: useBatchAction ? `删除所选 ${selectedCount} 个节点` : "删除节点",
            shortcut: "Delete",
            description:
              (isSelected && isMultipleSelected) || isCopiedSource
                ? "删除时会同步更新当前多选态和复制态"
                : isSelected
                  ? "删除时会同步清理当前节点的选中态和复制态"
                  : "已接入主包 removeNode(...)",
            danger: true,
            onSelect() {
              removeNodeFromMenu(nodeId);
            }
          }
        ];
      }

      const items: LeaferGraphContextMenuItem[] = [
        {
          key: "create-node-here",
          label: "在这里创建节点",
          description: graphReady
            ? canvasCommands.resolveCreateNodeState().description
            : "图初始化完成后可用",
          disabled:
            !graphReady || canvasCommands.resolveCreateNodeState().disabled,
          onSelect() {
            createNodeFromMenu(context);
          }
        },
        {
          key: "fit-view",
          label: "适配视图",
          shortcut: "Shift+1",
          description: graphReady
            ? "已接入 @leafer-in/view 的 fitView()"
            : "图初始化完成后可用",
          disabled: !graphReady,
          onSelect() {
            fitGraphView();
          }
        }
      ];

      if (canvasCommands.canPaste) {
        const selectedNodeId = selection.primarySelectedNodeId;
        items.splice(1, 0, {
          key: "paste-copied-node",
          label: "粘贴已复制节点",
          shortcut: "Ctrl+V",
          description: graphReady
            ? `把最近复制的节点放到当前画布位置${
                selectedNodeId ? "，并切换选中态" : ""
              }`
            : "图初始化完成后可用",
          disabled: !graphReady,
          onSelect() {
            pasteCopiedNodeFromMenu(context);
          }
        });
      }

      return items;
    };

    menu = createLeaferGraphContextMenu({
      app: graph.app,
      container: graph.container,
      resolveItems: resolveContextMenuItems,
      onBeforeOpen(context) {
        if (context.bindingKind === "node") {
          const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
          if (!selection.isSelected(nodeId)) {
            selection.select(nodeId);
          }
          return;
        }

        if (context.bindingKind === "canvas") {
          selection.clear();
        }
      }
    });
    commands = createEditorNodeCommandController({
      graph,
      selection,
      bindNode(node) {
        boundNodeIds.add(node.id);
        bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      },
      unbindNode(nodeId) {
        boundNodeIds.delete(nodeId);
        menu.unbindTarget(createNodeMenuBindingKey(nodeId));
      }
    });
    canvasCommands = createEditorCanvasCommandController({
      graph,
      nodeCommands: commands,
      quickCreateNodeType,
      onAfterFitView: schedulePointerWorldPointRefresh
    });
    (graph.app.tree as typeof graph.app.tree & GraphViewportViewEventHost).on(
      "leafer.transform",
      handleTreeTransform
    );

    graph.ready.then(() => {
      if (disposed) {
        return;
      }

      graphReady = true;

      for (const node of graphData.nodes) {
        boundNodeIds.add(node.id);
        bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      }
    });

    /**
     * 监听宿主元素的原生 pointerdown，用来识别“点击了画布空白区域”。
     *
     * 不直接依赖 Leafer 事件 target 的原因是：
     * 1. editor 这里更关心是否命中了节点，而不是完整命中树
     * 2. 使用“按下序号 + 下一帧确认”比单个布尔标记更抗事件时序抖动
     * 3. 可以避免和现有节点拖拽、右键菜单实现互相耦合
     */
    const handleHostPointerDown = (event: PointerEvent): void => {
      syncPointerPointsByClient(event.clientX, event.clientY);
      const pointerWorldPoint = lastPointerWorldPoint;
      if (!pointerWorldPoint) {
        return;
      }

      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }

      /**
       * 按住空格时，左键应该优先交给 Leafer 视口平移逻辑，
       * 不再启动 editor 自己的框选会话。
       */
      if (spaceKeyPressed && event.button === 0) {
        return;
      }

      if (hitNodeAtWorldPoint(pointerWorldPoint)) {
        return;
      }

      pointerDownSequence += 1;
      const currentPointerDownSequence = pointerDownSequence;
      const appendSelection = shouldToggleSelectionByPointerEvent(event);
      pendingMarqueeSelection = {
        sequence: currentPointerDownSequence,
        pointerId: event.pointerId,
        append: appendSelection,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWorldX: pointerWorldPoint.x,
        startWorldY: pointerWorldPoint.y,
        baseSelectedNodeIds: [...selection.selectedNodeIds]
      };
      activeMarqueeSelection = null;
      hideSelectionBox();

      if (pendingCanvasSelectionFrame) {
        ownerWindow.cancelAnimationFrame(pendingCanvasSelectionFrame);
      }

      pendingCanvasSelectionFrame = ownerWindow.requestAnimationFrame(() => {
        pendingCanvasSelectionFrame = 0;

        if (disposed) {
          return;
        }

        if (
          hitNodePointerDownSequence !== currentPointerDownSequence &&
          !appendSelection &&
          !activeMarqueeSelection
        ) {
          selection.clear();
        }
      });
    };

    /**
     * 持续记录鼠标在画布中的世界坐标。
     * 键盘粘贴会优先使用这个点，并把它作为新节点左上角。
     */
    const handleHostPointerMove = (event: PointerEvent): void => {
      syncPointerPointsByClient(event.clientX, event.clientY);
    };

    /**
     * 缩放或滚动画布后，同一鼠标 client 坐标对应的世界坐标会立刻变化。
     * 这里在视口交互结束后的下一帧重算，避免键盘粘贴仍落在旧世界坐标上。
     */
    const handleHostWheel = (event: WheelEvent): void => {
      syncPointerPointsByClient(event.clientX, event.clientY);
      schedulePointerWorldPointRefresh();
    };

    /**
     * 在窗口级持续跟踪框选拖拽。
     * 这样即使鼠标临时离开画布，也不会把框选过程截断。
     *
     * 同时这里也兜底同步“拖拽态下的鼠标坐标”：
     * 当用户按住空格 / 中键平移画布时，Leafer 会自己消费拖拽交互，
     * host 层未必还能稳定收到连续 `pointermove`。窗口级监听可以把这段
     * client 坐标补齐，避免平移结束后键盘粘贴仍然沿用旧落点。
     */
    const handleWindowPointerMove = (event: PointerEvent): void => {
      if (event.buttons !== 0) {
        syncPointerPointsByClient(event.clientX, event.clientY);
      }

      if (pendingMarqueeSelection) {
        if (event.pointerId !== pendingMarqueeSelection.pointerId) {
          return;
        }

        if (hitNodePointerDownSequence === pendingMarqueeSelection.sequence) {
          pendingMarqueeSelection = null;
          hideSelectionBox();
          return;
        }

        const offsetX = event.clientX - pendingMarqueeSelection.startClientX;
        const offsetY = event.clientY - pendingMarqueeSelection.startClientY;
        const movedEnough = Math.hypot(offsetX, offsetY) >= 4;

        if (movedEnough) {
          activeMarqueeSelection = pendingMarqueeSelection;
          pendingMarqueeSelection = null;
        }
      }

      if (!activeMarqueeSelection || event.pointerId !== activeMarqueeSelection.pointerId) {
        return;
      }

      syncPointerPointsByClient(event.clientX, event.clientY);
      const pointerWorldPoint = lastPointerWorldPoint;
      if (!pointerWorldPoint) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      showSelectionBox(
        resolveSelectionBox(
          activeMarqueeSelection.startClientX,
          activeMarqueeSelection.startClientY,
          event.clientX,
          event.clientY,
          hostRect
        )
      );

      const hitNodeIds = resolveMarqueeHitNodeIds(
        activeMarqueeSelection,
        pointerWorldPoint
      );
      selection.setMany(
        activeMarqueeSelection.append
          ? [...activeMarqueeSelection.baseSelectedNodeIds, ...hitNodeIds]
          : hitNodeIds
      );
    };

    /** 结束一次框选会话，并清理 overlay。 */
    const handleWindowPointerUp = (event: PointerEvent): void => {
      if (
        pendingMarqueeSelection &&
        event.pointerId === pendingMarqueeSelection.pointerId
      ) {
        pendingMarqueeSelection = null;
      }

      if (
        activeMarqueeSelection &&
        event.pointerId === activeMarqueeSelection.pointerId
      ) {
        activeMarqueeSelection = null;
        hideSelectionBox();
      }
    };

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (isTextEditingElement(event.target)) {
        return;
      }

      if (event.code === "Space") {
        spaceKeyPressed = true;
      }

      if (event.altKey) {
        return;
      }

      if (
        event.code === "Digit1" &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        fitGraphView();
        return;
      }

      if (event.key === "Delete") {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !selection.primarySelectedNodeId
        ) {
          return;
        }

        event.preventDefault();
        commands.removeSelectedNodes();
        return;
      }

      if (!hasPrimaryCommandModifier(event) || event.repeat) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "c") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        commands.copySelectedNodes();
        return;
      }

      if (key === "a") {
        if (event.shiftKey) {
          return;
        }

        event.preventDefault();
        selection.setMany([...boundNodeIds]);
        return;
      }

      if (key === "x") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        commands.cutSelectedNodes();
        return;
      }

      if (key === "d") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        commands.duplicateSelectedNodes();
        return;
      }

      if (key === "v") {
        if (!canvasCommands.canPaste || event.shiftKey) {
          return;
        }

        event.preventDefault();
        pasteCopiedNodeByKeyboard();
      }
    };
    const handleWindowKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") {
        spaceKeyPressed = false;
      }
    };
    const handleWindowBlur = (): void => {
      spaceKeyPressed = false;
    };

    host.addEventListener("pointerdown", handleHostPointerDown, true);
    host.addEventListener("pointermove", handleHostPointerMove, true);
    host.addEventListener("wheel", handleHostWheel, true);
    ownerWindow.addEventListener("pointermove", handleWindowPointerMove);
    ownerWindow.addEventListener("pointerup", handleWindowPointerUp);
    ownerWindow.addEventListener("pointercancel", handleWindowPointerUp);
    ownerWindow.addEventListener("keydown", handleWindowKeyDown);
    ownerWindow.addEventListener("keyup", handleWindowKeyUp);
    ownerWindow.addEventListener("blur", handleWindowBlur);

    return () => {
      disposed = true;
      if (pendingCanvasSelectionFrame) {
        ownerWindow.cancelAnimationFrame(pendingCanvasSelectionFrame);
      }
      if (pendingPointerWorldSyncFrame) {
        ownerWindow.cancelAnimationFrame(pendingPointerWorldSyncFrame);
      }
      host.removeEventListener("pointerdown", handleHostPointerDown, true);
      host.removeEventListener("pointermove", handleHostPointerMove, true);
      host.removeEventListener("wheel", handleHostWheel, true);
      (
        graph.app.tree as typeof graph.app.tree & GraphViewportViewEventHost
      ).off("leafer.transform", handleTreeTransform);
      ownerWindow.removeEventListener("pointermove", handleWindowPointerMove);
      ownerWindow.removeEventListener("pointerup", handleWindowPointerUp);
      ownerWindow.removeEventListener("pointercancel", handleWindowPointerUp);
      ownerWindow.removeEventListener("keydown", handleWindowKeyDown);
      ownerWindow.removeEventListener("keyup", handleWindowKeyUp);
      ownerWindow.removeEventListener("blur", handleWindowBlur);
      hideSelectionBox();
      menu.destroy();
      graphRef.current = null;
      graph.destroy();
    };
  }, [graphData, modules, plugins, quickCreateNodeType]);

  return (
    <div class="graph-viewport">
      <div ref={hostRef} class="graph-root" />
      <div
        ref={selectionBoxRef}
        class="graph-selection-box"
        data-visible="false"
        aria-hidden="true"
      />
    </div>
  );
}
