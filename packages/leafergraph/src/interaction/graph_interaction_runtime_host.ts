/**
 * 图交互运行时宿主模块。
 *
 * @remarks
 * 负责把拖拽、缩放、折叠、端口命中和连接预览相关能力
 * 收敛成交互层可消费的壳面。
 */

import { Path } from "leafer-ui";
import type { NodeRuntimeState, SlotDirection, SlotType } from "@leafergraph/node";
import type {
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";
import {
  PORT_DIRECTION_LEFT,
  PORT_DIRECTION_RIGHT,
  buildLinkPath
} from "../link/link";
import { resolveNodePortHitAreaBounds } from "../node/node_port";
import {
  normalizeComparableSlotTypes,
  resolveNodeSlotFill
} from "../node/node_slot_style";

/** 多选拖拽时记录的单个节点初始位置。 */
export interface GraphDragNodePosition {
  nodeId: string;
  startX: number;
  startY: number;
}

interface LeaferGraphInteractionPortViewLike {
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

/** 交互运行时依赖的最小节点视图结构。 */
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

/** 交互宿主对外只依赖这一层运行时壳面。 */
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

interface LeaferGraphInteractionRuntimeHostOptions<
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
  private readonly previewPath: Path;
  private activeSourcePortKey: string | null = null;
  private activeCandidatePortKey: string | null = null;

  /**
   * 初始化 LeaferGraphInteractionRuntimeHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(
    options: LeaferGraphInteractionRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
    this.previewPath = new Path({
      name: "graph-connection-preview",
      path: "",
      stroke: this.options.resolveConnectionPreviewStrokeFallback(),
      strokeWidth: 3,
      strokeCap: "round",
      strokeJoin: "round",
      fill: "transparent",
      opacity: 0.92,
      visible: false,
      hittable: false,
      zIndex: 999999
    });
    this.attachPreviewPathToLayer();
  }

  /**
   * 在外部清空连线层后，把预览线图元重新挂回当前连线层。
   *
   * @remarks
   * 启动恢复和整图重建都会清空 `linkLayer`，
   * 如果不把这条预览 Path 补回去，后续拖线与重连会话就只剩端口高亮，没有任何预览线。
   *
   * @returns 无返回值。
   */
  restoreConnectionPreviewLayer(): void {
    this.attachPreviewPathToLayer();
  }

  /**
   *  读取节点视图状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
   */
  getNodeView(nodeId: string): TNodeViewState | undefined {
    return this.options.nodeViews.get(nodeId);
  }

  /**
   *  写回节点 hover 状态，并同步 resize 句柄显隐。
   *
   * @param nodeId - 目标节点 ID。
   * @param hovered - `hovered`。
   * @returns 无返回值。
   */
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

  /**
   *  让一个节点进入当前交互焦点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 对应的判断结果。
   */
  focusNode(nodeId: string): boolean {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return false;
    }

    this.options.bringNodeViewToFront(state);
    this.options.requestRender();
    return true;
  }

  /**
   *  按当前节点状态同步 resize 句柄显隐。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  syncNodeResizeHandleVisibility(nodeId: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    this.options.syncNodeResizeHandleVisibility(state);
  }

  /**
   *  按节点、方向和槽位解析一个端口的完整几何信息。
   *
   * @param nodeId - 目标节点 ID。
   * @param direction - `direction`。
   * @param slot - 槽位。
   * @returns 处理后的结果。
   */
  resolvePort(
    nodeId: string,
    direction: SlotDirection,
    slot: number
  ): LeaferGraphConnectionPortState | undefined {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    const portView = state.shellView.portViews.find(
      (item) =>
        item.layout.direction === direction &&
        item.layout.index === normalizeSlotIndex(slot)
    );
    if (!portView) {
      return undefined;
    }

    return createConnectionPortState(state, portView);
  }

  /**
   *  在当前场景中根据 page 坐标命中一个端口。
   *
   * @param point - 坐标。
   * @param direction - `direction`。
   * @returns 处理后的结果。
   */
  resolvePortAtPoint(
    point: { x: number; y: number },
    direction: SlotDirection
  ): LeaferGraphConnectionPortState | undefined {
    // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
    let bestMatch:
      | {
          port: LeaferGraphConnectionPortState;
          zIndex: number;
          distance: number;
        }
      | undefined;

    for (const state of this.options.nodeViews.values()) {
      for (const portView of state.shellView.portViews) {
        if (portView.layout.direction !== direction) {
          continue;
        }

        const port = createConnectionPortState(state, portView);
        if (!isPointInBounds(point, port.hitBounds)) {
          // 再按当前规则组合结果，并把派生数据一并收口到输出里。
          continue;
        }

        const rawZIndex = state.view.zIndex;
        const zIndex =
          typeof rawZIndex === "number" && Number.isFinite(rawZIndex)
            ? rawZIndex
            : 0;
        const distance = Math.hypot(
          point.x - port.center.x,
          point.y - port.center.y
        );

        if (
          !bestMatch ||
          zIndex > bestMatch.zIndex ||
          (zIndex === bestMatch.zIndex && distance < bestMatch.distance)
        ) {
          bestMatch = {
            port,
            zIndex,
            distance
          };
        }
      }
    }

    return bestMatch?.port;
  }

  /**
   *  设置当前拖线起点端口高亮。
   *
   * @param port - `port`。
   * @returns 无返回值。
   */
  setConnectionSourcePort(
    port: LeaferGraphConnectionPortState | null
  ): void {
    const nextKey = port ? getPortKey(port) : null;
    if (this.activeSourcePortKey === nextKey) {
      return;
    }

    this.togglePortHighlight(this.activeSourcePortKey, false);
    this.activeSourcePortKey = nextKey;
    this.togglePortHighlight(this.activeSourcePortKey, true);
    this.options.requestRender();
  }

  /**
   *  设置当前拖线候选目标端口高亮。
   *
   * @param port - `port`。
   * @returns 无返回值。
   */
  setConnectionCandidatePort(
    port: LeaferGraphConnectionPortState | null
  ): void {
    const nextKey = port ? getPortKey(port) : null;
    if (this.activeCandidatePortKey === nextKey) {
      return;
    }

    this.togglePortHighlight(this.activeCandidatePortKey, false);
    this.activeCandidatePortKey = nextKey;
    this.togglePortHighlight(this.activeCandidatePortKey, true);
    this.options.requestRender();
  }

  /**
   *  更新拖拽中的连接预览线。
   *
   * @param source - 当前来源对象。
   * @param pointer - 指针。
   * @param target - 当前目标对象。
   * @returns 无返回值。
   */
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void {
    const startDirection =
      source.direction === "input"
        ? PORT_DIRECTION_LEFT
        : PORT_DIRECTION_RIGHT;
    const endPoint = target?.center ?? pointer;
    const endDirection =
      target
        ? target.direction === "input"
          ? PORT_DIRECTION_LEFT
          : PORT_DIRECTION_RIGHT
        : endPoint.x >= source.center.x
          ? PORT_DIRECTION_LEFT
          : PORT_DIRECTION_RIGHT;

    this.previewPath.stroke = this.resolveConnectionPreviewStroke(source);
    this.previewPath.path = buildLinkPath(
      [source.center.x, source.center.y],
      [endPoint.x, endPoint.y],
      startDirection,
      endDirection
    );
    this.previewPath.visible = true;
    this.options.requestRender();
  }

  /**
   *  清理当前拖线预览线。
   *
   * @returns 无返回值。
   */
  clearConnectionPreview(): void {
    if (!this.previewPath.visible && !this.previewPath.path) {
      return;
    }

    this.previewPath.path = "";
    this.previewPath.visible = false;
    this.options.requestRender();
  }

  /**
   *  判断两个端口当前是否允许创建正式连线。
   *
   * @param source - 当前来源对象。
   * @param target - 当前目标对象。
   * @returns 对应的判断结果。
   */
  canCreateLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult {
    // 先整理当前阶段需要的输入、状态与依赖。
    if (source.direction !== "output") {
      return {
        valid: false,
        reason: "当前只允许从输出端口开始连线"
      };
    }

    if (target.direction !== "input") {
      return {
        valid: false,
        reason: "连线目标必须是输入端口"
      };
    }

    const resolvedSource = this.resolvePort(
      source.nodeId,
      source.direction,
      source.slot
    );
    if (!resolvedSource) {
      return {
        valid: false,
        reason: "未找到连线起点端口"
      };
    }

    const resolvedTarget = this.resolvePort(
      target.nodeId,
      target.direction,
      target.slot
    );
    // 再执行核心逻辑，并把结果或副作用统一收口。
    if (!resolvedTarget) {
      return {
        valid: false,
        reason: "未找到连线目标端口"
      };
    }

    if (!areSlotTypesCompatible(resolvedSource.slotType, resolvedTarget.slotType)) {
      return {
        valid: false,
        reason: "端口类型不兼容"
      };
    }

    const existingLinks = this.options.sceneRuntime.findLinksByNode(source.nodeId);
    if (
      existingLinks.some(
        (link) =>
          link.source.nodeId === source.nodeId &&
          normalizeSlotIndex(link.source.slot) === source.slot &&
          link.target.nodeId === target.nodeId &&
          normalizeSlotIndex(link.target.slot) === target.slot
      )
    ) {
      return {
        valid: false,
        reason: "相同连线已存在"
      };
    }

    return { valid: true };
  }

  /**
   *  从两个合法端口创建一条正式连线。
   *
   * @param source - 当前来源对象。
   * @param target - 当前目标对象。
   * @returns 对应的判断结果。
   */
  createLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): boolean {
    const validation = this.canCreateLink(source, target);
    if (!validation.valid) {
      if (validation.reason) {
        console.warn(`[leafergraph] ${validation.reason}`, {
          source,
          target
        });
      }
      return false;
    }

    try {
      this.options.sceneRuntime.createLink({
        source: {
          nodeId: source.nodeId,
          slot: source.slot
        },
        target: {
          nodeId: target.nodeId,
          slot: target.slot
        }
      });
      return true;
    } catch (error) {
      console.error("[leafergraph] 创建连线失败", {
        source,
        target
      }, error);
      return false;
    }
  }

  /**
   *  解析一次拖拽应带上的节点集合。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
   */
  resolveDraggedNodeIds(nodeId: string): string[] {
    return this.options.resolveDraggedNodeIds(nodeId);
  }

  /**
   *  按位移量批量移动节点。
   *
   * @param positions - 位置。
   * @param deltaX - `delta` X。
   * @param deltaY - `delta` Y。
   * @returns 无返回值。
   */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    this.options.sceneRuntime.moveNodesByDelta(positions, deltaX, deltaY);
  }

  /**
   *  调整单个节点尺寸。
   *
   * @param nodeId - 目标节点 ID。
   * @param size - `size`。
   * @returns 无返回值。
   */
  resizeNode(nodeId: string, size: { width: number; height: number }): void {
    this.options.sceneRuntime.resizeNode(nodeId, size);
  }

  /**
   *  切换单个节点折叠态。
   *
   * @param nodeId - 目标节点 ID。
   * @param collapsed - `collapsed`。
   * @returns 对应的判断结果。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    return this.options.setNodeCollapsed(nodeId, collapsed);
  }

  /**
   *  判断节点当前是否可 resize。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 对应的判断结果。
   */
  canResizeNode(nodeId: string): boolean {
    return this.options.canResizeNode(nodeId);
  }

  /**
   *  列出当前全部已选节点。
   *
   * @returns 收集到的结果列表。
   */
  listSelectedNodeIds(): string[] {
    return this.options.listSelectedNodeIds();
  }

  /**
   *  判断单个节点当前是否处于选中态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 对应的判断结果。
   */
  isNodeSelected(nodeId: string): boolean {
    return this.options.isNodeSelected(nodeId);
  }

  /**
   *  批量更新当前节点选区。
   *
   * @param nodeIds - 节点 ID 列表。
   * @param mode - 模式。
   * @returns 设置`Selected` 节点 ID 列表的结果。
   */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[] {
    return this.options.setSelectedNodeIds(nodeIds, mode);
  }

  /**
   *  清空当前节点选区。
   *
   * @returns 清理`Selected` 节点的结果。
   */
  clearSelectedNodes(): string[] {
    return this.options.clearSelectedNodes();
  }

  /**
   *  根据 page 坐标命中当前最上层节点。
   *
   * @param point - 坐标。
   * @returns 处理后的结果。
   */
  resolveNodeAtPoint(point: { x: number; y: number }): string | undefined {
    let bestMatch:
      | {
          nodeId: string;
          zIndex: number;
        }
      | undefined;

    for (const state of this.options.nodeViews.values()) {
      const bounds = this.resolveNodeBounds(state);
      if (!bounds || !isPointInBounds(point, bounds)) {
        continue;
      }

      const rawZIndex = state.view.zIndex;
      const zIndex =
        typeof rawZIndex === "number" && Number.isFinite(rawZIndex)
          ? rawZIndex
          : 0;

      if (!bestMatch || zIndex >= bestMatch.zIndex) {
        bestMatch = {
          nodeId: state.state.id,
          zIndex
        };
      }
    }

    return bestMatch?.nodeId;
  }

  /**
   *  读取与给定矩形相交的全部节点 ID。
   *
   * @param bounds - `bounds`。
   * @returns 处理后的结果。
   */
  resolveNodeIdsInBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): string[] {
    const normalizedBounds = normalizeRectBounds(bounds);
    const nodeIds: string[] = [];

    for (const state of this.options.nodeViews.values()) {
      const nodeBounds = this.resolveNodeBounds(state);
      if (!nodeBounds || !doBoundsIntersect(nodeBounds, normalizedBounds)) {
        continue;
      }

      nodeIds.push(state.state.id);
    }

    return nodeIds;
  }

  /**
   *  把浏览器 client 坐标换成 Leafer page 坐标。
   *
   * @param event - 当前事件对象。
   * @returns 处理后的结果。
   */
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  } {
    return this.options.getPagePointByClient(event);
  }

  /**
   *  把 Leafer 指针事件换成 page 坐标。
   *
   * @param event - 当前事件对象。
   * @returns 处理后的结果。
   */
  getPagePointFromGraphEvent(
    event: LeaferGraphWidgetPointerEvent
  ): { x: number; y: number } {
    return this.options.getPagePointFromGraphEvent(event);
  }

  /**
   *  读取节点当前可用于 resize 的尺寸。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
   */
  resolveNodeSize(
    nodeId: string
  ): { width: number; height: number } | undefined {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    return this.options.resolveNodeSize(state);
  }

  /**
   *  按端口键切换当前高亮图元。
   *
   * @param portKey - `port` 键值。
   * @param visible - 可见状态。
   * @returns 无返回值。
   */
  private togglePortHighlight(portKey: string | null, visible: boolean): void {
    if (!portKey) {
      return;
    }

    const portView = this.findPortViewByKey(portKey);
    if (!portView) {
      return;
    }

    portView.highlight.visible = visible;
    portView.highlight.opacity = visible ? 1 : 0;
  }

  /**
   *  通过稳定端口键查找当前视图中的端口图元。
   *
   * @param portKey - `port` 键值。
   * @returns 处理后的结果。
   */
  private findPortViewByKey(
    portKey: string
  ): LeaferGraphInteractionPortViewLike | undefined {
    const [nodeId, direction, slotText] = portKey.split(":");
    if (!nodeId || !direction || !slotText) {
      return undefined;
    }

    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    return state.shellView.portViews.find(
      (item) =>
        item.layout.direction === direction &&
        item.layout.index === Number(slotText)
    );
  }

  /**
   *  把预览 Path 稳定挂回连线层，避免整图恢复后丢失。
   *
   * @returns 无返回值。
   */
  private attachPreviewPathToLayer(): void {
    this.previewPath.remove();
    this.options.linkLayer.add(this.previewPath);
  }

  /**
   *  统一读取节点当前参与交互命中的矩形边界。
   *
   * @param state - 当前状态。
   * @returns 处理后的结果。
   */
  private resolveNodeBounds(
    state: TNodeViewState
  ): { x: number; y: number; width: number; height: number } | undefined {
    const size = this.options.resolveNodeSize(state);
    if (!size) {
      return undefined;
    }

    return {
      x: state.state.layout.x,
      y: state.state.layout.y,
      width: size.width,
      height: size.height
    };
  }

  /**
   *  拖线预览统一跟随当前起始端口的最终展示色。
   *
   * @param source - 当前来源对象。
   * @returns 处理后的结果。
   */
  private resolveConnectionPreviewStroke(
    source: LeaferGraphConnectionPortState
  ): string {
    const node = this.options.nodeViews.get(source.nodeId)?.state;
    if (!node) {
      return this.options.resolveConnectionPreviewStrokeFallback();
    }

    return (
      resolveNodeSlotFill(node, source.direction, source.slot, {
        slotTypeFillMap: this.options.slotTypeFillMap,
        genericFill: this.options.genericPortFill
      }) ?? this.options.resolveConnectionPreviewStrokeFallback()
    );
  }
}

