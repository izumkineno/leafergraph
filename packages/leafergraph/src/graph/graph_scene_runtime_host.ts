/**
 * 图场景运行时宿主模块。
 *
 * @remarks
 * 负责把场景刷新、连线刷新与正式图变更收敛为统一运行时壳面。
 */

import type { LeaferGraphLinkData, NodeRuntimeState } from "@leafergraph/node";
import type { GraphDragNodePosition } from "../interaction/graph_interaction_runtime_host";
import type {
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "../api/graph_api_types";

type LeaferGraphSceneRuntimeNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> = {
  state: TNodeState;
};

/**
 * 场景运行时层依赖的场景桥接能力。
 *
 * @remarks
 * 这里聚焦的是“已经存在的节点/连线视图怎么被局部刷新”，
 * 不承担正式图状态创建和删除职责。
 */
interface LeaferGraphSceneRuntimeSceneHostLike<TNodeViewState> {
  refreshNodeView(state: TNodeViewState): void;
  updateConnectedLinks(nodeId: string): void;
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void;
  setNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    newValue: unknown
  ): void;
}

/**
 * 场景运行时层依赖的图变更能力。
 *
 * @remarks
 * 这部分能力全部来自图变更宿主，负责节点和连线的正式增删改移。
 * 运行时桥接层把它们与场景刷新能力合并后，对上层暴露成更平整的一组 API。
 */
interface LeaferGraphSceneRuntimeMutationHostLike<
  TNodeState extends NodeRuntimeState
> {
  findLinksByNode(nodeId: string): LeaferGraphLinkData[];
  getLink(linkId: string): LeaferGraphLinkData | undefined;
  createNode(input: LeaferGraphCreateNodeInput): TNodeState;
  removeNode(nodeId: string): boolean;
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined;
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined;
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined;
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData;
  removeLink(linkId: string): boolean;
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void;
}

/**
 * 场景运行时桥接宿主依赖项。
 *
 * @remarks
 * `graphNodes` 和 `nodeViews` 让运行时宿主能统一做“刷新全部节点/连线”这类批量动作，
 * 而不需要再让上层自己维护节点集合。
 */
interface LeaferGraphSceneRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneRuntimeNodeViewState<TNodeState>
> {
  graphNodes: Map<string, TNodeState>;
  nodeViews: Map<string, TNodeViewState>;
  sceneHost: LeaferGraphSceneRuntimeSceneHostLike<TNodeViewState>;
  mutationHost: LeaferGraphSceneRuntimeMutationHostLike<TNodeState>;
  requestRender(): void;
}

/**
 * 场景运行时桥接宿主。
 * 这一层把“局部场景刷新”和“正式图变更”合成一个统一壳面，
 * 让外围宿主不再分别依赖 `sceneHost` 和 `mutationHost` 两条链。
 */
export class LeaferGraphSceneRuntimeHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneRuntimeNodeViewState<TNodeState>
> {
  private readonly options: LeaferGraphSceneRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;

  constructor(
    options: LeaferGraphSceneRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /**
   * 刷新单个节点视图。
   *
   * @param state - 待刷新的节点视图状态。
   */
  refreshNodeView(state: TNodeViewState): void {
    this.options.sceneHost.refreshNodeView(state);
  }

  /**
   * 批量刷新当前场景里的全部节点视图。
   *
   * @remarks
   * 主要给主题切换、全局样式变更等“全量节点壳需要重新生成”的场景使用。
   */
  refreshAllNodeViews(): void {
    for (const state of this.options.nodeViews.values()) {
      this.options.sceneHost.refreshNodeView(state);
    }
  }

  /**
   * 刷新与单个节点相关的连线。
   *
   * @param nodeId - 目标节点 ID。
   */
  updateConnectedLinks(nodeId: string): void {
    this.options.sceneHost.updateConnectedLinks(nodeId);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   *
   * @param nodeIds - 参与刷新的节点 ID 列表。
   */
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    this.options.sceneHost.updateConnectedLinksForNodes(nodeIds);
  }

  /**
   * 刷新当前图里全部节点关联连线。
   *
   * @remarks
   * 当前直接以全部节点 ID 作为输入，让底层连线宿主自行去重和收敛。
   * 这样主题切换和全图恢复后都能复用同一条刷新路径。
   */
  refreshAllConnectedLinks(): void {
    this.options.sceneHost.updateConnectedLinksForNodes([
      ...this.options.graphNodes.keys()
    ]);
  }

  /**
   * 请求当前画布刷新一帧。
   *
   * @remarks
   * 这一层只负责把请求转发给画布宿主，不自行决定渲染策略。
   */
  requestRender(): void {
    this.options.requestRender();
  }

  /**
   * 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - Widget 索引。
   * @param newValue - 待写回的新值。
   */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    this.options.sceneHost.setNodeWidgetValue(nodeId, widgetIndex, newValue);
  }

  /**
   * 根据节点 ID 查询当前图中的所有关联连线。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 关联连线安全副本列表。
   */
  findLinksByNode(nodeId: string): LeaferGraphLinkData[] {
    return this.options.mutationHost.findLinksByNode(nodeId);
  }

  /**
   * 根据连线 ID 读取当前图中的正式连线快照。
   *
   * @param linkId - 目标连线 ID。
   * @returns 连线安全副本；未命中时返回 `undefined`。
   */
  getLink(linkId: string): LeaferGraphLinkData | undefined {
    return this.options.mutationHost.getLink(linkId);
  }

  /**
   * 创建一个新的节点实例并立即挂到主包场景中。
   *
   * @param input - 节点创建输入。
   * @returns 新创建的节点状态。
   */
  createNode(input: LeaferGraphCreateNodeInput): TNodeState {
    return this.options.mutationHost.createNode(input);
  }

  /**
   * 删除一个节点，并同步清理它的全部关联连线与视图。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 是否成功删除。
   */
  removeNode(nodeId: string): boolean {
    return this.options.mutationHost.removeNode(nodeId);
  }

  /**
   * 更新一个既有节点的静态内容与布局。
   *
   * @param nodeId - 目标节点 ID。
   * @param input - 待应用的节点补丁。
   * @returns 更新后的节点；节点不存在时返回 `undefined`。
   */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined {
    return this.options.mutationHost.updateNode(nodeId, input);
  }

  /**
   * 移动一个节点到新的图坐标。
   *
   * @param nodeId - 目标节点 ID。
   * @param position - 节点目标坐标。
   * @returns 更新后的节点；节点不存在时返回 `undefined`。
   */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined {
    return this.options.mutationHost.moveNode(nodeId, position);
  }

  /**
   * 调整一个节点的显式宽高。
   *
   * @param nodeId - 目标节点 ID。
   * @param size - 节点目标尺寸。
   * @returns 更新后的节点；节点不存在时返回 `undefined`。
   */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined {
    return this.options.mutationHost.resizeNode(nodeId, size);
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   *
   * @param input - 连线创建输入。
   * @returns 连线安全副本。
   */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
    return this.options.mutationHost.createLink(input);
  }

  /**
   * 删除一条既有连线。
   *
   * @param linkId - 目标连线 ID。
   * @returns 是否成功删除。
   */
  removeLink(linkId: string): boolean {
    return this.options.mutationHost.removeLink(linkId);
  }

  /**
   * 按位移量批量移动一组选中节点，并保留它们的相对布局。
   *
   * @param positions - 拖拽起点时的节点位置快照。
   * @param deltaX - 当前横向位移。
   * @param deltaY - 当前纵向位移。
   */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    this.options.mutationHost.moveNodesByDelta(positions, deltaX, deltaY);
  }
}
