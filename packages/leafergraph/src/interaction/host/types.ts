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
  /** 本次拖拽锚定的主节点 ID。 */
  anchorNodeId: string;
  /** 指针相对锚定节点左上角的 X 偏移。 */
  offsetX: number;
  /** 指针相对锚定节点左上角的 Y 偏移。 */
  offsetY: number;
  /** 锚定节点拖拽开始时的 X。 */
  anchorStartX: number;
  /** 锚定节点拖拽开始时的 Y。 */
  anchorStartY: number;
  /** 当前整组拖拽节点的起始位置快照。 */
  nodes: GraphDragNodePosition[];
}

/**
 * 拖拽 resize 句柄时的节点缩放状态。
 */
export interface GraphResizeState {
  /** 正在 resize 的节点 ID。 */
  nodeId: string;
  /** resize 开始时宽度。 */
  startWidth: number;
  /** resize 开始时高度。 */
  startHeight: number;
  /** resize 开始时页面坐标 X。 */
  startPageX: number;
  /** resize 开始时页面坐标 Y。 */
  startPageY: number;
}

/**
 * 拖拽中的最小连接状态。
 */
export interface GraphConnectionState {
  /** 连接预览起点节点 ID。 */
  originNodeId: string;
  /** 连接预览起点方向。 */
  originDirection: SlotDirection;
  /** 连接预览起点槽位索引。 */
  originSlot: number;
  /** 当前 hover 到的候选目标端口。 */
  hoveredTarget: LeaferGraphConnectionPortState | null;
}

/**
 * 左键空白区框选时维护的最小手势状态。
 */
export interface GraphSelectionState {
  /** 框选开始时页面坐标 X。 */
  startPageX: number;
  /** 框选开始时页面坐标 Y。 */
  startPageY: number;
  /** 当前框选末端页面坐标 X。 */
  currentPageX: number;
  /** 当前框选末端页面坐标 Y。 */
  currentPageY: number;
  /** 是否为追加选区模式。 */
  additive: boolean;
  /** 是否已经进入正式框选状态。 */
  started: boolean;
}

/**
 * 交互宿主依赖的最小端口视图结构。
 */
export interface LeaferGraphInteractivePortViewState {
  /** 端口布局快照。 */
  layout: {
    /** 端口方向。 */
    direction: SlotDirection;
    /** 端口索引。 */
    index: number;
    /** 端口 X。 */
    portX: number;
    /** 端口 Y。 */
    portY: number;
    /** 端口宽度。 */
    portWidth: number;
    /** 端口高度。 */
    portHeight: number;
    /** 槽位类型。 */
    slotType?: SlotType;
  };
  /** 端口高亮状态。 */
  highlight: {
    /** 高亮是否可见。 */
    visible?: boolean | 0;
    /** 高亮透明度。 */
    opacity?: number;
  };
  /** 端口命中热区。 */
  hitArea: LeaferGraphWidgetEventSource & {
    /** 热区 X。 */
    x?: number;
    /** 热区 Y。 */
    y?: number;
    /** 热区宽度。 */
    width?: number;
    /** 热区高度。 */
    height?: number;
  };
}

/**
 * 交互宿主依赖的最小节点视图结构。
 */
export interface LeaferGraphInteractiveNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  /** 节点运行时状态。 */
  state: TNodeState;
  /** 节点根视图。 */
  view: Group;
  /** resize 句柄事件源。 */
  resizeHandle: LeaferGraphWidgetEventSource;
  /** 节点壳视图最小快照。 */
  shellView: {
    /** 状态灯按钮事件源。 */
    signalButton: LeaferGraphWidgetEventSource;
    /** 当前节点的端口视图列表。 */
    portViews: LeaferGraphInteractivePortViewState[];
    /** 标题文本元素。 */
    titleLabel: LeaferGraphWidgetEventSource | null;
    /** 标题点击热区。 */
    titleHitArea: LeaferGraphWidgetEventSource | null;
  };
  /** 当前节点是否处于 hover 态。 */
  hovered: boolean;
}

/**
 * 图交互宿主初始化选项。
 */
export interface LeaferGraphInteractionHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  /** 图容器元素。 */
  container: HTMLElement;
  /** 交互运行时壳面。 */
  runtime: LeaferGraphInteractionRuntimeLike<TNodeState, TNodeViewState>;
  /** 框选层。 */
  selectionLayer: Group;
  /** 解析框选描边色。 */
  resolveSelectionStroke(): string;
  /** 请求宿主渲染一帧。 */
  requestRender(): void;
  /** 发射正式交互提交事件。 */
  emitInteractionCommit?(event: LeaferGraphInteractionCommitEvent): void;
}

/**
 * 图交互 host helper 共享的最小上下文。
 */
export interface LeaferGraphInteractionHostContext<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractiveNodeViewState<TNodeState>
> {
  /** 交互宿主初始化选项。 */
  readonly options: LeaferGraphInteractionHostOptions<TNodeState, TNodeViewState>;
  /** 当前容器所属 Window。 */
  readonly ownerWindow: Window;
  /** 框选宿主。 */
  readonly selectionBoxHost: LeaferGraphSelectionBoxHost;
  /** 读取当前拖拽状态。 */
  getDragState(): GraphDragState | null;
  /** 写入当前拖拽状态。 */
  setDragState(state: GraphDragState | null): void;
  /** 读取当前 resize 状态。 */
  getResizeState(): GraphResizeState | null;
  /** 写入当前 resize 状态。 */
  setResizeState(state: GraphResizeState | null): void;
  /** 读取当前连接状态。 */
  getConnectionState(): GraphConnectionState | null;
  /** 写入当前连接状态。 */
  setConnectionState(state: GraphConnectionState | null): void;
  /** 读取当前框选状态。 */
  getSelectionState(): GraphSelectionState | null;
  /** 写入当前框选状态。 */
  setSelectionState(state: GraphSelectionState | null): void;
  /** 当前空格键是否按下。 */
  isSpaceKeyPressed(): boolean;
  /** 更新空格键按下状态。 */
  setSpaceKeyPressed(value: boolean): void;
  /** 读取当前交互活跃态。 */
  getInteractionActivityState(): LeaferGraphInteractionActivityState;
  /** 写入当前交互活跃态。 */
  setInteractionActivityState(state: LeaferGraphInteractionActivityState): void;
  /** 读取交互活跃态监听器集合。 */
  getInteractionActivityListeners(): ReadonlySet<
    (state: LeaferGraphInteractionActivityState) => void
  >;
  /** 添加交互活跃态监听器。 */
  addInteractionActivityListener(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): void;
  /** 移除交互活跃态监听器。 */
  removeInteractionActivityListener(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): void;
  /** 清空当前连接状态。 */
  clearConnectionState(): void;
  /** 按当前 gesture 状态同步交互活跃态。 */
  syncInteractionActivityState(): void;
}
