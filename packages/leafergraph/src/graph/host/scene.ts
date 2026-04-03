/**
 * 图场景宿主模块。
 *
 * @remarks
 * 负责节点视图、连线视图和 Widget 值写回的场景级桥接。
 */

import type { GraphLink, NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphWidgetRenderInstance } from "@leafergraph/contracts";

type LeaferGraphSceneNodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> = {
  state: TNodeState;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
};

/**
 * 场景桥接层依赖的节点宿主能力。
 *
 * @remarks
 * 这层只暴露“挂载、卸载、刷新”三个最小动作，
 * 让场景桥接宿主不需要了解节点壳、Widget 区或交互绑定的内部细节。
 */
interface LeaferGraphSceneNodeHostLike<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphSceneNodeViewState<TNodeState>
> {
  mountNodeView(node: TNodeState): TNodeViewState;
  unmountNodeView(nodeId: string): TNodeViewState | undefined;
  refreshNodeView(state: TNodeViewState): void;
}

/**
 * 场景桥接层依赖的连线宿主能力。
 *
 * @remarks
 * 节点和连线在主包内部由不同宿主维护，这里只关心连线能否被创建、移除和局部刷新。
 */
interface LeaferGraphSceneLinkHostLike<TLinkViewState> {
  mountLinkView(link: GraphLink): TLinkViewState | null;
  removeLink(linkId: string): boolean;
  updateConnectedLinks(nodeId: string): void;
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void;
}

/**
 * 场景桥接层依赖的 Widget 宿主能力。
 *
 * @remarks
 * Widget 值写回会先命中这里，再由 Widget 宿主决定如何更新运行时值和 renderer 实例。
 */
interface LeaferGraphSceneWidgetHostLike<
  TNodeState extends NodeRuntimeState
> {
  updateNodeWidgetValue(
    node: TNodeState,
    widgetIndex: number,
    newValue: unknown,
    widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>
  ): boolean;
  
  commitNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    commit: {
      newValue?: unknown;
      beforeValue: unknown;
      beforeWidgets: NodeRuntimeState["widgets"];
    }
  ): void;
}

/**
 * 场景桥接宿主依赖项。
 *
 * @remarks
 * 这一层本质上是对节点、连线、Widget 三个子宿主的薄封装，
 * 同时持有 `nodeViews` 映射，用来把 `nodeId` 快速解析回节点视图状态。
 */
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

  /**
   * 初始化 LeaferGraphSceneHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(
    options: LeaferGraphSceneHostOptions<TNodeState, TNodeViewState, TLinkViewState>
  ) {
    this.options = options;
  }

  /**
   * 将节点状态挂入节点层，并建立拖拽与视图映射。
   *
   * @param node - 待挂载的节点运行时状态。
   * @returns 对应的节点视图状态。
   */
  mountNodeView(node: TNodeState): TNodeViewState {
    return this.options.nodeHost.mountNodeView(node);
  }

  /**
   * 卸载一个节点视图，同时安全销毁内部 widget 实例。
   *
   * @param nodeId - 待卸载节点 ID。
   * @returns 被移除的节点视图状态；节点不存在时返回 `undefined`。
   */
  unmountNodeView(nodeId: string): TNodeViewState | undefined {
    return this.options.nodeHost.unmountNodeView(nodeId);
  }

  /**
   * 在同一个根 Group 内重建节点壳内容。
   *
   * @param state - 待刷新的节点视图状态。
   *
   * @returns 无返回值。
   */
  refreshNodeView(state: TNodeViewState): void {
    this.options.nodeHost.refreshNodeView(state);
  }

  /**
   * 将连线状态和连线视图一起挂入当前图。
   *
   * @param link - 待挂载的正式连线数据。
   * @returns 连线视图状态；若创建失败则返回 `null`。
   */
  mountLinkView(link: GraphLink): TLinkViewState | null {
    return this.options.linkHost.mountLinkView(link);
  }

  /**
   * 移除一条连线的图状态和视图。
   *
   * @param linkId - 目标连线 ID。
   * @returns 是否成功移除。
   */
  removeLink(linkId: string): boolean {
    return this.options.linkHost.removeLink(linkId);
  }

  /**
   * 只更新与某个节点相连的连线，避免全量重算。
   *
   * @param nodeId - 连线刷新要围绕的节点 ID。
   *
   * @returns 无返回值。
   */
  updateConnectedLinks(nodeId: string): void {
    this.options.linkHost.updateConnectedLinks(nodeId);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   *
   * @param nodeIds - 参与刷新的一组节点 ID。
   *
   * @returns 无返回值。
   */
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    this.options.linkHost.updateConnectedLinksForNodes(nodeIds);
  }

  /**
   * 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。
   *
   * @remarks
   * 这条路径只负责把 `nodeId` 解析成节点视图状态，
   * 真正的值回写和 renderer.update 调度仍交给 Widget 宿主完成。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - 节点内部 Widget 索引。
   * @param newValue - 待写回的新值。
   *
   * @returns 对应的判断结果。
   */
  setNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    newValue: unknown
  ): boolean {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return false;
    }

    return this.options.widgetHost.updateNodeWidgetValue(
      state.state,
      widgetIndex,
      newValue,
      state.widgetInstances
    );
  }

  /**
   * 提交 widget 值变更，触发交互提交事件。
   *
   * @remarks
   * 这条路径用于 widget 完成编辑后提交最终值，
   * 会触发 `node.widget.commit` 交互提交事件，
   * 由外部订阅者处理（如 runtime-bridge 提交到服务器）。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - 节点内部 Widget 索引。
   * @param commit - 提交信息，包含变更前后的值。
   *
   * @returns 无返回值。
   */
  commitNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    commit: {
      newValue?: unknown;
      beforeValue: unknown;
      beforeWidgets: NodeRuntimeState["widgets"];
    }
  ): void {
    this.options.widgetHost.commitNodeWidgetValue(nodeId, widgetIndex, commit);
  }

  /**
   * 重命名节点标题。
   *
   * @param nodeId - 目标节点 ID。
   * @param newTitle - 新标题文本。
   *
   * @returns 无返回值。
   */
  renameNode(nodeId: string, newTitle: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    state.state.title = newTitle;
    this.options.nodeHost.refreshNodeView(state);
  }
}
