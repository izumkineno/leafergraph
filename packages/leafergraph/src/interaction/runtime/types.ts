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
  nodeId: string;
  startX: number;
  startY: number;
}

/**
 * 交互运行时依赖的最小端口视图结构。
 */
export interface LeaferGraphInteractionPortViewLike {
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
  hitArea: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

/**
 * 交互运行时依赖的最小节点视图结构。
 */
export interface LeaferGraphInteractionRuntimeNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  state: TNodeState;
  view: {
    zIndex?: number;
  };
  shellView: {
    portViews: LeaferGraphInteractionPortViewLike[];
  };
  hovered: boolean;
}

/**
 * 交互宿主对外只依赖这一层运行时壳面。
 */
export interface LeaferGraphInteractionRuntimeLike<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  getNodeView(nodeId: string): TNodeViewState | undefined;
  setNodeHovered(nodeId: string, hovered: boolean): void;
  focusNode(nodeId: string): boolean;
  syncNodeResizeHandleVisibility(nodeId: string): void;
  resolvePort(
    nodeId: string,
    direction: SlotDirection,
    slot: number
  ): LeaferGraphConnectionPortState | undefined;
  resolvePortAtPoint(
    point: { x: number; y: number },
    direction: SlotDirection
  ): LeaferGraphConnectionPortState | undefined;
  setConnectionSourcePort(
    port: LeaferGraphConnectionPortState | null
  ): void;
  setConnectionCandidatePort(
    port: LeaferGraphConnectionPortState | null
  ): void;
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void;
  clearConnectionPreview(): void;
  canCreateLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult;
  createLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): boolean;
  resolveDraggedNodeIds(nodeId: string): string[];
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void;
  resizeNode(nodeId: string, size: { width: number; height: number }): void;
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
  canResizeNode(nodeId: string): boolean;
  listSelectedNodeIds(): string[];
  isNodeSelected(nodeId: string): boolean;
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  clearSelectedNodes(): string[];
  resolveNodeAtPoint(point: { x: number; y: number }): string | undefined;
  resolveNodeIdsInBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): string[];
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  };
  getPagePointFromGraphEvent(event: LeaferGraphWidgetPointerEvent): {
    x: number;
    y: number;
  };
  resolveNodeSize(nodeId: string): { width: number; height: number } | undefined;
}

/**
 * 交互运行时 controller 初始化选项。
 */
export interface LeaferGraphInteractionRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  nodeViews: Map<string, TNodeViewState>;
  linkLayer: {
    add(child: Path): unknown;
  };
  bringNodeViewToFront(state: TNodeViewState): void;
  syncNodeResizeHandleVisibility(state: TNodeViewState): void;
  requestRender(): void;
  resolveDraggedNodeIds(nodeId: string): string[];
  listSelectedNodeIds(): string[];
  isNodeSelected(nodeId: string): boolean;
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[];
  clearSelectedNodes(): string[];
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "moveNodesByDelta" | "resizeNode" | "createLink" | "findLinksByNode"
  >;
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
  slotTypeFillMap: Readonly<Record<string, string>>;
  genericPortFill: string;
  resolveConnectionPreviewStrokeFallback(): string;
}

/**
 * 交互运行时子模块共享的最小 controller 上下文。
 */
export interface LeaferGraphInteractionRuntimeContext<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  readonly options: LeaferGraphInteractionRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;
  readonly previewPath: Path;
  getActiveSourcePortKey(): string | null;
  setActiveSourcePortKey(portKey: string | null): void;
  getActiveCandidatePortKey(): string | null;
  setActiveCandidatePortKey(portKey: string | null): void;
  togglePortHighlight(portKey: string | null, visible: boolean): void;
  findPortViewByKey(portKey: string): LeaferGraphInteractionPortViewLike | undefined;
  attachPreviewPathToLayer(): void;
  resolveNodeBounds(
    state: TNodeViewState
  ): { x: number; y: number; width: number; height: number } | undefined;
  resolveConnectionPreviewStroke(
    source: LeaferGraphConnectionPortState
  ): string;
}
