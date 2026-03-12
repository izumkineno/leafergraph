import { useEffect, useRef } from "preact/hooks";

import {
  createLeaferGraph,
  createLeaferGraphContextMenu,
  type LeaferGraph,
  type LeaferGraphCreateNodeInput,
  type LeaferGraphContextMenuContext,
  type LeaferGraphContextMenuItem,
  type LeaferGraphContextMenuManager,
  type LeaferGraphNodeData
} from "leafergraph";
import { createEditorNodeSelection } from "./selection";

interface GraphViewportProps {
  nodes: LeaferGraphNodeData[];
}

/**
 * editor 当前关心的节点按下事件最小子集。
 * 这里只读取修饰键，不直接依赖 Leafer 完整事件类型，避免把 editor 绑死到具体实现细节。
 */
interface EditorNodePointerDownEvent {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/**
 * 节点菜单挂载元信息。
 * editor 当前还没有完整选区和命令系统，因此先把节点级菜单真正需要的最小信息集中到这里。
 */
interface DemoNodeMenuBindingMeta extends Record<string, unknown> {
  nodeId: string;
  nodeTitle: string;
  nodeType?: string;
}

/**
 * editor 当前阶段的最小节点剪贴板。
 * 这里额外记录来源节点 ID，便于在删除节点时同步清理复制态。
 */
interface DemoNodeClipboard {
  sourceNodeId: string;
  snapshot: LeaferGraphCreateNodeInput;
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
}): DemoNodeMenuBindingMeta {
  return {
    nodeId: node.id,
    nodeTitle: node.title,
    nodeType: node.type
  };
}

/**
 * 生成一个用于右键快速创建的 demo 节点输入。
 * 当前先保持风格稳定，后续接入节点搜索器时再把这块替换成真实节点创建流程。
 */
function createQuickCreateNodeInput(
  context: LeaferGraphContextMenuContext,
  index: number
): LeaferGraphCreateNodeInput {
  return {
    title: `节点 ${index}`,
    subtitle: "Context menu quick create",
    x: Math.round(context.worldPoint.x),
    y: Math.round(context.worldPoint.y),
    accent: index % 2 === 0 ? "#6366F1" : "#3B82F6",
    category: "Demo / Quick",
    status: "READY",
    inputs: ["Input"],
    outputs: ["Output"],
    controlLabel: "Value",
    controlValue: "0.50",
    controlProgress: 0.5
  };
}

/** 深拷贝一个节点创建输入，避免剪贴板对象被后续操作原地污染。 */
function cloneNodeCreateInput(
  input: LeaferGraphCreateNodeInput
): LeaferGraphCreateNodeInput {
  return structuredClone(input);
}

/** 将节点输入重新定位到指定坐标，供粘贴和 duplicate 共用。 */
function relocateNodeCreateInput(
  input: LeaferGraphCreateNodeInput,
  x: number,
  y: number
): LeaferGraphCreateNodeInput {
  const next = cloneNodeCreateInput(input);
  next.x = Math.round(x);
  next.y = Math.round(y);
  return next;
}

