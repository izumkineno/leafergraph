import type { Group } from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import {
  isWidgetInteractionTarget,
  type LeaferGraphWidgetEventSource,
  type LeaferGraphWidgetPointerEvent
} from "./widget_interaction";

/** 多选拖拽时记录的单个节点初始位置。 */
export interface GraphDragNodePosition {
  nodeId: string;
  startX: number;
  startY: number;
}

/** 拖拽中的节点状态。 */
interface GraphDragState {
  anchorNodeId: string;
  offsetX: number;
  offsetY: number;
  anchorStartX: number;
  anchorStartY: number;
  nodes: GraphDragNodePosition[];
}

/** 拖拽 resize 句柄时的节点缩放状态。 */
interface GraphResizeState {
  nodeId: string;
  startWidth: number;
  startHeight: number;
  startPageX: number;
  startPageY: number;
}

/** 交互宿主依赖的最小节点视图结构。 */
export interface LeaferGraphInteractiveNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  state: TNodeState;
  view: Group;
  resizeHandle: LeaferGraphWidgetEventSource;
  shellView: {
    signalButton: LeaferGraphWidgetEventSource;
  };
  hovered: boolean;
}

interface LeaferGraphInteractionHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  container: HTMLElement;
  bringNodeViewToFront(state: TNodeViewState): void;
  syncNodeResizeHandleVisibility(state: TNodeViewState): void;
  requestRender(): void;
  resolveDraggedNodeIds(nodeId: string): string[];
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void;
  resizeNode(nodeId: string, size: { width: number; height: number }): void;
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
  canResizeNode(nodeId: string): boolean;
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  };
  getPagePointFromGraphEvent(event: LeaferGraphWidgetPointerEvent): {
    x: number;
    y: number;
  };
  resolveNodeSize(state: TNodeViewState): {
    width: number;
    height: number;
  };
  getNodeView(nodeId: string): TNodeViewState | undefined;
}

/**
 * 节点交互宿主。
 * 当前集中收口：
 * 1. 节点拖拽
 * 2. 节点 resize
 * 3. 节点折叠按钮
 * 4. 窗口级 pointer 生命周期
 */
