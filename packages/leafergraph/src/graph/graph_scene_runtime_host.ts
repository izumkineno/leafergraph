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

interface LeaferGraphSceneRuntimeMutationHostLike<
  TNodeState extends NodeRuntimeState
> {
  findLinksByNode(nodeId: string): LeaferGraphLinkData[];
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

  /** 刷新单个节点视图。 */
  refreshNodeView(state: TNodeViewState): void {
    this.options.sceneHost.refreshNodeView(state);
  }

  /** 批量刷新当前场景里的全部节点视图。 */
  refreshAllNodeViews(): void {
    for (const state of this.options.nodeViews.values()) {
      this.options.sceneHost.refreshNodeView(state);
    }
  }

  /** 刷新与单个节点相关的连线。 */
  updateConnectedLinks(nodeId: string): void {
    this.options.sceneHost.updateConnectedLinks(nodeId);
  }

  /** 批量刷新与一组节点相关的连线。 */
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    this.options.sceneHost.updateConnectedLinksForNodes(nodeIds);
  }

  /** 刷新当前图里全部节点关联连线。 */
  refreshAllConnectedLinks(): void {
    this.options.sceneHost.updateConnectedLinksForNodes([
      ...this.options.graphNodes.keys()
    ]);
  }

  /** 请求当前画布刷新一帧。 */
  requestRender(): void {
    this.options.requestRender();
  }

  /** 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。 */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    this.options.sceneHost.setNodeWidgetValue(nodeId, widgetIndex, newValue);
  }

  /** 根据节点 ID 查询当前图中的所有关联连线。 */
  findLinksByNode(nodeId: string): LeaferGraphLinkData[] {
    return this.options.mutationHost.findLinksByNode(nodeId);
  }

  /** 创建一个新的节点实例并立即挂到主包场景中。 */
  createNode(input: LeaferGraphCreateNodeInput): TNodeState {
    return this.options.mutationHost.createNode(input);
  }

  /** 删除一个节点，并同步清理它的全部关联连线与视图。 */
  removeNode(nodeId: string): boolean {
    return this.options.mutationHost.removeNode(nodeId);
  }

  /** 更新一个既有节点的静态内容与布局。 */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined {
    return this.options.mutationHost.updateNode(nodeId, input);
  }

  /** 移动一个节点到新的图坐标。 */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined {
    return this.options.mutationHost.moveNode(nodeId, position);
  }

  /** 调整一个节点的显式宽高。 */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined {
    return this.options.mutationHost.resizeNode(nodeId, size);
  }

  /** 创建一条正式连线并加入当前图状态。 */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
    return this.options.mutationHost.createLink(input);
  }

  /** 删除一条既有连线。 */
  removeLink(linkId: string): boolean {
    return this.options.mutationHost.removeLink(linkId);
  }

  /** 按位移量批量移动一组选中节点，并保留它们的相对布局。 */
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    this.options.mutationHost.moveNodesByDelta(positions, deltaX, deltaY);
  }
}
