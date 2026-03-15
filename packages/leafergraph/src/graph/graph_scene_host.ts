import type { LeaferGraphLinkData, NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetRenderInstance } from "../api/plugin";

type LeaferGraphSceneNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> = {
  state: TNodeState;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
};

interface LeaferGraphSceneNodeHostLike<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneNodeViewState<TNodeState>
> {
  mountNodeView(node: TNodeState): TNodeViewState;
  unmountNodeView(nodeId: string): TNodeViewState | undefined;
  refreshNodeView(state: TNodeViewState): void;
}

interface LeaferGraphSceneLinkHostLike<TLinkViewState> {
  mountLinkView(link: LeaferGraphLinkData): TLinkViewState | null;
  removeLink(linkId: string): boolean;
  updateConnectedLinks(nodeId: string): void;
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void;
}

interface LeaferGraphSceneWidgetHostLike<
  TNodeState extends NodeRuntimeState
> {
  updateNodeWidgetValue(
    node: TNodeState,
    widgetIndex: number,
    newValue: unknown,
    widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>
  ): boolean;
}

interface LeaferGraphSceneHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneNodeViewState<TNodeState>,
  TLinkViewState
> {
  nodeViews: Map<string, TNodeViewState>;
  nodeHost: LeaferGraphSceneNodeHostLike<TNodeState, TNodeViewState>;
  linkHost: LeaferGraphSceneLinkHostLike<TLinkViewState>;
  widgetHost: LeaferGraphSceneWidgetHostLike<TNodeState>;
}

/**
 * 场景桥接宿主。
 * 当前集中承接：
 * 1. 节点视图的挂载、卸载与局部刷新
 * 2. 连线视图的挂载、删除与局部刷新
 * 3. Widget 值写回的场景级入口
 */
export class LeaferGraphSceneHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneNodeViewState<TNodeState>,
  TLinkViewState
> {
  private readonly options: LeaferGraphSceneHostOptions<
    TNodeState,
    TNodeViewState,
    TLinkViewState
  >;

  constructor(
    options: LeaferGraphSceneHostOptions<TNodeState, TNodeViewState, TLinkViewState>
  ) {
    this.options = options;
  }

  /** 将节点状态挂入节点层，并建立拖拽与视图映射。 */
  mountNodeView(node: TNodeState): TNodeViewState {
    return this.options.nodeHost.mountNodeView(node);
  }

  /** 卸载一个节点视图，同时安全销毁内部 widget 实例。 */
  unmountNodeView(nodeId: string): TNodeViewState | undefined {
    return this.options.nodeHost.unmountNodeView(nodeId);
  }

  /** 在同一个根 Group 内重建节点壳内容。 */
  refreshNodeView(state: TNodeViewState): void {
    this.options.nodeHost.refreshNodeView(state);
  }

  /** 将连线状态和连线视图一起挂入当前图。 */
  mountLinkView(link: LeaferGraphLinkData): TLinkViewState | null {
    return this.options.linkHost.mountLinkView(link);
  }

  /** 移除一条连线的图状态和视图。 */
  removeLink(linkId: string): boolean {
    return this.options.linkHost.removeLink(linkId);
  }

  /** 只更新与某个节点相连的连线，避免全量重算。 */
  updateConnectedLinks(nodeId: string): void {
    this.options.linkHost.updateConnectedLinks(nodeId);
  }

  /** 批量刷新与一组节点相关的连线。 */
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    this.options.linkHost.updateConnectedLinksForNodes(nodeIds);
  }

  /** 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。 */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    this.options.widgetHost.updateNodeWidgetValue(
      state.state,
      widgetIndex,
      newValue,
      state.widgetInstances
    );
  }
}
