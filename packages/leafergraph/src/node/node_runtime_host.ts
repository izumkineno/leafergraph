import {
  createNodeApi,
  serializeNode,
  type NodeRegistry,
  type NodeSerializeResult
} from "@leafergraph/node";
import type { LeaferGraphNodeResizeConstraint } from "../api/graph_api_types";
import type { LeaferGraphRenderableNodeState } from "../graph/graph_runtime_types";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";
import type { LeaferGraphWidgetRegistry } from "../widgets/widget_registry";

type LeaferGraphRuntimeNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  state: TNodeState;
};

interface LeaferGraphNodeRuntimeHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  graphNodes: Map<string, TNodeState>;
  nodeViews: Map<string, TNodeViewState>;
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "refreshNodeView" | "updateConnectedLinks" | "resizeNode" | "requestRender"
  >;
  resolveNodeResizeConstraint(node: TNodeState): LeaferGraphNodeResizeConstraint;
}

/**
 * 节点运行时宿主。
 * 当前集中收口：
 * 1. 节点快照序列化
 * 2. 折叠态写回与视图刷新
 * 3. resize 约束与恢复默认尺寸
 * 4. Widget 动作回抛到节点生命周期
 */
export class LeaferGraphNodeRuntimeHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  private readonly options: LeaferGraphNodeRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;

  constructor(
    options: LeaferGraphNodeRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /** 读取一个正式可序列化节点快照。 */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return serializeNode(this.options.nodeRegistry, node);
  }

  /**
   * 设置单个节点的折叠态。
   * 折叠后同步刷新节点壳与关联连线，避免端口锚点和可视高度失配。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    const node = this.options.graphNodes.get(nodeId);
    const state = this.options.nodeViews.get(nodeId);
    if (!node || !state) {
      return false;
    }

    const nextCollapsed = Boolean(collapsed);
    if (Boolean(node.flags.collapsed) === nextCollapsed) {
      return true;
    }

    node.flags.collapsed = nextCollapsed;
    this.options.sceneRuntime.refreshNodeView(state);
    this.options.sceneRuntime.updateConnectedLinks(nodeId);
    this.options.sceneRuntime.requestRender();
    return true;
  }

  /** 读取某个节点的正式 resize 约束。 */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return this.options.resolveNodeResizeConstraint(node);
  }

  /** 判断某个节点当前是否允许显示并响应 resize 交互。 */
  canResizeNode(nodeId: string): boolean {
    return Boolean(this.getNodeResizeConstraint(nodeId)?.enabled);
  }

  /**
   * 把节点尺寸恢复到定义默认值。
   * 如果定义没有显式提供默认尺寸，则回退到主包默认约束。
   */
  resetNodeSize(nodeId: string): TNodeState | undefined {
    const constraint = this.getNodeResizeConstraint(nodeId);
    if (!constraint?.enabled) {
      return undefined;
    }

    return this.options.sceneRuntime.resizeNode(nodeId, {
      width: constraint.defaultWidth,
      height: constraint.defaultHeight
    });
  }

  /**
   * 把 Widget 触发的动作转回节点生命周期 `onAction(...)`。
   * 当前先提供最小桥接能力，便于自定义 Widget 把业务语义交回节点定义处理。
   */
  emitNodeWidgetAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): boolean {
    const safeAction = action.trim();
    if (!safeAction) {
      return false;
    }

    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return false;
    }

    const definition = this.options.nodeRegistry.getNode(node.type);
    if (!definition?.onAction) {
      return false;
    }

    definition.onAction(
      node,
      safeAction,
      param,
      options,
      createNodeApi(node, {
        definition,
        widgetDefinitions: this.options.widgetRegistry
      })
    );
    this.options.sceneRuntime.requestRender();
    return true;
  }
}
