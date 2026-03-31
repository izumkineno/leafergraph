/**
 * 图交互宿主内部类型定义。
 *
 * @remarks
 * 负责承载 gesture state、host options 和 controller helper 共享上下文。
 */

import type { Group } from "leafer-ui";
import type { NodeRuntimeState, SlotDirection, SlotType } from "@leafergraph/node";
import type {
  LeaferGraphConnectionPortState,
  LeaferGraphInteractionActivityState,
  LeaferGraphInteractionCommitEvent
} from "@leafergraph/contracts";
import type {
  GraphDragNodePosition,
  LeaferGraphInteractionRuntimeLike
} from "../runtime/types";
import type { LeaferGraphSelectionBoxHost } from "../selection_box_host";
import type {
  LeaferGraphWidgetEventSource,
} from "@leafergraph/widget-runtime";

/**
 * 拖拽中的节点状态。
 */
export interface GraphDragState {
  anchorNodeId: string;
  offsetX: number;
  offsetY: number;
  anchorStartX: number;
  anchorStartY: number;
  nodes: GraphDragNodePosition[];
}

/**
 * 拖拽 resize 句柄时的节点缩放状态。
 */
export interface GraphResizeState {
  nodeId: string;
  startWidth: number;
  startHeight: number;
  startPageX: number;
  startPageY: number;
}

/**
 * 拖拽中的最小连接状态。
 */
export interface GraphConnectionState {
  originNodeId: string;
  originDirection: SlotDirection;
  originSlot: number;
  hoveredTarget: LeaferGraphConnectionPortState | null;
}

/**
 * 左键空白区框选时维护的最小手势状态。
 */
export interface GraphSelectionState {
  startPageX: number;
  startPageY: number;
  currentPageX: number;
  currentPageY: number;
  additive: boolean;
  started: boolean;
}

/**
 * 交互宿主依赖的最小端口视图结构。
 */
export interface LeaferGraphInteractivePortViewState {
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

/**
 * 交互宿主依赖的最小节点视图结构。
 */
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

/**
 * 图交互宿主初始化选项。
 */
export interface LeaferGraphInteractionHostOptions<
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
 * 图交互 host helper 共享的最小上下文。
 */
export interface LeaferGraphInteractionHostContext<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  readonly options: LeaferGraphInteractionHostOptions<TNodeState, TNodeViewState>;
  readonly ownerWindow: Window;
  readonly selectionBoxHost: LeaferGraphSelectionBoxHost;
  getDragState(): GraphDragState | null;
  setDragState(state: GraphDragState | null): void;
  getResizeState(): GraphResizeState | null;
  setResizeState(state: GraphResizeState | null): void;
  getConnectionState(): GraphConnectionState | null;
  setConnectionState(state: GraphConnectionState | null): void;
  getSelectionState(): GraphSelectionState | null;
  setSelectionState(state: GraphSelectionState | null): void;
  isSpaceKeyPressed(): boolean;
  setSpaceKeyPressed(value: boolean): void;
  getInteractionActivityState(): LeaferGraphInteractionActivityState;
  setInteractionActivityState(state: LeaferGraphInteractionActivityState): void;
  getInteractionActivityListeners(): ReadonlySet<
    (state: LeaferGraphInteractionActivityState) => void
  >;
  addInteractionActivityListener(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): void;
  removeInteractionActivityListener(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): void;
  clearConnectionState(): void;
  syncInteractionActivityState(): void;
}
