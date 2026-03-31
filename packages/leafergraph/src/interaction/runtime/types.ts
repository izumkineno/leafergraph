/**
 * 图交互运行时内部类型定义。
 *
 * @remarks
 * 负责承载 runtime controller 和各子能力 helper 共享的最小类型。
 */

import type { Path } from "leafer-ui";
import type { NodeRuntimeState, SlotDirection, SlotType } from "@leafergraph/node";
import type {
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import type { LeaferGraphSceneRuntimeHost } from "../../graph/host/scene_runtime";

/**
 * 多选拖拽时记录的单个节点初始位置。
 */
export interface GraphDragNodePosition {
  /** 节点 ID。 */
  nodeId: string;
  /** 拖拽开始时的 X。 */
  startX: number;
  /** 拖拽开始时的 Y。 */
  startY: number;
}

/**
 * 交互运行时依赖的最小端口视图结构。
 */
export interface LeaferGraphInteractionPortViewLike {
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
  hitArea: {
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
 * 交互运行时依赖的最小节点视图结构。
 */
export interface LeaferGraphInteractionRuntimeNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  /** 节点运行时状态。 */
  state: TNodeState;
  /** 节点根视图的最小可用快照。 */
  view: {
    /** 当前 zIndex。 */
    zIndex?: number;
  };
  /** 节点壳视图最小快照。 */
  shellView: {
    /** 当前节点端口视图列表。 */
    portViews: LeaferGraphInteractionPortViewLike[];
  };
  /** 当前节点是否处于 hover 态。 */
  hovered: boolean;
}

/**
 * 交互宿主对外只依赖这一层运行时壳面。
 */
export interface LeaferGraphInteractionRuntimeLike<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  /** 按节点 ID 读取节点视图。 */
  getNodeView(nodeId: string): TNodeViewState | undefined;
  /** 更新节点 hover 状态。 */
  setNodeHovered(nodeId: string, hovered: boolean): void;
  /** 把某个节点提升到前景。 */
  focusNode(nodeId: string): boolean;
  /** 同步节点 resize 句柄可见性。 */
  syncNodeResizeHandleVisibility(nodeId: string): void;
  /** 解析指定节点的端口。 */
  resolvePort(
    nodeId: string,
    direction: SlotDirection,
    slot: number
  ): LeaferGraphConnectionPortState | undefined;
  /** 按坐标解析当前命中的端口。 */
  resolvePortAtPoint(
    point: { x: number; y: number },
    direction: SlotDirection
  ): LeaferGraphConnectionPortState | undefined;
  /** 设置连接预览起点端口。 */
  setConnectionSourcePort(
    port: LeaferGraphConnectionPortState | null
  ): void;
  /** 设置连接预览候选端口。 */
  setConnectionCandidatePort(
    port: LeaferGraphConnectionPortState | null
  ): void;
  /** 更新连接预览路径。 */
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void;
  /** 清空连接预览。 */
  clearConnectionPreview(): void;
  /** 校验一条连线是否允许创建。 */
  canCreateLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult;
  /** 创建一条正式连线。 */
  createLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): boolean;
  /** 解析本次拖拽应一起移动的节点 ID。 */
  resolveDraggedNodeIds(nodeId: string): string[];
  /** 按增量移动一组节点。 */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void;
  /** 直接调整某个节点尺寸。 */
  resizeNode(nodeId: string, size: { width: number; height: number }): void;
  /** 设置节点折叠状态。 */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
  /** 当前节点是否允许 resize。 */
  canResizeNode(nodeId: string): boolean;
  /** 列出当前选区节点 ID。 */
  listSelectedNodeIds(): string[];
  /** 当前节点是否处于选中态。 */
  isNodeSelected(nodeId: string): boolean;
  /** 按模式更新选区。 */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  /** 清空当前选区。 */
  clearSelectedNodes(): string[];
  /** 按坐标解析当前命中的节点。 */
  resolveNodeAtPoint(point: { x: number; y: number }): string | undefined;
  /** 按矩形范围解析命中的节点列表。 */
  resolveNodeIdsInBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): string[];
  /** 把客户端坐标转换成页面坐标。 */
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  };
  /** 从图事件中读取页面坐标。 */
  getPagePointFromGraphEvent(event: LeaferGraphWidgetPointerEvent): {
    x: number;
    y: number;
  };
  /** 解析节点当前尺寸。 */
  resolveNodeSize(nodeId: string): { width: number; height: number } | undefined;
}

