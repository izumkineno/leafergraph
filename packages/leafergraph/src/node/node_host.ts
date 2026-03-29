/**
 * 节点视图宿主模块。
 *
 * @remarks
 * 负责节点视图创建、刷新、销毁以及 Widget 图层挂载。
 */

import { Box, Group, Rect } from "leafer-ui";
import type { NodeRuntimeState } from "@leafergraph/node";
import {
  resolveNodeShellLayout,
  type NodeShellLayoutMetrics
} from "./node_layout";
import type { NodeShellView } from "./node_shell";
import type { LeaferGraphWidgetRenderInstance } from "@leafergraph/contracts";

type LeaferGraphNodeShellLayout = ReturnType<typeof resolveNodeShellLayout>;

/** 节点视图状态，负责把运行时节点和实际 Leafer 图元绑定在一起。 */
export interface NodeViewState<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  state: TNodeState;
  view: Group;
  card: Rect;
  selectedRing: Rect;
  widgetLayer: Box;
  resizeHandle: Box;
  shellView: NodeShellView;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
  hovered: boolean;
}

/**
 * 节点宿主依赖项。
 *
 * @remarks
 * 节点宿主只负责编排节点视图生命周期：
 * 怎么创建节点壳、怎么渲染 Widget、怎么登记节点视图状态，
 * 都通过这些回调和容器注入进来。
 */
interface LeaferGraphNodeHostOptions<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  nodeViews: Map<string, NodeViewState<TNodeState>>;
  nodeLayer: Group;
  layoutMetrics: NodeShellLayoutMetrics;
  buildNodeShell(
    node: TNodeState,
    shellLayout: LeaferGraphNodeShellLayout
  ): NodeShellView;
  isMissingNodeType(node: TNodeState): boolean;
  renderNodeWidgets(
    node: TNodeState,
    widgetLayer: Box,
    shellLayout: LeaferGraphNodeShellLayout
  ): Array<LeaferGraphWidgetRenderInstance | null>;
  destroyNodeWidgets(state: NodeViewState<TNodeState>): void;
  onNodeViewCreated?(state: NodeViewState<TNodeState>): void;
  onNodeMounted?(nodeId: string, state: NodeViewState<TNodeState>): void;
  onNodeRefreshed?(nodeId: string, state: NodeViewState<TNodeState>): void;
}

/**
 * 节点宿主装配器。
 * 当前只负责“节点 view 怎么创建、挂载、刷新、卸载”，
 * 不接管节点壳绘制、选中态样式和交互绑定本身。
 */
export class LeaferGraphNodeHost<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  private readonly options: LeaferGraphNodeHostOptions<TNodeState>;

  constructor(options: LeaferGraphNodeHostOptions<TNodeState>) {
    this.options = options;
  }

  /**
   * 将一个节点挂入节点层，并同步写入 view 状态映射。
   *
   * @param node - 待挂载节点。
   * @returns 对应的节点视图状态。
   */
  mountNodeView(node: TNodeState): NodeViewState<TNodeState> {
    const state = this.createNodeView(node);
    this.options.nodeViews.set(node.id, state);
    this.options.nodeLayer.add(state.view);
    this.options.onNodeMounted?.(node.id, state);
    return state;
  }

  /**
   * 卸载一个节点视图，同时安全销毁内部 widget 实例。
   *
   * @param nodeId - 待卸载节点 ID。
   * @returns 被移除的节点视图状态；节点不存在时返回 `undefined`。
   */
  unmountNodeView(nodeId: string): NodeViewState<TNodeState> | undefined {
    const state = this.options.nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    this.options.destroyNodeWidgets(state);
    state.view.remove();
    this.options.nodeViews.delete(nodeId);
    return state;
  }

  /**
   * 在同一个根 Group 内重建节点壳内容。
   * 这样可以保留 editor 绑定在节点根视图上的菜单、选区和拖拽监听，
   * 同时让端口、Widget 区和 resize 句柄按最新布局重新生成。
   *
   * @param state - 待刷新的节点视图状态。
   */
  refreshNodeView(state: NodeViewState<TNodeState>): void {
    const shellLayout = resolveNodeShellLayout(
      state.state,
      this.options.layoutMetrics
    );
    const nextShellView = this.options.buildNodeShell(state.state, shellLayout);
    const nextChildren = [...nextShellView.view.children];

    // 先销毁旧 Widget 生命周期，再整体替换节点根 Group 的子内容。
    this.options.destroyNodeWidgets(state);
    state.view.x = state.state.layout.x;
    state.view.y = state.state.layout.y;
    state.view.name = nextShellView.view.name;
    state.view.removeAll();
    state.view.add(nextChildren as unknown as Group[]);

    state.card = nextShellView.card;
    state.selectedRing = nextShellView.selectedRing;
    state.widgetLayer = nextShellView.widgetLayer;
    state.resizeHandle = nextShellView.resizeHandle;
    state.shellView = nextShellView;
    state.widgetInstances =
      !this.options.isMissingNodeType(state.state) && shellLayout.hasWidgets
        // 缺失节点类型时只显示占位壳，不继续渲染普通 Widget，避免误导为“控件仍然有效”。
        ? this.options.renderNodeWidgets(
            state.state,
            nextShellView.widgetLayer,
            shellLayout
          )
        : [];

    this.options.onNodeRefreshed?.(state.state.id, state);
  }

  /**
   * 根据节点运行时状态创建完整的 Leafer 节点视图。
   *
   * @param node - 待渲染节点。
   * @returns 与节点对应的完整视图状态。
   */
  private createNodeView(node: TNodeState): NodeViewState<TNodeState> {
    const shellLayout = resolveNodeShellLayout(node, this.options.layoutMetrics);
    const shellView = this.options.buildNodeShell(node, shellLayout);
    const widgetInstances =
      !this.options.isMissingNodeType(node) && shellLayout.hasWidgets
        ? this.options.renderNodeWidgets(node, shellView.widgetLayer, shellLayout)
        : [];

    const state: NodeViewState<TNodeState> = {
      state: node,
      view: shellView.view,
      card: shellView.card,
      selectedRing: shellView.selectedRing,
      resizeHandle: shellView.resizeHandle,
      shellView,
      widgetLayer: shellView.widgetLayer,
      widgetInstances,
      hovered: false
    };

    this.options.onNodeViewCreated?.(state);
    return state;
  }
}