/**
 * 创建连接`Port` 状态。
 *
 * @param state - 当前状态。
 * @param portView - `port` 视图。
 * @returns 创建后的结果对象。
 */
function createConnectionPortState<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  state: TNodeViewState,
  portView: LeaferGraphInteractionPortViewLike
): LeaferGraphConnectionPortState {
  const fallbackHitBounds = resolveNodePortHitAreaBounds(portView.layout);
  const hitX =
    state.state.layout.x +
    coerceFiniteNumber(portView.hitArea.x, fallbackHitBounds.x);
  const hitY =
    state.state.layout.y +
    coerceFiniteNumber(portView.hitArea.y, fallbackHitBounds.y);
  const hitWidth = coerceFiniteNumber(portView.hitArea.width, fallbackHitBounds.width);
  const hitHeight = coerceFiniteNumber(
    portView.hitArea.height,
    fallbackHitBounds.height
  );

  return {
    nodeId: state.state.id,
    direction: portView.layout.direction,
    slot: normalizeSlotIndex(portView.layout.index),
    center: {
      x:
        state.state.layout.x +
        portView.layout.portX +
        portView.layout.portWidth / 2,
      y:
        state.state.layout.y +
        portView.layout.portY +
        portView.layout.portHeight / 2
    },
    hitBounds: {
      x: hitX,
      y: hitY,
      width: hitWidth,
      height: hitHeight
    },
    slotType: portView.layout.slotType
  };
}

