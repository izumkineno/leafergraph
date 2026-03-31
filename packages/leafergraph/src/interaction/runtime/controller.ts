/**
 * 图交互运行时 controller。
 *
 * @remarks
 * 负责持有运行时状态对象，并把具体能力委托给 `runtime/*` 子模块。
 */

import { Path } from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import type {
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphSelectionUpdateMode
} from "@leafergraph/contracts";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";
import {
  canLeaferGraphInteractionCreateLink,
  clearLeaferGraphInteractionConnectionPreview,
  createLeaferGraphInteractionLink,
  resolveLeaferGraphInteractionConnectionPreviewStroke,
  resolveLeaferGraphInteractionPort,
  resolveLeaferGraphInteractionPortAtPoint,
  restoreLeaferGraphInteractionConnectionPreviewLayer,
  setLeaferGraphInteractionConnectionCandidatePort,
  setLeaferGraphInteractionConnectionPreview,
  setLeaferGraphInteractionConnectionSourcePort
} from "./connection";
import type {
  GraphDragNodePosition,
  LeaferGraphInteractionPortViewLike,
  LeaferGraphInteractionRuntimeContext,
  LeaferGraphInteractionRuntimeHostOptions,
  LeaferGraphInteractionRuntimeLike,
  LeaferGraphInteractionRuntimeNodeViewState
} from "./types";
import {
  clearLeaferGraphInteractionSelectedNodes,
  isLeaferGraphInteractionNodeSelected,
  listLeaferGraphInteractionSelectedNodeIds,
  setLeaferGraphInteractionSelectedNodeIds
} from "./selection";
import {
  focusLeaferGraphInteractionNode,
  getLeaferGraphInteractionNodeView,
  resolveLeaferGraphInteractionNodeAtPoint,
  resolveLeaferGraphInteractionNodeIdsInBounds,
  setLeaferGraphInteractionNodeHovered,
  syncLeaferGraphInteractionNodeResizeHandleVisibility
} from "./node_views";
import {
  normalizeRectBounds
} from "./geometry";
import {
  canLeaferGraphInteractionResizeNode,
  getLeaferGraphInteractionPagePointByClient,
  getLeaferGraphInteractionPagePointFromGraphEvent,
  moveLeaferGraphInteractionNodesByDelta,
  resizeLeaferGraphInteractionNode,
  resolveLeaferGraphInteractionDraggedNodeIds,
  resolveLeaferGraphInteractionNodeSize,
  setLeaferGraphInteractionNodeCollapsed
} from "./mutations";

/**
 * 交互运行时桥接宿主。
 */
