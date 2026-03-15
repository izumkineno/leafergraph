/**
 * 节点运行时宿主模块。
 *
 * @remarks
 * 负责节点快照、折叠态、尺寸约束和 Widget 动作回抛。
 */

import {
  createNodeApi,
  serializeNode,
  type LeaferGraphLinkData,
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

/**
 * 节点运行时宿主依赖项。
 *
 * @remarks
 * 节点运行时宿主只关心“节点层面的业务动作”：
 * 取快照、折叠、查询 resize 约束、把 Widget 动作回抛给节点定义。
 * 真正的场景刷新和尺寸更新仍通过 `sceneRuntime` 转发。
 */
interface LeaferGraphNodeRuntimeHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, LeaferGraphLinkData>;
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

  /**
   * 读取一个正式可序列化节点快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 正式节点快照；节点不存在时返回 `undefined`。
   */
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
   *
   * @param nodeId - 目标节点 ID。
   * @param collapsed - 目标折叠态。
   * @returns 是否成功应用折叠态。
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

  /**
   * 读取某个节点的正式 resize 约束。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点 resize 约束；节点不存在时返回 `undefined`。
   */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return this.options.resolveNodeResizeConstraint(node);
  }

  /**
   * 判断某个节点当前是否允许显示并响应 resize 交互。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 是否允许 resize。
   */
  canResizeNode(nodeId: string): boolean {
    return Boolean(this.getNodeResizeConstraint(nodeId)?.enabled);
  }

  /**
   * 把节点尺寸恢复到定义默认值。
   * 如果定义没有显式提供默认尺寸，则回退到主包默认约束。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 更新后的节点；无法恢复时返回 `undefined`。
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
   * 在一条连线正式创建完成后，把连接变化回抛给两端节点生命周期。
   *
   * @param link - 已经成功进入图状态的正式连线数据。
   */
  notifyLinkCreated(link: LeaferGraphLinkData): void {
    this.dispatchConnectionsChange(
      link.source.nodeId,
      "output",
      normalizeConnectionSlot(link.source.slot),
      true
    );
    this.dispatchConnectionsChange(
      link.target.nodeId,
      "input",
      normalizeConnectionSlot(link.target.slot),
      true
    );
  }

  /**
   * 在一条连线正式移除后，把“当前槽位是否仍有连接”回抛给两端节点生命周期。
   * 这里的 `connected` 语义不是“本次发生了断开”，
   * 而是“该槽位在移除完成后是否仍然保留至少一条连接”。
   *
   * @param link - 刚刚被移除的正式连线数据。
   */
  notifyLinkRemoved(link: LeaferGraphLinkData): void {
    const sourceSlot = normalizeConnectionSlot(link.source.slot);
    const targetSlot = normalizeConnectionSlot(link.target.slot);

    this.dispatchConnectionsChange(
      link.source.nodeId,
      "output",
      sourceSlot,
      this.hasRemainingConnections(link.source.nodeId, "output", sourceSlot)
    );
    this.dispatchConnectionsChange(
      link.target.nodeId,
      "input",
      targetSlot,
      this.hasRemainingConnections(link.target.nodeId, "input", targetSlot)
    );
  }

  /**
   * 把 Widget 触发的动作转回节点生命周期 `onAction(...)`。
   * 当前先提供最小桥接能力，便于自定义 Widget 把业务语义交回节点定义处理。
   *
   * @param nodeId - 动作来源节点 ID。
   * @param action - 动作名。
   * @param param - 动作参数。
   * @param options - 额外动作元数据。
   * @returns 是否成功命中节点定义里的 `onAction(...)`。
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

    // 这里显式通过 createNodeApi(...) 构造节点侧 API，保证节点定义拿到的是正式宿主入口而非裸状态对象。
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

  /** 判断某个槽位在当前图状态里是否仍有至少一条连线。 */
  private hasRemainingConnections(
    nodeId: string,
    type: "input" | "output",
    slot: number
  ): boolean {
    for (const link of this.options.graphLinks.values()) {
      if (
        type === "input" &&
        link.target.nodeId === nodeId &&
        normalizeConnectionSlot(link.target.slot) === slot
      ) {
        return true;
      }

      if (
        type === "output" &&
        link.source.nodeId === nodeId &&
        normalizeConnectionSlot(link.source.slot) === slot
      ) {
        return true;
      }
    }

    return false;
  }

  /** 统一调度节点定义里的 `onConnectionsChange(...)`。 */
  private dispatchConnectionsChange(
    nodeId: string,
    type: "input" | "output",
    slot: number,
    connected: boolean
  ): void {
    const node = this.options.graphNodes.get(nodeId);
    const state = this.options.nodeViews.get(nodeId);
    if (!node || !state) {
      return;
    }

    const definition = this.options.nodeRegistry.getNode(node.type);
    if (!definition?.onConnectionsChange) {
      return;
    }

    try {
      definition.onConnectionsChange(
        node,
        type,
        slot,
        connected,
        createNodeApi(node, {
          definition,
          widgetDefinitions: this.options.widgetRegistry
        })
      );
    } catch (error) {
      console.error(
        `[leafergraph] 节点 onConnectionsChange 执行失败: ${node.type}#${node.id}`,
        {
          type,
          slot,
          connected
        },
        error
      );
    } finally {
      this.options.sceneRuntime.refreshNodeView(state);
      this.options.sceneRuntime.updateConnectedLinks(nodeId);
      this.options.sceneRuntime.requestRender();
    }
  }
}

/** 把连线端点槽位统一约束成安全整数。 */
function normalizeConnectionSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}
