/**
 * 图交互宿主 controller。
 *
 * @remarks
 * 负责持有 gesture state，并把 drag / resize / connection / selection
 * 相关逻辑委托给 `host/*` helper。
 */

import type { Group } from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphInteractionActivityState } from "@leafergraph/contracts";
import { LeaferGraphSelectionBoxHost } from "../selection_box_host";
import type {
  GraphConnectionState,
  GraphDragState,
  GraphResizeState,
  GraphSelectionState,
  LeaferGraphInteractionHostContext,
  LeaferGraphInteractionHostOptions,
  LeaferGraphInteractiveNodeViewState
} from "./types";
import {
  getLeaferGraphInteractionActivityStateSnapshot,
  subscribeLeaferGraphInteractionActivity,
  syncLeaferGraphInteractionActivityState
} from "./activity";
import {
  bindLeaferGraphNodeDragging,
  finishLeaferGraphNodeDrag,
  updateLeaferGraphNodeDrag
} from "./drag";
import { bindLeaferGraphNodeResize, finishLeaferGraphNodeResize, updateLeaferGraphNodeResize } from "./resize";
import {
  bindLeaferGraphNodePorts,
  clearLeaferGraphConnectionState,
  finishLeaferGraphConnection,
  updateLeaferGraphConnectionPreview
} from "./connection";
import {
  finishLeaferGraphSelectionDrag,
  startLeaferGraphSelectionDrag,
  updateLeaferGraphSelectionDrag
} from "./selection";

/**
 * 节点交互宿主 controller。
 */
