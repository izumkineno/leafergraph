/**
 * 图交互宿主模块。
 *
 * @remarks
 * 负责节点拖拽、节点缩放、折叠按钮和窗口级指针生命周期管理。
 */

import type { Group } from "leafer-ui";
import type { NodeRuntimeState, SlotDirection, SlotType } from "@leafergraph/node";
import type {
  LeaferGraphInteractionActivityState,
  LeaferGraphConnectionPortState,
  LeaferGraphInteractionCommitEvent
} from "@leafergraph/contracts";
import type {
  GraphDragNodePosition,
  LeaferGraphInteractionRuntimeLike
} from "./graph_interaction_runtime_host";
import { LeaferGraphSelectionBoxHost } from "./selection_box_host";
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
  originNodeId: string;
  originDirection: SlotDirection;
  originSlot: number;
  hoveredTarget: LeaferGraphConnectionPortState | null;
}

/** 左键空白区框选时维护的最小手势状态。 */
interface GraphSelectionState {
  startPageX: number;
  startPageY: number;
  currentPageX: number;
  currentPageY: number;
  additive: boolean;
  started: boolean;
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
  selectionLayer: Group;
  resolveSelectionStroke(): string;
  requestRender(): void;
  emitInteractionCommit?(event: LeaferGraphInteractionCommitEvent): void;
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
  private selectionState: GraphSelectionState | null = null;
  private interactionActivityState: LeaferGraphInteractionActivityState = {
    active: false,
    mode: "idle"
  };
  private readonly selectionBoxHost: LeaferGraphSelectionBoxHost;
  private readonly interactionActivityListeners = new Set<
    (state: LeaferGraphInteractionActivityState) => void
  >();
  private spaceKeyPressed = false;

  private readonly handleWindowPointerMove = (event: PointerEvent): void => {
    if (this.selectionState) {
      this.updateSelectionDrag(event);
      return;
    }

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
    if (this.selectionState) {
      this.finishSelectionDrag();
      return;
    }

    if (this.connectionState) {
      const point = event
        ? this.options.runtime.getPagePointByClient(event)
        : undefined;
      this.finishConnection(point);
      return;
    }

    const resizeState = this.resizeState;
    const dragState = this.dragState;
    const resizeNodeId = resizeState?.nodeId;
    const dragNodeId = dragState?.anchorNodeId;

    if (resizeState) {
      const nextSize = this.options.runtime.resolveNodeSize(resizeState.nodeId);
      if (
        nextSize &&
        (Math.round(nextSize.width) !== Math.round(resizeState.startWidth) ||
          Math.round(nextSize.height) !== Math.round(resizeState.startHeight))
      ) {
        this.options.emitInteractionCommit?.({
          type: "node.resize.commit",
          nodeId: resizeState.nodeId,
          before: {
            width: resizeState.startWidth,
            height: resizeState.startHeight
          },
          after: {
            width: Math.round(nextSize.width),
            height: Math.round(nextSize.height)
          }
        });
      }
    }

    if (dragState) {
      const entries = dragState.nodes
        .map((item) => {
          const currentNode = this.options.runtime.getNodeView(item.nodeId)?.state;
          if (!currentNode) {
            return null;
          }

          const nextX = Math.round(currentNode.layout.x);
          const nextY = Math.round(currentNode.layout.y);
          if (nextX === Math.round(item.startX) && nextY === Math.round(item.startY)) {
            return null;
          }

          return {
            nodeId: item.nodeId,
            before: {
              x: Math.round(item.startX),
              y: Math.round(item.startY)
            },
            after: {
              x: nextX,
              y: nextY
            }
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      if (entries.length) {
        this.options.emitInteractionCommit?.({
          type: "node.move.commit",
          entries
        });
      }
    }

    if (this.resizeState) {
      this.resizeState = null;
      this.options.container.style.cursor = "";
    }

    if (this.dragState) {
      this.dragState = null;
      this.options.container.style.cursor = "";
    }

    this.syncInteractionActivityState();

    if (resizeNodeId) {
      this.options.runtime.syncNodeResizeHandleVisibility(resizeNodeId);
    }

    if (dragNodeId && dragNodeId !== resizeNodeId) {
      this.options.runtime.syncNodeResizeHandleVisibility(dragNodeId);
    }
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceKeyPressed = true;
    }
  };

  private readonly handleWindowKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceKeyPressed = false;
    }
  };