export class LeaferGraphInteractionHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  private readonly options: LeaferGraphInteractionHostOptions<
    TNodeState,
    TNodeViewState
  >;
  private readonly ownerWindow: Window;
  private dragState: GraphDragState | null = null;
  private resizeState: GraphResizeState | null = null;

  private readonly handleWindowPointerMove = (event: PointerEvent): void => {
    if (this.resizeState) {
      const point = this.options.getPagePointByClient(event);
      const width =
        this.resizeState.startWidth + (point.x - this.resizeState.startPageX);
      const height =
        this.resizeState.startHeight + (point.y - this.resizeState.startPageY);

      this.options.resizeNode(this.resizeState.nodeId, { width, height });
      this.options.container.style.cursor = "nwse-resize";
      return;
    }

    if (!this.dragState) {
      return;
    }

    const point = this.options.getPagePointByClient(event);
    const anchorX = point.x - this.dragState.offsetX;
    const anchorY = point.y - this.dragState.offsetY;
    const deltaX = anchorX - this.dragState.anchorStartX;
    const deltaY = anchorY - this.dragState.anchorStartY;

    this.options.moveNodesByDelta(this.dragState.nodes, deltaX, deltaY);
    this.options.container.style.cursor = "grabbing";
  };

  private readonly handleWindowPointerUp = (): void => {
    const resizeNodeId = this.resizeState?.nodeId;
    const dragNodeId = this.dragState?.anchorNodeId;

    if (this.resizeState) {
      this.resizeState = null;
      this.options.container.style.cursor = "";
    }

    if (this.dragState) {
      this.dragState = null;
      this.options.container.style.cursor = "";
    }

    if (resizeNodeId) {
      const state = this.options.getNodeView(resizeNodeId);
      if (state) {
        this.options.syncNodeResizeHandleVisibility(state);
      }
    }

    if (dragNodeId && dragNodeId !== resizeNodeId) {
      const state = this.options.getNodeView(dragNodeId);
      if (state) {
        this.options.syncNodeResizeHandleVisibility(state);
      }
    }
  };

  constructor(
    options: LeaferGraphInteractionHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
    this.ownerWindow = this.options.container.ownerDocument.defaultView ?? window;
    this.ownerWindow.addEventListener(
      "pointermove",
      this.handleWindowPointerMove
    );
    this.ownerWindow.addEventListener("pointerup", this.handleWindowPointerUp);
    this.ownerWindow.addEventListener(
      "pointercancel",
      this.handleWindowPointerUp
    );
  }

  /** 绑定节点拖拽交互。 */
  bindNodeDragging(nodeId: string, view: Group): void {
    view.on("pointer.enter", (event: LeaferGraphWidgetPointerEvent) => {
      const state = this.options.getNodeView(nodeId);
      if (state) {
        state.hovered = true;
        this.options.syncNodeResizeHandleVisibility(state);
      }

      if (
        !this.dragState &&
        !this.resizeState &&
        !this.isResizeHandleTarget(event.target)
      ) {
        this.options.container.style.cursor = "grab";
      }
    });

    view.on("pointer.leave", () => {
      const state = this.options.getNodeView(nodeId);
      if (state) {
        state.hovered = false;
        this.options.syncNodeResizeHandleVisibility(state);
      }

      if (!this.dragState && !this.resizeState) {
        this.options.container.style.cursor = "";
      }
    });

    view.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      const state = this.options.getNodeView(nodeId);
      if (!state) {
        return;
      }

      if (!event.right && !event.middle) {
        this.options.bringNodeViewToFront(state);
        this.options.requestRender();
      }

      if (
        event.right ||
        event.middle ||
        isWidgetInteractionTarget(event.target) ||
        this.isResizeHandleTarget(event.target) ||
        this.isResizeHandleHit(event, state)
      ) {
        return;
      }

      this.startNodeDrag(nodeId, state, event);
    });
  }

  /**
   * 绑定节点右下角 resize 句柄。
   * 当前先做最小自定义实现，不直接缩放整个 Group，
   * 而是把拖拽结果写回节点布局尺寸，再走局部刷新。
   */
  bindNodeResize(nodeId: string, state: TNodeViewState): void {
    if (!this.options.canResizeNode(nodeId)) {
      return;
    }

    state.resizeHandle.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      event.stopNow?.();
      event.stop?.();
      this.dragState = null;
      const point = this.options.getPagePointFromGraphEvent(event);
      const { width, height } = this.options.resolveNodeSize(state);
      this.resizeState = {
        nodeId,
        startWidth: width,
        startHeight: height,
        startPageX: point.x,
        startPageY: point.y
      };
      this.options.syncNodeResizeHandleVisibility(state);
      this.options.container.style.cursor = "nwse-resize";
    });
  }

  /**
   * 绑定左上角信号球的折叠开关。
   * 这里直接在 `pointer.down` 阶段消费事件，避免它被根节点拖拽逻辑抢走。
   */
  bindNodeCollapseToggle(nodeId: string, state: TNodeViewState): void {
    state.shellView.signalButton.on(
      "pointer.down",
      (event: LeaferGraphWidgetPointerEvent) => {
        event.stopNow?.();
        event.stop?.();
        this.dragState = null;
        this.resizeState = null;
        this.options.container.style.cursor = "";
        this.options.setNodeCollapsed(
          nodeId,
          !Boolean(state.state.flags.collapsed)
        );
      }
    );
  }

  /** 某个节点被外部删除时，及时回收可能悬挂的交互状态。 */
  handleNodeRemoved(nodeId: string): void {
    let cleared = false;

    if (this.dragState?.nodes.some((item) => item.nodeId === nodeId)) {
      this.dragState = null;
      cleared = true;
    }

    if (this.resizeState?.nodeId === nodeId) {
      this.resizeState = null;
      cleared = true;
    }

    if (cleared) {
      this.options.container.style.cursor = "";
    }
  }

  /** 清理当前交互态，供整图重建和销毁前复用。 */
  clearInteractionState(): void {
    this.dragState = null;
    this.resizeState = null;
    this.options.container.style.cursor = "";
  }

  /** 判断某个节点当前是否处于 resize 拖拽态。 */
  isResizingNode(nodeId: string): boolean {
    return this.resizeState?.nodeId === nodeId;
  }

  /** 卸载窗口级事件监听并清理交互态。 */
  destroy(): void {
    this.clearInteractionState();
    this.ownerWindow.removeEventListener(
      "pointermove",
      this.handleWindowPointerMove
    );
    this.ownerWindow.removeEventListener("pointerup", this.handleWindowPointerUp);
    this.ownerWindow.removeEventListener(
      "pointercancel",
      this.handleWindowPointerUp
    );
  }

  /** 启动一次节点拖拽。 */
  private startNodeDrag(
    nodeId: string,
    state: TNodeViewState,
    event: LeaferGraphWidgetPointerEvent
  ): void {
    const point = this.options.getPagePointFromGraphEvent(event);
    const anchorStartX = state.state.layout.x;
    const anchorStartY = state.state.layout.y;
    const draggedNodeIds = this.options.resolveDraggedNodeIds(nodeId);

    this.resizeState = null;
    this.dragState = {
      anchorNodeId: nodeId,
      offsetX: point.x - anchorStartX,
      offsetY: point.y - anchorStartY,
      anchorStartX,
      anchorStartY,
      nodes: draggedNodeIds.map((draggedNodeId) => {
        const node = this.options.getNodeView(draggedNodeId)?.state;

        return {
          nodeId: draggedNodeId,
          startX: node?.layout.x ?? 0,
          startY: node?.layout.y ?? 0
        };
      })
    };
    this.options.syncNodeResizeHandleVisibility(state);
    this.options.container.style.cursor = "grabbing";
  }

  /**
   * 判断当前事件命中是否来自节点 resize 句柄。
   * 这样可以避免根节点拖拽监听误把 resize 手势识别成移动节点。
   */
  private isResizeHandleTarget(
    target: LeaferGraphWidgetPointerEvent["target"]
  ): boolean {
    let current = target;

    while (current) {
      if ((current.name ?? "").startsWith("node-resize-handle-")) {
        return true;
      }
      current = current.parent ?? null;
    }

    return false;
  }

  /**
   * 通过节点局部坐标兜底判断一次按下是否命中了 resize 热区。
   * 有些 Leafer 事件在冒泡到根 Group 时，`target` 可能已经不是句柄本身，
   * 因此这里再补一层几何判断，避免 resize 和拖拽同时起效。
   */
  private isResizeHandleHit(
    event: LeaferGraphWidgetPointerEvent,
    state: TNodeViewState
  ): boolean {
    const { width, height } = this.options.resolveNodeSize(state);
    const point = this.options.getPagePointFromGraphEvent(event);
    const localX = point.x - state.state.layout.x;
    const localY = point.y - state.state.layout.y;

    return localX >= width - 20 && localY >= height - 20;
  }
}
