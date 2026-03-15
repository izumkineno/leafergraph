/**
 * 图交互宿主模块。
 *
 * @remarks
 * 负责节点拖拽、节点缩放、折叠按钮和窗口级指针生命周期管理。
 */

import type { Group } from "leafer-ui";
import type { NodeRuntimeState, SlotDirection, SlotType } from "@leafergraph/node";
import type { LeaferGraphConnectionPortState } from "../api/graph_api_types";
import type {
  GraphDragNodePosition,
  LeaferGraphInteractionRuntimeLike
} from "./graph_interaction_runtime_host";
import {
  isWidgetInteractionTarget,
  type LeaferGraphWidgetEventSource,
  type LeaferGraphWidgetPointerEvent
} from "../widgets/widget_interaction";

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

/** 拖拽中的最小连接状态。 */
interface GraphConnectionState {
  sourceNodeId: string;
  sourceSlot: number;
  hoveredTarget: LeaferGraphConnectionPortState | null;
}

interface LeaferGraphInteractivePortViewState {
  layout: {
    direction: SlotDirection;
    index: number;
    portX: number;
    portY: number;
    portWidth: number;
    portHeight: number;
    slotType?: SlotType;
  };
  highlight: {
    visible?: boolean | 0;
    opacity?: number;
  };
  hitArea: LeaferGraphWidgetEventSource & {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
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
    portViews: LeaferGraphInteractivePortViewState[];
  };
  hovered: boolean;
}