/**
 * 交互运行时 controller 初始化选项。
 */
export interface LeaferGraphInteractionRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  /** 节点视图映射。 */
  nodeViews: Map<string, TNodeViewState>;
  /** 连线层。 */
  linkLayer: {
    add(child: Path): unknown;
  };
  /** 把节点视图提升到前景。 */
  bringNodeViewToFront(state: TNodeViewState): void;
  /** 同步节点 resize 句柄可见性。 */
  syncNodeResizeHandleVisibility(state: TNodeViewState): void;
  /** 请求宿主渲染一帧。 */
  requestRender(): void;
  /** 解析需要一起拖拽的节点 ID。 */
  resolveDraggedNodeIds(nodeId: string): string[];
  /** 列出当前选区节点 ID。 */
  listSelectedNodeIds(): string[];
  /** 当前节点是否处于选中态。 */
  isNodeSelected(nodeId: string): boolean;
  /** 按模式更新选区。 */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  /** 清空当前选区。 */
  clearSelectedNodes(): string[];
  /** 图场景运行时能力。 */
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "moveNodesByDelta" | "resizeNode" | "createLink" | "findLinksByNode"
  >;
  /** 设置节点折叠状态。 */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
  /** 当前节点是否允许 resize。 */
  canResizeNode(nodeId: string): boolean;
  /** 把客户端坐标转换成页面坐标。 */
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  };
  /** 从图事件中读取页面坐标。 */
  getPagePointFromGraphEvent(event: LeaferGraphWidgetPointerEvent): {
    x: number;
    y: number;
  };
  /** 解析节点当前尺寸。 */
  resolveNodeSize(state: TNodeViewState): {
    width: number;
    height: number;
  };
  /** 按槽位类型着色的端口颜色表。 */
  slotTypeFillMap: Readonly<Record<string, string>>;
  /** 未知槽位类型的回退颜色。 */
  genericPortFill: string;
  /** 解析连接预览描边回退颜色。 */
  resolveConnectionPreviewStrokeFallback(): string;
}

/**
 * 交互运行时子模块共享的最小 controller 上下文。
 */
export interface LeaferGraphInteractionRuntimeContext<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  /** 交互运行时初始化选项。 */
  readonly options: LeaferGraphInteractionRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;
  /** 当前连接预览路径图元。 */
  readonly previewPath: Path;
  /** 读取当前起点端口 key。 */
  getActiveSourcePortKey(): string | null;
  /** 设置当前起点端口 key。 */
  setActiveSourcePortKey(portKey: string | null): void;
  /** 读取当前候选端口 key。 */
  getActiveCandidatePortKey(): string | null;
  /** 设置当前候选端口 key。 */
  setActiveCandidatePortKey(portKey: string | null): void;
  /** 切换某个端口高亮。 */
  togglePortHighlight(portKey: string | null, visible: boolean): void;
  /** 按 key 查找端口视图。 */
  findPortViewByKey(portKey: string): LeaferGraphInteractionPortViewLike | undefined;
  /** 确保预览路径挂到连线层。 */
  attachPreviewPathToLayer(): void;
  /** 解析节点当前边界。 */
  resolveNodeBounds(
    state: TNodeViewState
  ): { x: number; y: number; width: number; height: number } | undefined;
  /** 解析连接预览描边颜色。 */
  resolveConnectionPreviewStroke(
    source: LeaferGraphConnectionPortState
  ): string;
}