/**
 * 规范化槽位`Index`。
 *
 * @param slot - 槽位。
 * @returns 处理后的结果。
 */
function normalizeSlotIndex(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

/**
 * 获取`Port` 键值。
 *
 * @param port - `port`。
 * @returns 处理后的结果。
 */
function getPortKey(port: Pick<LeaferGraphConnectionPortState, "nodeId" | "direction" | "slot">): string {
  return `${port.nodeId}:${port.direction}:${normalizeSlotIndex(port.slot)}`;
}

/**
 * 处理 `isPointInBounds` 相关逻辑。
 *
 * @param point - 坐标。
 * @param bounds - `bounds`。
 * @returns 对应的判断结果。
 */
function isPointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * 处理 `normalizeRectBounds` 相关逻辑。
 *
 * @param bounds - `bounds`。
 * @returns 处理后的结果。
 */
function normalizeRectBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const nextX = bounds.width >= 0 ? bounds.x : bounds.x + bounds.width;
  const nextY = bounds.height >= 0 ? bounds.y : bounds.y + bounds.height;

  return {
    x: nextX,
    y: nextY,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height)
  };
}

/**
 * 处理 `doBoundsIntersect` 相关逻辑。
 *
 * @param left - `left`。
 * @param right - `right`。
 * @returns 对应的判断结果。
 */
function doBoundsIntersect(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  );
}

/**
 * 处理 `coerceFiniteNumber` 相关逻辑。
 *
 * @param value - 当前值。
 * @param fallback - 回退。
 * @returns 处理后的结果。
 */
function coerceFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * 处理 `areSlotTypesCompatible` 相关逻辑。
 *
 * @param sourceType - 来源类型。
 * @param targetType - 目标类型。
 * @returns 对应的判断结果。
 */
function areSlotTypesCompatible(
  sourceType: SlotType | undefined,
  targetType: SlotType | undefined
): boolean {
  if (
    sourceType === undefined ||
    sourceType === 0 ||
    targetType === undefined ||
    targetType === 0
  ) {
    return true;
  }

  const sourceTypes = normalizeComparableSlotTypes(sourceType);
  const targetTypes = normalizeComparableSlotTypes(targetType);

  if (!sourceTypes.length || !targetTypes.length) {
    return true;
  }

  if (
    sourceTypes.includes("*") ||
    targetTypes.includes("*")
  ) {
    return true;
  }

  return sourceTypes.some((type) => targetTypes.includes(type));
}