/** 判断当前剪贴板是否来自某个节点。 */
function isClipboardSourceNode(
  clipboard: DemoNodeClipboard | null,
  nodeId: string
): boolean {
  return clipboard?.sourceNodeId === nodeId;
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

export function GraphViewport({ nodes }: GraphViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const graph = createLeaferGraph(host, { nodes });
    const selection = createEditorNodeSelection(graph);
    const ownerWindow = host.ownerDocument.defaultView ?? window;
    let graphReady = false;
    let quickCreateIndex = Math.max(nodes.length + 1, 1);
    let copiedNode: DemoNodeClipboard | null = null;
    let pointerDownSequence = 0;
    let hitNodePointerDownSequence = -1;
    let pendingCanvasSelectionFrame = 0;
    let menu!: LeaferGraphContextMenuManager;
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

      if (shouldToggleSelectionByPointerEvent(event)) {
        selection.toggle(nodeId);
        return;
      }

      selection.select(nodeId);
    };
    const clearClipboardIfNodeMatches = (nodeId: string): void => {
      if (isClipboardSourceNode(copiedNode, nodeId)) {
        copiedNode = null;
      }
    };
    const removeNodeFromMenu = (nodeId: string): void => {
      clearClipboardIfNodeMatches(nodeId);
      selection.clearIfContains(nodeId);
      menu.unbindTarget(createNodeMenuBindingKey(nodeId));
      graph.removeNode(nodeId);
    };
    const removeSelectedNodeByKeyboard = (): void => {
      const selectedNodeId = selection.primarySelectedNodeId;
      if (!graphReady || !selectedNodeId) {
        return;
      }

      removeNodeFromMenu(selectedNodeId);
    };
    const copySelectedNodeByKeyboard = (): void => {
      const selectedNodeId = selection.primarySelectedNodeId;
      if (!graphReady || !selectedNodeId) {
        return;
      }

      copyNodeFromMenu(selectedNodeId);
    };
    const resolveKeyboardPastePosition = (): { x: number; y: number } | undefined => {
      if (!graphReady || !copiedNode) {
        return undefined;
      }

      const selectedNodeId = selection.primarySelectedNodeId;
      if (selectedNodeId) {
        const selectedSnapshot = graph.getNodeSnapshot(selectedNodeId);
        if (selectedSnapshot) {
          return {
            x: (selectedSnapshot.x ?? 0) + 48,
            y: (selectedSnapshot.y ?? 0) + 48
          };
        }
      }

      return {
        x: (copiedNode.snapshot.x ?? 0) + 48,
        y: (copiedNode.snapshot.y ?? 0) + 48
      };
    };
    const pasteCopiedNodeByKeyboard = (): void => {
      if (!graphReady || !copiedNode) {
        return;
      }

      const position = resolveKeyboardPastePosition();
      if (!position) {
        return;
      }

      const node = graph.createNode(
        relocateNodeCreateInput(copiedNode.snapshot, position.x, position.y)
      );
      bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      selection.select(node.id);
    };
    const duplicateSelectedNodeByKeyboard = (): void => {
      const selectedNodeId = selection.primarySelectedNodeId;
      if (!graphReady || !selectedNodeId) {
        return;
      }

      const snapshot = graph.getNodeSnapshot(selectedNodeId);
      if (!snapshot) {
        return;
      }

      const node = graph.createNode(
        relocateNodeCreateInput(
          snapshot,
          (snapshot.x ?? 0) + 48,
          (snapshot.y ?? 0) + 48
        )
      );
      bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      selection.select(node.id);
    };
    const createNodeFromMenu = (
      context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady) {
        return;
      }

      const node = graph.createNode(
        createQuickCreateNodeInput(context, quickCreateIndex)
      );
      quickCreateIndex += 1;
      bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      selection.select(node.id);
    };
    const copyNodeFromMenu = (nodeId: string): void => {
      const snapshot = graph.getNodeSnapshot(nodeId);
      if (!snapshot) {
        return;
      }

      copiedNode = {
        sourceNodeId: nodeId,
        snapshot
      };
      selection.select(nodeId);
    };
    const pasteCopiedNodeFromMenu = (
      context: LeaferGraphContextMenuContext
    ): void => {
      if (!graphReady || !copiedNode) {
        return;
      }

      const node = graph.createNode(
        relocateNodeCreateInput(
          copiedNode.snapshot,
          context.worldPoint.x,
          context.worldPoint.y
        )
      );
      bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      selection.select(node.id);
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

      const baseX = snapshot.x ?? context.worldPoint.x;
      const baseY = snapshot.y ?? context.worldPoint.y;
      const node = graph.createNode(
        relocateNodeCreateInput(snapshot, baseX + 48, baseY + 48)
      );
      bindNodeContextMenu(graph, menu, handleNodePointerDown, node);
      selection.select(node.id);
    };
    /**
     * 使用主包已经接入的 `@leafer-in/view` 能力执行适配视图。
     * 当前 editor 先只透传最小命令，不在这一层重复计算包围盒。
     */
    const fitGraphView = (): void => {
      if (!graphReady) {
        return;
      }

      graph.fitView();
    };
    const resolveDemoMenuItems = (
      context: LeaferGraphContextMenuContext
    ): LeaferGraphContextMenuItem[] => {
      if (context.bindingKind === "node") {
        const nodeId = String(context.bindingMeta?.nodeId ?? context.bindingKey);
        const nodeTitle = String(context.bindingMeta?.nodeTitle ?? nodeId);
        const isSelected = selection.isSelected(nodeId);
        const isMultipleSelected = selection.hasMultipleSelected();
        const isCopiedSource = isClipboardSourceNode(copiedNode, nodeId);

        return [
          {
            key: "copy-node",
            label: `复制 ${nodeTitle}`,
            shortcut: "Ctrl+C",
            description: isCopiedSource
              ? "当前节点已经在剪贴板中，再次复制会刷新快照"
              : "保存当前节点快照，供画布菜单粘贴使用",
            onSelect() {
              copyNodeFromMenu(nodeId);
            }
          },
          {
            key: "duplicate-node",
            label: "复制并粘贴",
            shortcut: "Ctrl+D",
            description: "基于当前节点快照创建一个偏移副本",
            onSelect() {
              duplicateNodeFromMenu(nodeId, context);
            }
          },
          { kind: "separator", key: "node-divider" },
          {
            key: "remove-node",
            label: "删除节点",
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
            ? "已接入主包 createNode(...)"
            : "图初始化完成后可用",
          disabled: !graphReady,
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

      if (copiedNode) {
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
      resolveItems: resolveDemoMenuItems,
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
    let disposed = false;

    graph.ready.then(() => {
      if (disposed) {
        return;
      }

      graphReady = true;

      for (const node of nodes) {
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
      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }

      pointerDownSequence += 1;
      const currentPointerDownSequence = pointerDownSequence;

      if (pendingCanvasSelectionFrame) {
        ownerWindow.cancelAnimationFrame(pendingCanvasSelectionFrame);
      }

      pendingCanvasSelectionFrame = ownerWindow.requestAnimationFrame(() => {
        pendingCanvasSelectionFrame = 0;

        if (disposed) {
          return;
        }

        if (hitNodePointerDownSequence !== currentPointerDownSequence) {
          selection.clear();
        }
      });
    };

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (isTextEditingElement(event.target)) {
        return;
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
        removeSelectedNodeByKeyboard();
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
        copySelectedNodeByKeyboard();
        return;
      }

      if (key === "d") {
        if (!selection.primarySelectedNodeId || event.shiftKey) {
          return;
        }

        event.preventDefault();
        duplicateSelectedNodeByKeyboard();
        return;
      }

      if (key === "v") {
        if (!copiedNode || event.shiftKey) {
          return;
        }

        event.preventDefault();
        pasteCopiedNodeByKeyboard();
      }
    };

    host.addEventListener("pointerdown", handleHostPointerDown, true);
    ownerWindow.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      disposed = true;
      if (pendingCanvasSelectionFrame) {
        ownerWindow.cancelAnimationFrame(pendingCanvasSelectionFrame);
      }
      host.removeEventListener("pointerdown", handleHostPointerDown, true);
      ownerWindow.removeEventListener("keydown", handleWindowKeyDown);
      menu.destroy();
      graph.destroy();
    };
  }, [nodes]);

  return <div ref={hostRef} class="graph-root" />;
}
