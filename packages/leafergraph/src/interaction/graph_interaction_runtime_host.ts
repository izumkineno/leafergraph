/**
 * 图交互运行时宿主模块。
 *
 * @remarks
 * 负责把拖拽、缩放、折叠和焦点相关能力收敛成交互层可消费的壳面。
 */

import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetPointerEvent } from "../widgets/widget_interaction";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";

/** 多选拖拽时记录的单个节点初始位置。 */
export interface GraphDragNodePosition {
  nodeId: string;
  startX: number;
  startY: number;
}

/** 交互运行时依赖的最小节点视图结构。 */
export interface LeaferGraphInteractionRuntimeNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  state: TNodeState;
  hovered: boolean;
}

/** 交互宿主对外只依赖这一层运行时壳面。 */
export interface LeaferGraphInteractionRuntimeLike<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  getNodeView(nodeId: string): TNodeViewState | undefined;
  setNodeHovered(nodeId: string, hovered: boolean): void;
  focusNode(nodeId: string): boolean;
  syncNodeResizeHandleVisibility(nodeId: string): void;
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
  resolveNodeSize(nodeId: string): { width: number; height: number } | undefined;
}

interface LeaferGraphInteractionRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> {
  nodeViews: Map<string, TNodeViewState>;
  bringNodeViewToFront(state: TNodeViewState): void;
  syncNodeResizeHandleVisibility(state: TNodeViewState): void;
  requestRender(): void;
  resolveDraggedNodeIds(nodeId: string): string[];
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "moveNodesByDelta" | "resizeNode"
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
}

/**
 * 交互运行时桥接宿主。
 * 当前专门负责把 interaction 需要的多类节点反馈与图变更入口收敛成单一壳面，
 * 避免 interaction 继续直接认识 view / shell / scene / mutation / runtime 多个宿主。
 */
export class LeaferGraphInteractionRuntimeHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> implements LeaferGraphInteractionRuntimeLike<TNodeState, TNodeViewState> {
  private readonly options: LeaferGraphInteractionRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;

  constructor(
    options: LeaferGraphInteractionRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /** 读取节点视图状态。 */
  getNodeView(nodeId: string): TNodeViewState | undefined {
    return this.options.nodeViews.get(nodeId);
  }

  /** 写回节点 hover 状态，并同步 resize 句柄显隐。 */
  setNodeHovered(nodeId: string, hovered: boolean): void {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    if (state.hovered !== hovered) {
      state.hovered = hovered;
    }

    this.options.syncNodeResizeHandleVisibility(state);
  }

  /** 让一个节点进入当前交互焦点。 */
  focusNode(nodeId: string): boolean {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return false;
    }

    this.options.bringNodeViewToFront(state);
    this.options.requestRender();
    return true;
  }

  /** 按当前节点状态同步 resize 句柄显隐。 */
  syncNodeResizeHandleVisibility(nodeId: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    this.options.syncNodeResizeHandleVisibility(state);
  }

  /** 解析一次拖拽应带上的节点集合。 */
  resolveDraggedNodeIds(nodeId: string): string[] {
    return this.options.resolveDraggedNodeIds(nodeId);
  }

  /** 按位移量批量移动节点。 */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    this.options.sceneRuntime.moveNodesByDelta(positions, deltaX, deltaY);
  }

  /** 调整单个节点尺寸。 */
  resizeNode(nodeId: string, size: { width: number; height: number }): void {
    this.options.sceneRuntime.resizeNode(nodeId, size);
  }

  /** 切换单个节点折叠态。 */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    return this.options.setNodeCollapsed(nodeId, collapsed);
  }

  /** 判断节点当前是否可 resize。 */
  canResizeNode(nodeId: string): boolean {
    return this.options.canResizeNode(nodeId);
  }

  /** 把浏览器 client 坐标换成 Leafer page 坐标。 */
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  } {
    return this.options.getPagePointByClient(event);
  }

  /** 把 Leafer 指针事件换成 page 坐标。 */
  getPagePointFromGraphEvent(
    event: LeaferGraphWidgetPointerEvent
  ): { x: number; y: number } {
    return this.options.getPagePointFromGraphEvent(event);
  }

  /** 读取节点当前可用于 resize 的尺寸。 */
  resolveNodeSize(
    nodeId: string
  ): { width: number; height: number } | undefined {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    return this.options.resolveNodeSize(state);
  }
}