export class LeaferGraphInteractionRuntimeHostController<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
> implements LeaferGraphInteractionRuntimeLike<TNodeState, TNodeViewState> {
  protected readonly options: LeaferGraphInteractionRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;
  protected readonly previewPath: Path;
  protected activeSourcePortKey: string | null = null;
  protected activeCandidatePortKey: string | null = null;
  private readonly context: LeaferGraphInteractionRuntimeContext<
    TNodeState,
    TNodeViewState
  >;

  /**
   * 初始化交互运行时 controller。
   *
   * @param options - 交互运行时装配选项。
   * @returns 无返回值。
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
    this.context = {
      get options() {
        return options;
      },
      previewPath: this.previewPath,
      getActiveSourcePortKey: () => this.activeSourcePortKey,
      setActiveSourcePortKey: (portKey) => {
        this.activeSourcePortKey = portKey;
      },
      getActiveCandidatePortKey: () => this.activeCandidatePortKey,
      setActiveCandidatePortKey: (portKey) => {
        this.activeCandidatePortKey = portKey;
      },
      togglePortHighlight: (portKey, visible) =>
        this.togglePortHighlight(portKey, visible),
      findPortViewByKey: (portKey) => this.findPortViewByKey(portKey),
      attachPreviewPathToLayer: () => this.attachPreviewPathToLayer(),
      resolveNodeBounds: (state) => this.resolveNodeBounds(state),
      resolveConnectionPreviewStroke: (source) =>
        resolveLeaferGraphInteractionConnectionPreviewStroke(this.context, source)
    };
    this.attachPreviewPathToLayer();
  }

  /**
   * 在外部清空连线层后，把预览线图元重新挂回当前连线层。
   *
   * @returns 无返回值。
   */
  restoreConnectionPreviewLayer(): void {
    restoreLeaferGraphInteractionConnectionPreviewLayer(this.context);
  }

  /**
   * 读取节点视图状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点视图状态。
   */
  getNodeView(nodeId: string): TNodeViewState | undefined {
    return getLeaferGraphInteractionNodeView(this.context, nodeId);
  }

  /**
   * 写回节点 hover 状态，并同步 resize 句柄显隐。
   *
   * @param nodeId - 目标节点 ID。
   * @param hovered - 目标 hover 状态。
   * @returns 无返回值。
   */
  setNodeHovered(nodeId: string, hovered: boolean): void {
    setLeaferGraphInteractionNodeHovered(this.context, nodeId, hovered);
  }

  /**
   * 让一个节点进入当前交互焦点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 是否成功聚焦节点。
   */
  focusNode(nodeId: string): boolean {
    return focusLeaferGraphInteractionNode(this.context, nodeId);
  }

  /**
   * 按当前节点状态同步 resize 句柄显隐。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  syncNodeResizeHandleVisibility(nodeId: string): void {
    syncLeaferGraphInteractionNodeResizeHandleVisibility(this.context, nodeId);
  }

  /**
   * 按节点、方向和槽位解析一个端口的完整几何信息。
   *
   * @param nodeId - 目标节点 ID。
   * @param direction - 目标端口方向。
   * @param slot - 目标槽位。
   * @returns 解析到的端口状态。
   */
  resolvePort(
    nodeId: string,
    direction: LeaferGraphConnectionPortState["direction"],
    slot: number
  ): LeaferGraphConnectionPortState | undefined {
    return resolveLeaferGraphInteractionPort(this.context, nodeId, direction, slot);
  }

  /**
   * 在当前场景中根据 page 坐标命中一个端口。
   *
   * @param point - 需要命中的 page 坐标。
   * @param direction - 目标端口方向。
   * @returns 命中到的端口状态。
   */
  resolvePortAtPoint(
    point: { x: number; y: number },
    direction: LeaferGraphConnectionPortState["direction"]
  ): LeaferGraphConnectionPortState | undefined {
    return resolveLeaferGraphInteractionPortAtPoint(this.context, point, direction);
  }

  /**
   * 设置当前拖线起点端口高亮。
   *
   * @param port - 当前来源端口。
   * @returns 无返回值。
   */
  setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void {
    setLeaferGraphInteractionConnectionSourcePort(this.context, port);
  }

  /**
   * 设置当前拖线候选目标端口高亮。
   *
   * @param port - 当前候选端口。
   * @returns 无返回值。
   */
  setConnectionCandidatePort(port: LeaferGraphConnectionPortState | null): void {
    setLeaferGraphInteractionConnectionCandidatePort(this.context, port);
  }

  /**
   * 更新拖拽中的连接预览线。
   *
   * @param source - 当前来源端口。
   * @param pointer - 当前指针位置。
   * @param target - 当前候选目标端口。
   * @returns 无返回值。
   */
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void {
    setLeaferGraphInteractionConnectionPreview(this.context, source, pointer, target);
  }

  /**
   * 清理当前拖线预览线。
   *
   * @returns 无返回值。
   */
  clearConnectionPreview(): void {
    clearLeaferGraphInteractionConnectionPreview(this.context);
  }

  /**
   * 判断两个端口当前是否允许创建正式连线。
   *
   * @param source - 当前来源端口。
   * @param target - 当前目标端口。
   * @returns 端口连接校验结果。
   */
  canCreateLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult {
    return canLeaferGraphInteractionCreateLink(this.context, source, target);
  }

  /**
   * 从两个合法端口创建一条正式连线。
   *
   * @param source - 当前来源端口。
   * @param target - 当前目标端口。
   * @returns 是否成功创建正式连线。
   */
  createLink(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): boolean {
    return createLeaferGraphInteractionLink(this.context, source, target);
  }

  /**
   * 解析一次拖拽应带上的节点集合。
   *
   * @param nodeId - 拖拽锚点节点 ID。
   * @returns 本次拖拽应带上的节点 ID 列表。
   */
  resolveDraggedNodeIds(nodeId: string): string[] {
    return resolveLeaferGraphInteractionDraggedNodeIds(this.context, nodeId);
  }

  /**
   * 按位移量批量移动节点。
   *
   * @param positions - 节点起始位置信息。
   * @param deltaX - X 方向位移量。
   * @param deltaY - Y 方向位移量。
   * @returns 无返回值。
   */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    moveLeaferGraphInteractionNodesByDelta(this.context, positions, deltaX, deltaY);
  }

  /**
   * 调整单个节点尺寸。
   *
   * @param nodeId - 目标节点 ID。
   * @param size - 目标尺寸。
   * @returns 无返回值。
   */
  resizeNode(nodeId: string, size: { width: number; height: number }): void {
    resizeLeaferGraphInteractionNode(this.context, nodeId, size);
  }

  /**
   * 切换单个节点折叠态。
   *
   * @param nodeId - 目标节点 ID。
   * @param collapsed - 目标折叠状态。
   * @returns 是否成功切换折叠态。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    return setLeaferGraphInteractionNodeCollapsed(this.context, nodeId, collapsed);
  }

  /**
   * 判断节点当前是否可 resize。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否允许 resize。
   */
  canResizeNode(nodeId: string): boolean {
    return canLeaferGraphInteractionResizeNode(this.context, nodeId);
  }

  /**
   * 列出当前全部已选节点。
   *
   * @returns 当前选区中的节点 ID 列表。
   */
  listSelectedNodeIds(): string[] {
    return listLeaferGraphInteractionSelectedNodeIds(this.context);
  }

  /**
   * 判断单个节点当前是否处于选中态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否已被选中。
   */
  isNodeSelected(nodeId: string): boolean {
    return isLeaferGraphInteractionNodeSelected(this.context, nodeId);
  }

  /**
   * 批量更新当前节点选区。
   *
   * @param nodeIds - 需要写入的节点 ID 列表。
   * @param mode - 选区更新模式。
   * @returns 更新后的节点 ID 列表。
   */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[] {
    return setLeaferGraphInteractionSelectedNodeIds(this.context, nodeIds, mode);
  }

  /**
   * 清空当前节点选区。
   *
   * @returns 清空后的节点 ID 列表。
   */
  clearSelectedNodes(): string[] {
    return clearLeaferGraphInteractionSelectedNodes(this.context);
  }

  /**
   * 根据 page 坐标命中当前最上层节点。
   *
   * @param point - 需要命中的坐标点。
   * @returns 命中到的节点 ID。
   */
  resolveNodeAtPoint(point: { x: number; y: number }): string | undefined {
    return resolveLeaferGraphInteractionNodeAtPoint(this.context, point);
  }

  /**
   * 读取与给定矩形相交的全部节点 ID。
   *
   * @param bounds - 需要命中的矩形边界。
   * @returns 与边界相交的节点 ID 列表。
   */
  resolveNodeIdsInBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): string[] {
    return resolveLeaferGraphInteractionNodeIdsInBounds(this.context, bounds);
  }

  /**
   * 把浏览器 client 坐标换成 Leafer page 坐标。
   *
   * @param event - 浏览器指针事件坐标。
   * @returns 规范化后的 page 坐标。
   */
  getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  } {
    return getLeaferGraphInteractionPagePointByClient(this.context, event);
  }

  /**
   * 把 Leafer 指针事件换成 page 坐标。
   *
   * @param event - Leafer 指针事件。
   * @returns 规范化后的 page 坐标。
   */
  getPagePointFromGraphEvent(
    event: LeaferGraphWidgetPointerEvent
  ): { x: number; y: number } {
    return getLeaferGraphInteractionPagePointFromGraphEvent(this.context, event);
  }

  /**
   * 读取节点当前可用于 resize 的尺寸。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点可用于 resize 的尺寸。
   */
  resolveNodeSize(
    nodeId: string
  ): { width: number; height: number } | undefined {
    return resolveLeaferGraphInteractionNodeSize(this.context, nodeId);
  }

  /**
   * 按端口键切换当前高亮图元。
   *
   * @param portKey - 当前端口键值。
   * @param visible - 目标可见状态。
   * @returns 无返回值。
   */
  protected togglePortHighlight(portKey: string | null, visible: boolean): void {
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
   * 通过稳定端口键查找当前视图中的端口图元。
   *
   * @param portKey - 当前端口键值。
   * @returns 命中到的端口图元。
   */
  protected findPortViewByKey(
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
   * 把预览 Path 稳定挂回连线层。
   *
   * @returns 无返回值。
   */
  protected attachPreviewPathToLayer(): void {
    this.previewPath.remove();
    this.options.linkLayer.add(this.previewPath);
  }

  /**
   * 统一读取节点当前参与交互命中的矩形边界。
   *
   * @param state - 当前节点视图状态。
   * @returns 当前节点的命中矩形边界。
   */
  protected resolveNodeBounds(
    state: TNodeViewState
  ): { x: number; y: number; width: number; height: number } | undefined {
    const size = this.options.resolveNodeSize(state);
    if (!size) {
      return undefined;
    }

    return normalizeRectBounds({
      x: state.state.layout.x,
      y: state.state.layout.y,
      width: size.width,
      height: size.height
    });
  }
}