export class LeaferGraphInteractionHostController<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  protected readonly options: LeaferGraphInteractionHostOptions<
    TNodeState,
    TNodeViewState
  >;
  protected readonly ownerWindow: Window;
  protected dragState: GraphDragState | null = null;
  protected resizeState: GraphResizeState | null = null;
  protected connectionState: GraphConnectionState | null = null;
  protected selectionState: GraphSelectionState | null = null;
  protected interactionActivityState: LeaferGraphInteractionActivityState = {
    active: false,
    mode: "idle"
  };
  protected readonly selectionBoxHost: LeaferGraphSelectionBoxHost;
  protected readonly interactionActivityListeners = new Set<
    (state: LeaferGraphInteractionActivityState) => void
  >();
  protected spaceKeyPressed = false;
  private readonly context: LeaferGraphInteractionHostContext<
    TNodeState,
    TNodeViewState
  >;

  /**
   * 初始化图交互宿主 controller。
   *
   * @param options - 图交互宿主初始化选项。
   * @returns 无返回值。
   */
  constructor(
    options: LeaferGraphInteractionHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
    // 先创建 selection overlay 和共享上下文，把后续手势 helper 依赖集中到一个稳定壳面上。
    this.selectionBoxHost = new LeaferGraphSelectionBoxHost({
      selectionLayer: this.options.selectionLayer,
      requestRender: () => this.options.requestRender(),
      resolveStroke: () => this.options.resolveSelectionStroke()
    });
    this.ownerWindow = this.options.container.ownerDocument.defaultView ?? window;
    this.context = {
      options: this.options,
      ownerWindow: this.ownerWindow,
      selectionBoxHost: this.selectionBoxHost,
      getDragState: () => this.dragState,
      setDragState: (state) => {
        this.dragState = state;
      },
      getResizeState: () => this.resizeState,
      setResizeState: (state) => {
        this.resizeState = state;
      },
      getConnectionState: () => this.connectionState,
      setConnectionState: (state) => {
        this.connectionState = state;
      },
      getSelectionState: () => this.selectionState,
      setSelectionState: (state) => {
        this.selectionState = state;
      },
      isSpaceKeyPressed: () => this.spaceKeyPressed,
      setSpaceKeyPressed: (value) => {
        this.spaceKeyPressed = value;
      },
      getInteractionActivityState: () => this.interactionActivityState,
      setInteractionActivityState: (state) => {
        this.interactionActivityState = state;
      },
      getInteractionActivityListeners: () => this.interactionActivityListeners,
      addInteractionActivityListener: (listener) => {
        this.interactionActivityListeners.add(listener);
      },
      removeInteractionActivityListener: (listener) => {
        this.interactionActivityListeners.delete(listener);
      },
      clearConnectionState: () => this.clearConnectionState(),
      syncInteractionActivityState: () => this.syncInteractionActivityState()
    };
    // 再绑定容器和窗口级事件，让 drag / resize / selection / connection 全部走统一入口。
    this.options.container.addEventListener(
      "pointerdown",
      this.handleContainerPointerDown
    );
    this.ownerWindow.addEventListener("pointermove", this.handleWindowPointerMove);
    this.ownerWindow.addEventListener("pointerup", this.handleWindowPointerUp);
    this.ownerWindow.addEventListener("pointercancel", this.handleWindowPointerUp);
    this.ownerWindow.addEventListener("keydown", this.handleWindowKeyDown);
    this.ownerWindow.addEventListener("keyup", this.handleWindowKeyUp);
  }

  /**
   * 窗口级 pointer move 入口。
   *
   * @param event - 浏览器指针事件。
   * @returns 无返回值。
   */
  protected readonly handleWindowPointerMove = (event: PointerEvent): void => {
    // 按当前手势优先级逐层分发，保证同一时刻只有一条交互链路在消费 move。
    if (this.selectionState) {
      updateLeaferGraphSelectionDrag(this.context, event);
      return;
    }

    if (this.connectionState) {
      const point = this.options.runtime.getPagePointByClient(event);
      updateLeaferGraphConnectionPreview(this.context, point);
      return;
    }

    if (updateLeaferGraphNodeResize(this.context, event)) {
      return;
    }

    updateLeaferGraphNodeDrag(this.context, event);
  };

  /**
   * 窗口级 pointer up / pointer cancel 入口。
   *
   * @param event - 可选的浏览器指针事件。
   * @returns 无返回值。
   */
  protected readonly handleWindowPointerUp = (event?: PointerEvent): void => {
    // 先按当前活跃手势类型执行收尾，避免不同交互提交逻辑彼此串扰。
    if (this.selectionState) {
      finishLeaferGraphSelectionDrag(this.context);
      return;
    }

    if (this.connectionState) {
      const point = event
        ? this.options.runtime.getPagePointByClient(event)
        : undefined;
      finishLeaferGraphConnection(this.context, point);
      return;
    }

    const resizeNodeId = finishLeaferGraphNodeResize(this.context);
    const dragNodeId = finishLeaferGraphNodeDrag(this.context);

    // 再把可能被隐藏的 resize 句柄显隐状态同步回节点视图。
    if (resizeNodeId) {
      this.options.runtime.syncNodeResizeHandleVisibility(resizeNodeId);
    }

    if (dragNodeId && dragNodeId !== resizeNodeId) {
      this.options.runtime.syncNodeResizeHandleVisibility(dragNodeId);
    }
  };

  /**
   * 窗口级 keydown 入口。
   *
   * @param event - 浏览器键盘事件。
   * @returns 无返回值。
   */
  protected readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceKeyPressed = true;
    }
  };

  /**
   * 窗口级 keyup 入口。
   *
   * @param event - 浏览器键盘事件。
   * @returns 无返回值。
   */
  protected readonly handleWindowKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spaceKeyPressed = false;
    }
  };

  /**
   * 画布容器 pointer down 入口。
   *
   * @param event - 浏览器指针事件。
   * @returns 无返回值。
   */
  protected readonly handleContainerPointerDown = (event: PointerEvent): void => {
    startLeaferGraphSelectionDrag(this.context, event);
  };

  /**
   * 绑定节点拖拽交互。
   *
   * @param nodeId - 目标节点 ID。
   * @param view - 当前节点视图。
   * @returns 无返回值。
   */
  bindNodeDragging(nodeId: string, view: Group): void {
    bindLeaferGraphNodeDragging(this.context, nodeId, view);
  }

  /**
   * 绑定节点右下角 resize 句柄。
   *
   * @param nodeId - 目标节点 ID。
   * @param state - 当前节点视图状态。
   * @returns 无返回值。
   */
  bindNodeResize(nodeId: string, state: TNodeViewState): void {
    bindLeaferGraphNodeResize(this.context, nodeId, state);
  }

  /**
   * 绑定节点端口的最小拖线交互。
   *
   * @param nodeId - 目标节点 ID。
   * @param state - 当前节点视图状态。
   * @returns 无返回值。
   */
  bindNodePorts(nodeId: string, state: TNodeViewState): void {
    bindLeaferGraphNodePorts(this.context, nodeId, state);
  }

  /**
   * 绑定左上角信号球的折叠开关。
   *
   * @param nodeId - 目标节点 ID。
   * @param state - 当前节点视图状态。
   * @returns 无返回值。
   */
  bindNodeCollapseToggle(nodeId: string, state: TNodeViewState): void {
    state.shellView.signalButton.on("pointer.down", (event) => {
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
      const changed = this.options.runtime.setNodeCollapsed(nodeId, afterCollapsed);
      if (changed && beforeCollapsed !== afterCollapsed) {
        this.options.emitInteractionCommit?.({
          type: "node.collapse.commit",
          nodeId,
          beforeCollapsed,
          afterCollapsed
        });
      }
    });
  }

  /**
   * 某个节点被外部删除时，及时回收可能悬挂的交互状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
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

  /**
   * 清理当前交互态，供整图重建和销毁前复用。
   *
   * @returns 无返回值。
   */
  clearInteractionState(): void {
    this.dragState = null;
    this.resizeState = null;
    this.selectionState = null;
    this.clearConnectionState();
    this.selectionBoxHost.hide();
    this.syncInteractionActivityState();
    this.options.container.style.cursor = "";
  }

  /**
   * 判断某个节点当前是否处于 resize 拖拽态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否正在 resize。
   */
  isResizingNode(nodeId: string): boolean {
    return this.resizeState?.nodeId === nodeId;
  }

  /**
   * 读取当前最小交互活跃态快照。
   *
   * @returns 当前交互活跃态快照。
   */
  getInteractionActivityState(): LeaferGraphInteractionActivityState {
    return getLeaferGraphInteractionActivityStateSnapshot(this.context);
  }

  /**
   * 订阅交互活跃态变化。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeInteractionActivity(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): () => void {
    return subscribeLeaferGraphInteractionActivity(this.context, listener);
  }

  /**
   * 卸载窗口级事件监听并清理交互态。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.clearInteractionState();
    this.ownerWindow.removeEventListener("pointermove", this.handleWindowPointerMove);
    this.options.container.removeEventListener(
      "pointerdown",
      this.handleContainerPointerDown
    );
    this.ownerWindow.removeEventListener("pointerup", this.handleWindowPointerUp);
    this.ownerWindow.removeEventListener("pointercancel", this.handleWindowPointerUp);
    this.ownerWindow.removeEventListener("keydown", this.handleWindowKeyDown);
    this.ownerWindow.removeEventListener("keyup", this.handleWindowKeyUp);
    this.selectionBoxHost.destroy();
  }

  /**
   * 清理当前拖线相关的视觉反馈和临时状态。
   *
   * @returns 无返回值。
   */
  protected clearConnectionState(): void {
    clearLeaferGraphConnectionState(this.context);
  }

  /**
   * 根据当前内部状态同步对外可见的交互活跃态。
   *
   * @returns 无返回值。
   */
  protected syncInteractionActivityState(): void {
    syncLeaferGraphInteractionActivityState(this.context);
  }
}