interface LeaferGraphInteractionHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  container: HTMLElement;
  runtime: LeaferGraphInteractionRuntimeLike<TNodeState, TNodeViewState>;
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
  private connectionState: GraphConnectionState | null = null;

  private readonly handleWindowPointerMove = (event: PointerEvent): void => {
    if (this.connectionState) {
      const point = this.options.runtime.getPagePointByClient(event);
      this.updateConnectionPreview(point);
      return;
    }

    if (this.resizeState) {
      const point = this.options.runtime.getPagePointByClient(event);
      const width =
        this.resizeState.startWidth + (point.x - this.resizeState.startPageX);
      const height =
        this.resizeState.startHeight + (point.y - this.resizeState.startPageY);

      this.options.runtime.resizeNode(this.resizeState.nodeId, {
        width,
        height
      });
      this.options.container.style.cursor = "nwse-resize";
      return;
    }

    if (!this.dragState) {
      return;
    }

    const point = this.options.runtime.getPagePointByClient(event);
    const anchorX = point.x - this.dragState.offsetX;
    const anchorY = point.y - this.dragState.offsetY;
    const deltaX = anchorX - this.dragState.anchorStartX;
    const deltaY = anchorY - this.dragState.anchorStartY;

    this.options.runtime.moveNodesByDelta(this.dragState.nodes, deltaX, deltaY);
    this.options.container.style.cursor = "grabbing";
  };

  private readonly handleWindowPointerUp = (event?: PointerEvent): void => {
    if (this.connectionState) {
      const point = event
        ? this.options.runtime.getPagePointByClient(event)
        : undefined;
      this.finishConnection(point);
      return;
    }

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
      this.options.runtime.syncNodeResizeHandleVisibility(resizeNodeId);
    }

    if (dragNodeId && dragNodeId !== resizeNodeId) {
      this.options.runtime.syncNodeResizeHandleVisibility(dragNodeId);
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
      this.options.runtime.setNodeHovered(nodeId, true);

      if (
        !this.dragState &&
        !this.connectionState &&
        !this.resizeState &&
        !this.isResizeHandleTarget(event.target)
      ) {
        this.options.container.style.cursor = "grab";
      }
    });

    view.on("pointer.leave", () => {
      this.options.runtime.setNodeHovered(nodeId, false);

      if (!this.dragState && !this.resizeState && !this.connectionState) {
        this.options.container.style.cursor = "";
      }
    });

    view.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      const state = this.options.runtime.getNodeView(nodeId);
      if (!state) {
        return;
      }

      if (!event.right && !event.middle) {
        this.options.runtime.focusNode(nodeId);
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
    if (!this.options.runtime.canResizeNode(nodeId)) {
      return;
    }

    state.resizeHandle.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      event.stopNow?.();
      event.stop?.();
      this.dragState = null;
      const point = this.options.runtime.getPagePointFromGraphEvent(event);
      const size = this.options.runtime.resolveNodeSize(nodeId);
      if (!size) {
        return;
      }
      this.resizeState = {
        nodeId,
        startWidth: size.width,
        startHeight: size.height,
        startPageX: point.x,
        startPageY: point.y
      };
      this.options.runtime.syncNodeResizeHandleVisibility(nodeId);
      this.options.container.style.cursor = "nwse-resize";
    });
  }

  /**
   * 绑定节点端口的最小拖线交互。
   * 当前只从输出端口发起拖线，并在窗口级 move / up 链路里完成候选解析与正式建线。
   */
  bindNodePorts(nodeId: string, state: TNodeViewState): void {
    for (const portView of state.shellView.portViews) {
      if (portView.layout.direction !== "output") {
        continue;
      }

      portView.hitArea.on(
        "pointer.down",
        (event: LeaferGraphWidgetPointerEvent) => {
          if (event.right || event.middle) {
            return;
          }

          event.stopNow?.();
          event.stop?.();
          this.options.runtime.focusNode(nodeId);
          this.startConnectionDrag(nodeId, portView.layout.index, event);
        }
      );
    }
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
        this.options.runtime.setNodeCollapsed(
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

    if (
      this.connectionState?.sourceNodeId === nodeId ||
      this.connectionState?.hoveredTarget?.nodeId === nodeId
    ) {
      this.clearConnectionState();
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
    this.clearConnectionState();
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
    const point = this.options.runtime.getPagePointFromGraphEvent(event);
    const anchorStartX = state.state.layout.x;
    const anchorStartY = state.state.layout.y;
    const draggedNodeIds = this.options.runtime.resolveDraggedNodeIds(nodeId);

    this.resizeState = null;
    this.dragState = {
      anchorNodeId: nodeId,
      offsetX: point.x - anchorStartX,
      offsetY: point.y - anchorStartY,
      anchorStartX,
      anchorStartY,
      nodes: draggedNodeIds.map((draggedNodeId) => {
        const node = this.options.runtime.getNodeView(draggedNodeId)?.state;

        return {
          nodeId: draggedNodeId,
          startX: node?.layout.x ?? 0,
          startY: node?.layout.y ?? 0
        };
      })
    };
    this.options.runtime.syncNodeResizeHandleVisibility(nodeId);
    this.options.container.style.cursor = "grabbing";
  }

  /** 启动一次输出端口拖线。 */
  private startConnectionDrag(
    nodeId: string,
    slot: number,
    event: LeaferGraphWidgetPointerEvent
  ): void {
    const sourcePort = this.options.runtime.resolvePort(nodeId, "output", slot);
    if (!sourcePort) {
      return;
    }

    this.dragState = null;
    this.resizeState = null;
    this.connectionState = {
      sourceNodeId: nodeId,
      sourceSlot: sourcePort.slot,
      hoveredTarget: null
    };

    this.options.runtime.setConnectionSourcePort(sourcePort);
    this.options.runtime.setConnectionCandidatePort(null);
    this.options.runtime.setConnectionPreview(
      sourcePort,
      this.options.runtime.getPagePointFromGraphEvent(event)
    );
    this.options.container.style.cursor = "crosshair";
  }

  /** 根据当前鼠标位置刷新拖线预览和候选目标。 */
  private updateConnectionPreview(point: { x: number; y: number }): void {
    if (!this.connectionState) {
      return;
    }

    const sourcePort = this.options.runtime.resolvePort(
      this.connectionState.sourceNodeId,
      "output",
      this.connectionState.sourceSlot
    );
    if (!sourcePort) {
      this.clearConnectionState();
      this.options.container.style.cursor = "";
      return;
    }

    const rawTarget = this.options.runtime.resolvePortAtPoint(point, "input");
    const validation = rawTarget
      ? this.options.runtime.canCreateLink(sourcePort, rawTarget)
      : { valid: false as const };
    const hoveredTarget = rawTarget && validation.valid ? rawTarget : null;

    this.connectionState.hoveredTarget = hoveredTarget;
    this.options.runtime.setConnectionCandidatePort(hoveredTarget);
    this.options.runtime.setConnectionPreview(sourcePort, point, hoveredTarget ?? undefined);
    this.options.container.style.cursor =
      rawTarget && !validation.valid ? "not-allowed" : "crosshair";
  }

  /** 在窗口级 pointer up 时完成或取消一次拖线。 */
  private finishConnection(point?: { x: number; y: number }): void {
    const connection = this.connectionState;
    if (!connection) {
      return;
    }

    const sourcePort = this.options.runtime.resolvePort(
      connection.sourceNodeId,
      "output",
      connection.sourceSlot
    );
    let targetPort = connection.hoveredTarget;

    if (point && sourcePort) {
      const rawTarget = this.options.runtime.resolvePortAtPoint(point, "input");
      if (
        rawTarget &&
        this.options.runtime.canCreateLink(sourcePort, rawTarget).valid
      ) {
        targetPort = rawTarget;
      }
    }

    if (sourcePort && targetPort) {
      this.options.runtime.createLink(sourcePort, targetPort);
    }

    this.clearConnectionState();
    this.options.container.style.cursor = "";
  }

  /** 清理当前拖线相关的视觉反馈和临时状态。 */
  private clearConnectionState(): void {
    this.connectionState = null;
    this.options.runtime.setConnectionSourcePort(null);
    this.options.runtime.setConnectionCandidatePort(null);
    this.options.runtime.clearConnectionPreview();
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
    const size = this.options.runtime.resolveNodeSize(state.state.id);
    if (!size) {
      return false;
    }
    const { width, height } = size;
    const point = this.options.runtime.getPagePointFromGraphEvent(event);
    const localX = point.x - state.state.layout.x;
    const localY = point.y - state.state.layout.y;

    return localX >= width - 20 && localY >= height - 20;
  }
}