  private readonly handleContainerPointerDown = (event: PointerEvent): void => {
    if (
      event.button !== 0 ||
      event.defaultPrevented ||
      this.spaceKeyPressed ||
      event.ctrlKey
    ) {
      return;
    }

    const point = this.options.runtime.getPagePointByClient(event);
    if (this.options.runtime.resolveNodeAtPoint(point)) {
      return;
    }

    this.dragState = null;
    this.resizeState = null;
    this.clearConnectionState();
    this.selectionState = {
      startPageX: point.x,
      startPageY: point.y,
      currentPageX: point.x,
      currentPageY: point.y,
      additive: event.shiftKey,
      started: false
    };
    this.syncInteractionActivityState();
  };

  constructor(
    options: LeaferGraphInteractionHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
    this.selectionBoxHost = new LeaferGraphSelectionBoxHost({
      selectionLayer: this.options.selectionLayer,
      requestRender: () => this.options.requestRender(),
      resolveStroke: () => this.options.resolveSelectionStroke()
    });
    this.ownerWindow = this.options.container.ownerDocument.defaultView ?? window;
    this.options.container.addEventListener(
      "pointerdown",
      this.handleContainerPointerDown
    );
    this.ownerWindow.addEventListener(
      "pointermove",
      this.handleWindowPointerMove
    );
    this.ownerWindow.addEventListener("pointerup", this.handleWindowPointerUp);
    this.ownerWindow.addEventListener(
      "pointercancel",
      this.handleWindowPointerUp
    );
    this.ownerWindow.addEventListener("keydown", this.handleWindowKeyDown);
    this.ownerWindow.addEventListener("keyup", this.handleWindowKeyUp);
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

      const interactiveSubTarget =
        isWidgetInteractionTarget(event.target) ||
        this.isPortHitTarget(event.target) ||
        this.isResizeHandleTarget(event.target) ||
        this.isResizeHandleHit(event, state);
      const shiftPressed = this.isSelectionModifierPressed(event);

      if (!event.right && !event.middle) {
        if (!interactiveSubTarget && shiftPressed) {
          const mode = this.options.runtime.isNodeSelected(nodeId)
            ? "remove"
            : "add";
          this.options.runtime.setSelectedNodeIds([nodeId], mode);
          return;
        }

        if (!this.options.runtime.isNodeSelected(nodeId)) {
          this.options.runtime.setSelectedNodeIds([nodeId], "replace");
        }

        this.options.runtime.focusNode(nodeId);
      }

      if (
        event.right ||
        event.middle ||
        interactiveSubTarget
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
      if (!event.right && !event.middle) {
        if (!this.options.runtime.isNodeSelected(nodeId)) {
          this.options.runtime.setSelectedNodeIds([nodeId], "replace");
        }
        this.options.runtime.focusNode(nodeId);
      }
      this.dragState = null;
      const point = this.options.runtime.getPagePointFromGraphEvent(event);
      const size = this.options.runtime.resolveNodeSize(nodeId);
      if (!size) {
        this.syncInteractionActivityState();
        return;
      }
      this.resizeState = {
        nodeId,
        startWidth: size.width,
        startHeight: size.height,
        startPageX: point.x,
        startPageY: point.y
      };
      this.syncInteractionActivityState();
      this.options.runtime.syncNodeResizeHandleVisibility(nodeId);
      this.options.container.style.cursor = "nwse-resize";
    });
  }

  /**
   * 绑定节点端口的最小拖线交互。
   * 当前允许从输入或输出端口发起拖线，并在窗口级 move / up 链路里完成候选解析与正式建线。
   */
  bindNodePorts(nodeId: string, state: TNodeViewState): void {
    for (const portView of state.shellView.portViews) {
      portView.hitArea.on(
        "pointer.down",
        (event: LeaferGraphWidgetPointerEvent) => {
          if (event.right || event.middle) {
            return;
          }

          if (!this.options.runtime.isNodeSelected(nodeId)) {
            this.options.runtime.setSelectedNodeIds([nodeId], "replace");
          }
          event.stopNow?.();
          event.stop?.();
          this.options.runtime.focusNode(nodeId);
          this.startConnectionDrag(
            nodeId,
            portView.layout.direction,
            portView.layout.index,
            event
          );
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
        if (!event.right && !event.middle) {
          if (!this.options.runtime.isNodeSelected(nodeId)) {
            this.options.runtime.setSelectedNodeIds([nodeId], "replace");
          }
          this.options.runtime.focusNode(nodeId);
        }
        event.stopNow?.();
        event.stop?.();
        this.dragState = null;
        this.resizeState = null;
        this.syncInteractionActivityState();
        this.options.container.style.cursor = "";
        const beforeCollapsed = Boolean(state.state.flags.collapsed);
        const afterCollapsed = !beforeCollapsed;
        const changed = this.options.runtime.setNodeCollapsed(
          nodeId,
          afterCollapsed
        );
        if (changed && beforeCollapsed !== afterCollapsed) {
          this.options.emitInteractionCommit?.({
            type: "node.collapse.commit",
            nodeId,
            beforeCollapsed,
            afterCollapsed
          });
        }
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
      this.connectionState?.originNodeId === nodeId ||
      this.connectionState?.hoveredTarget?.nodeId === nodeId
    ) {
      this.clearConnectionState();
      cleared = true;
    }

    if (cleared) {
      this.syncInteractionActivityState();
      this.options.container.style.cursor = "";
    }
  }

  /** 清理当前交互态，供整图重建和销毁前复用。 */
  clearInteractionState(): void {
    this.dragState = null;
    this.resizeState = null;
    this.selectionState = null;
    this.clearConnectionState();
    this.selectionBoxHost.hide();
    this.syncInteractionActivityState();
    this.options.container.style.cursor = "";
  }

  /** 判断某个节点当前是否处于 resize 拖拽态。 */
  isResizingNode(nodeId: string): boolean {
    return this.resizeState?.nodeId === nodeId;
  }

  /** 读取当前最小交互活跃态快照。 */
  getInteractionActivityState(): LeaferGraphInteractionActivityState {
    return { ...this.interactionActivityState };
  }

  /** 订阅交互活跃态变化。 */
  subscribeInteractionActivity(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): () => void {
    this.interactionActivityListeners.add(listener);
    listener(this.getInteractionActivityState());

    return () => {
      this.interactionActivityListeners.delete(listener);
    };
  }

  /** 卸载窗口级事件监听并清理交互态。 */
  destroy(): void {
    this.clearInteractionState();
    this.ownerWindow.removeEventListener(
      "pointermove",
      this.handleWindowPointerMove
    );
    this.options.container.removeEventListener(
      "pointerdown",
      this.handleContainerPointerDown
    );
    this.ownerWindow.removeEventListener("pointerup", this.handleWindowPointerUp);
    this.ownerWindow.removeEventListener(
      "pointercancel",
      this.handleWindowPointerUp
    );
    this.ownerWindow.removeEventListener("keydown", this.handleWindowKeyDown);
    this.ownerWindow.removeEventListener("keyup", this.handleWindowKeyUp);
    this.selectionBoxHost.destroy();
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
    this.syncInteractionActivityState();
    this.options.runtime.syncNodeResizeHandleVisibility(nodeId);
    this.options.container.style.cursor = "grabbing";
  }

  /** 启动一次端口拖线。 */
  private startConnectionDrag(
    nodeId: string,
    direction: SlotDirection,
    slot: number,
    event: LeaferGraphWidgetPointerEvent
  ): void {
    const originPort = this.options.runtime.resolvePort(nodeId, direction, slot);
    if (!originPort) {
      return;
    }

    this.dragState = null;
    this.resizeState = null;
    this.connectionState = {
      originNodeId: nodeId,
      originDirection: originPort.direction,
      originSlot: originPort.slot,
      hoveredTarget: null
    };
    this.syncInteractionActivityState();

    this.options.runtime.setConnectionSourcePort(originPort);
    this.options.runtime.setConnectionCandidatePort(null);
    this.options.runtime.setConnectionPreview(
      originPort,
      this.options.runtime.getPagePointFromGraphEvent(event)
    );
    this.options.container.style.cursor = "crosshair";
  }

  /** 根据当前鼠标位置刷新拖线预览和候选目标。 */
  private updateConnectionPreview(point: { x: number; y: number }): void {
    if (!this.connectionState) {
      return;
    }

    const originPort = this.options.runtime.resolvePort(
      this.connectionState.originNodeId,
      this.connectionState.originDirection,
      this.connectionState.originSlot
    );
    if (!originPort) {
      this.clearConnectionState();
      this.options.container.style.cursor = "";
      return;
    }

    const rawTarget = this.options.runtime.resolvePortAtPoint(
      point,
      this.getOppositeDirection(originPort.direction)
    );
    const endpoints = rawTarget
      ? this.resolveConnectionEndpoints(originPort, rawTarget)
      : null;
    const validation = endpoints
      ? this.options.runtime.canCreateLink(endpoints.source, endpoints.target)
      : { valid: false as const };
    const hoveredTarget = rawTarget && validation.valid ? rawTarget : null;

    this.connectionState.hoveredTarget = hoveredTarget;
    this.options.runtime.setConnectionCandidatePort(hoveredTarget);
    this.options.runtime.setConnectionPreview(
      originPort,
      point,
      hoveredTarget ?? undefined
    );
    this.options.container.style.cursor =
      rawTarget && !validation.valid ? "not-allowed" : "crosshair";
  }

  /** 在窗口级 pointer up 时完成或取消一次拖线。 */
  private finishConnection(point?: { x: number; y: number }): void {
    const connection = this.connectionState;
    if (!connection) {
      return;
    }

    const originPort = this.options.runtime.resolvePort(
      connection.originNodeId,
      connection.originDirection,
      connection.originSlot
    );
    let targetPort = connection.hoveredTarget;

    if (point && originPort) {
      const rawTarget = this.options.runtime.resolvePortAtPoint(
        point,
        this.getOppositeDirection(originPort.direction)
      );
      const endpoints = rawTarget
        ? this.resolveConnectionEndpoints(originPort, rawTarget)
        : null;
      if (
        rawTarget &&
        endpoints &&
        this.options.runtime.canCreateLink(endpoints.source, endpoints.target).valid
      ) {
        targetPort = rawTarget;
      }
    }

    if (originPort && targetPort) {
      const endpoints = this.resolveConnectionEndpoints(originPort, targetPort);
      if (endpoints) {
        if (this.options.emitInteractionCommit) {
          this.options.emitInteractionCommit({
            type: "link.create.commit",
            input: {
              source: {
                nodeId: endpoints.source.nodeId,
                slot: endpoints.source.slot
              },
              target: {
                nodeId: endpoints.target.nodeId,
                slot: endpoints.target.slot
              }
            }
          });
        } else {
          this.options.runtime.createLink(endpoints.source, endpoints.target);
        }
      }
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
    this.syncInteractionActivityState();
  }

  /** 根据当前内部状态同步对外可见的交互活跃态。 */
  private syncInteractionActivityState(): void {
    let mode: LeaferGraphInteractionActivityState["mode"] = "idle";
    if (this.connectionState) {
      mode = "link-connect";
    } else if (this.resizeState) {
      mode = "node-resize";
    } else if (this.selectionState?.started) {
      mode = "selection-box";
    } else if (this.dragState) {
      mode = "node-drag";
    }

    const nextState: LeaferGraphInteractionActivityState = {
      active: mode !== "idle",
      mode
    };
    if (
      this.interactionActivityState.active === nextState.active &&
      this.interactionActivityState.mode === nextState.mode
    ) {
      return;
    }

    this.interactionActivityState = nextState;
    if (!this.interactionActivityListeners.size) {
      return;
    }

    const snapshot = this.getInteractionActivityState();
    for (const listener of this.interactionActivityListeners) {
      listener(snapshot);
    }
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

  /** 判断当前事件命中是否来自节点端口热区，避免拖线按下被误识别成拖节点。 */
  private isPortHitTarget(
    target: LeaferGraphWidgetPointerEvent["target"]
  ): boolean {
    let current = target;

    while (current) {
      if ((current.name ?? "").startsWith("node-port-hit-")) {
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

  /** 根据拖线起点方向解析目标端应命中的相反方向。 */
  private getOppositeDirection(direction: SlotDirection): SlotDirection {
    return direction === "output" ? "input" : "output";
  }

  /** 根据当前框选手势刷新矩形 overlay 和选区结果。 */
  private updateSelectionDrag(event: PointerEvent): void {
    const selectionState = this.selectionState;
    if (!selectionState) {
      return;
    }

    const point = this.options.runtime.getPagePointByClient(event);
    selectionState.currentPageX = point.x;
    selectionState.currentPageY = point.y;

    if (
      !selectionState.started &&
      Math.abs(selectionState.currentPageX - selectionState.startPageX) < 4 &&
      Math.abs(selectionState.currentPageY - selectionState.startPageY) < 4
    ) {
      return;
    }

    selectionState.started = true;
    const selectionBounds = this.resolveSelectionBounds(selectionState);
    this.selectionBoxHost.show(selectionBounds);
    this.options.runtime.setSelectedNodeIds(
      this.options.runtime.resolveNodeIdsInBounds(selectionBounds),
      selectionState.additive ? "add" : "replace"
    );
    this.syncInteractionActivityState();
  }

  /** 结束一次空白区点击或框选拖拽。 */
  private finishSelectionDrag(): void {
    const selectionState = this.selectionState;
    if (!selectionState) {
      return;
    }

    this.selectionState = null;
    this.selectionBoxHost.hide();
    if (!selectionState.started && !selectionState.additive) {
      this.options.runtime.clearSelectedNodes();
    }
    this.syncInteractionActivityState();
  }

  /** 统一读取当前事件里的多选辅助修饰键。 */
  private isSelectionModifierPressed(
    event: LeaferGraphWidgetPointerEvent
  ): boolean {
    const origin = event.origin as PointerEvent | undefined;
    const eventLike = event as LeaferGraphWidgetPointerEvent & {
      shiftKey?: boolean;
    };
    return Boolean(origin?.shiftKey ?? eventLike.shiftKey);
  }

  /** 把一次框选手势归一成 page 坐标矩形。 */
  private resolveSelectionBounds(
    selectionState: GraphSelectionState
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.min(selectionState.startPageX, selectionState.currentPageX),
      y: Math.min(selectionState.startPageY, selectionState.currentPageY),
      width: Math.abs(selectionState.currentPageX - selectionState.startPageX),
      height: Math.abs(selectionState.currentPageY - selectionState.startPageY)
    };
  }

  /**
   * 把任意方向发起的拖线归一成正式 `output -> input` 端点对。
   * 这样左侧输入端口也能发起拖线，但真正落图时仍保持统一连线模型。
   */
  private resolveConnectionEndpoints(
    originPort: LeaferGraphConnectionPortState,
    candidatePort: LeaferGraphConnectionPortState
  ):
    | {
        source: LeaferGraphConnectionPortState;
        target: LeaferGraphConnectionPortState;
      }
    | null {
    if (originPort.direction === candidatePort.direction) {
      return null;
    }

    return originPort.direction === "output"
      ? {
          source: originPort,
          target: candidatePort
        }
      : {
          source: candidatePort,
          target: originPort
        };
  }
}
