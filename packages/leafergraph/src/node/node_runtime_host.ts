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
  type NodeSlotSpec,
  type NodeSerializeResult
} from "@leafergraph/node";
import type {
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeIoValueEntry,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason,
  LeaferGraphNodeExecutionTrigger,
  LeaferGraphNodeResizeConstraint
} from "../api/graph_api_types";
import type { LeaferGraphRenderableNodeState } from "../graph/graph_runtime_types";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";
import type { LeaferGraphWidgetRegistry } from "../widgets/widget_registry";

type LeaferGraphRuntimeNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  state: TNodeState;
};

interface LeaferGraphNodeExecutionContext {
  chainId: string;
  rootNodeId: string;
  activeNodeIds: Set<string>;
  nextSequence: number;
}

let executionChainSeed = 1;

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
  private readonly executionListeners = new Set<
    (event: LeaferGraphNodeExecutionEvent) => void
  >();

  private readonly stateListeners = new Set<
    (event: LeaferGraphNodeStateChangeEvent) => void
  >();

  private readonly executionStateByNodeId = new Map<
    string,
    LeaferGraphNodeExecutionState
  >();

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
    this.notifyNodeStateChanged(nodeId, "collapsed");
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
   * 读取某个节点当前的最小执行反馈快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点执行状态；节点不存在时返回 `undefined`。
   */
  getNodeExecutionState(
    nodeId: string
  ): LeaferGraphNodeExecutionState | undefined {
    if (!this.options.graphNodes.has(nodeId)) {
      return undefined;
    }

    return cloneExecutionState(this.executionStateByNodeId.get(nodeId));
  }

  /**
   * 读取一个节点当前的检查快照。
   *
   * @remarks
   * 这份快照会同时带上：
   * - 当前 properties / data
   * - 当前输入输出槽位的运行时值
   * - 当前执行状态
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点检查快照；节点不存在时返回 `undefined`。
   */
  getNodeInspectorState(
    nodeId: string
  ): LeaferGraphNodeInspectorState | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return {
      id: node.id,
      type: node.type,
      title: node.title,
      layout: cloneReadableValue(node.layout),
      flags: cloneReadableValue(node.flags),
      properties: cloneReadableValue(node.properties),
      data: cloneReadableValue(node.data),
      inputs: createNodeIoValueEntries(node.inputs, node.inputValues),
      outputs: createNodeIoValueEntries(node.outputs, node.outputValues),
      executionState: cloneExecutionState(this.executionStateByNodeId.get(nodeId))
    };
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
   * 执行单个节点的 `onExecute(...)`，并按当前正式连线把输出传播到下游节点。
   *
   * @remarks
   * 第一版保持最小闭环：
   * 1. 只提供显式单节点入口
   * 2. 使用“当前节点执行 -> 输出传播 -> 命中的下游节点递归执行”
   * 3. 通过 `activeNodeIds` 阻止最直接的循环递归
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 传给节点生命周期的最小执行上下文。
   * @returns 是否成功命中并执行了该节点定义里的 `onExecute(...)`。
   */
  executeNode(nodeId: string, context?: unknown): boolean {
    return this.executeNodeRecursive(
      nodeId,
      context,
      {
        chainId: createExecutionChainId(nodeId),
        rootNodeId: nodeId,
        activeNodeIds: new Set(),
        nextSequence: 0
      },
      "direct",
      0
    );
  }

  /**
   * 订阅节点执行完成事件。
   *
   * @remarks
   * 这条订阅口专门服务 editor 调试承接：
   * - 每次节点执行结束后会发出一条事件
   * - 下游传播触发的递归执行同样会进入这条链路
   *
   * @param listener - 执行事件监听器。
   * @returns 取消订阅函数。
   */
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    this.executionListeners.add(listener);

    return () => {
      this.executionListeners.delete(listener);
    };
  }

  /**
   * 订阅节点状态变化事件。
   *
   * @remarks
   * 这条订阅口专门服务 editor 右侧信息面板和后续调试面板：
   * 任何会影响节点快照、properties、data、IO 值或执行状态的路径，
   * 都应该通过这里通知外部“可以重新拉一次检查快照了”。
   *
   * @param listener - 节点状态变化监听器。
   * @returns 取消订阅函数。
   */
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void {
    this.stateListeners.add(listener);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * 向外广播一次节点状态变化事件。
   *
   * @param nodeId - 目标节点 ID。
   * @param reason - 变化原因。
   */
  notifyNodeStateChanged(
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason
  ): void {
    if (!this.stateListeners.size) {
      return;
    }

    const exists = this.options.graphNodes.has(nodeId);
    const event: LeaferGraphNodeStateChangeEvent = {
      nodeId,
      exists,
      reason,
      timestamp: Date.now()
    };

    for (const listener of this.stateListeners) {
      listener(event);
    }
  }

  /** 清理单个节点的执行反馈，供节点删除路径复用。 */
  clearNodeExecutionState(nodeId: string): void {
    this.executionStateByNodeId.delete(nodeId);
  }

  /** 清空当前图中全部节点的执行反馈，供整图恢复复用。 */
  clearAllExecutionStates(): void {
    this.executionStateByNodeId.clear();
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
    this.notifyNodeStateChanged(link.source.nodeId, "connections");
    this.notifyNodeStateChanged(link.target.nodeId, "connections");
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
    this.notifyNodeStateChanged(link.source.nodeId, "connections");
    this.notifyNodeStateChanged(link.target.nodeId, "connections");
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
    this.notifyNodeStateChanged(nodeId, "widget-action");
    return true;
  }

  /** 执行单个节点，并在 `setOutputData(...)` 时把结果传播到下游。 */
  private executeNodeRecursive(
    nodeId: string,
    context: unknown,
    executionState: LeaferGraphNodeExecutionContext,
    trigger: LeaferGraphNodeExecutionTrigger,
    depth: number
  ): boolean {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return false;
    }

    if (executionState.activeNodeIds.has(nodeId)) {
      return false;
    }

    const definition = this.options.nodeRegistry.getNode(node.type);
    if (!definition?.onExecute) {
      return false;
    }

    executionState.activeNodeIds.add(nodeId);
    const sequence = executionState.nextSequence;
    executionState.nextSequence += 1;
    let executed = false;
    this.updateExecutionState(nodeId, {
      status: "running",
      lastExecutedAt: Date.now()
    });
    this.refreshExecutedNode(nodeId);
    this.notifyNodeStateChanged(nodeId, "execution");

    try {
      definition.onExecute(
        node,
        context,
        createNodeApi(node, {
          definition,
          widgetDefinitions: this.options.widgetRegistry,
          onSetOutputData: (slot, data) => {
            this.notifyNodeStateChanged(nodeId, "execution");
            this.propagateNodeOutput(
              nodeId,
              slot,
              data,
              context,
              executionState,
              depth
            );
          }
        })
      );
      executed = true;
      this.updateExecutionState(nodeId, {
        status: "success",
        runCountDelta: 1,
        lastSucceededAt: Date.now(),
        clearLastErrorMessage: true
      });
      this.emitNodeExecutionEvent(nodeId, executionState, trigger, depth, sequence);
    } catch (error) {
      const errorMessage = toExecutionErrorMessage(error);
      this.updateExecutionState(nodeId, {
        status: "error",
        runCountDelta: 1,
        lastFailedAt: Date.now(),
        lastErrorMessage: errorMessage
      });
      this.emitNodeExecutionEvent(nodeId, executionState, trigger, depth, sequence);
      console.error(
        `[leafergraph] 节点 onExecute 执行失败: ${node.type}#${node.id}`,
        { context },
        error
      );
    } finally {
      executionState.activeNodeIds.delete(nodeId);
      const state = this.options.nodeViews.get(nodeId);
      if (state) {
        this.options.sceneRuntime.refreshNodeView(state);
      }
      this.options.sceneRuntime.updateConnectedLinks(nodeId);
      this.options.sceneRuntime.requestRender();
      this.notifyNodeStateChanged(nodeId, "execution");
    }

    return executed;
  }

  /** 局部更新一份节点执行反馈，并保留未覆写字段。 */
  private updateExecutionState(
    nodeId: string,
    input: {
      status: LeaferGraphNodeExecutionState["status"];
      runCountDelta?: number;
      lastExecutedAt?: number;
      lastSucceededAt?: number;
      lastFailedAt?: number;
      lastErrorMessage?: string;
      clearLastErrorMessage?: boolean;
    }
  ): void {
    const prevState = cloneExecutionState(this.executionStateByNodeId.get(nodeId));

    this.executionStateByNodeId.set(nodeId, {
      status: input.status,
      runCount: prevState.runCount + (input.runCountDelta ?? 0),
      lastExecutedAt: input.lastExecutedAt ?? prevState.lastExecutedAt,
      lastSucceededAt: input.lastSucceededAt ?? prevState.lastSucceededAt,
      lastFailedAt: input.lastFailedAt ?? prevState.lastFailedAt,
      lastErrorMessage: input.clearLastErrorMessage
        ? undefined
        : input.lastErrorMessage ?? prevState.lastErrorMessage
    });
  }

  /** 刷新一个节点及其关联连线，确保执行反馈可以马上进入节点壳。 */
  private refreshExecutedNode(nodeId: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (state) {
      this.options.sceneRuntime.refreshNodeView(state);
    }

    this.options.sceneRuntime.updateConnectedLinks(nodeId);
    this.options.sceneRuntime.requestRender();
  }

  /** 向外分发一次“节点执行完成”事件。 */
  private emitNodeExecutionEvent(
    nodeId: string,
    executionContext: LeaferGraphNodeExecutionContext,
    trigger: LeaferGraphNodeExecutionTrigger,
    depth: number,
    sequence: number
  ): void {
    if (!this.executionListeners.size) {
      return;
    }

    const node = this.options.graphNodes.get(nodeId);
    const rootNode = this.options.graphNodes.get(executionContext.rootNodeId);
    if (!node) {
      return;
    }

    const state = cloneExecutionState(this.executionStateByNodeId.get(nodeId));
    const timestamp =
      state.lastFailedAt ??
      state.lastSucceededAt ??
      state.lastExecutedAt ??
      Date.now();
    const event: LeaferGraphNodeExecutionEvent = {
      chainId: executionContext.chainId,
      rootNodeId: executionContext.rootNodeId,
      rootNodeType: rootNode?.type ?? node.type,
      rootNodeTitle: rootNode?.title ?? node.title,
      nodeId,
      nodeType: node.type,
      nodeTitle: node.title,
      depth,
      sequence,
      trigger,
      timestamp,
      state
    };

    for (const listener of this.executionListeners) {
      listener(event);
    }
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

  /** 把一个输出槽位的运行值写入所有命中的下游输入，并递归执行下游节点。 */
  private propagateNodeOutput(
    sourceNodeId: string,
    sourceSlot: number,
    data: unknown,
    context: unknown,
    executionState: LeaferGraphNodeExecutionContext,
    depth: number
  ): void {
    const safeSourceSlot = normalizeConnectionSlot(sourceSlot);
    const nextNodeIds = new Set<string>();

    for (const link of this.options.graphLinks.values()) {
      if (
        link.source.nodeId !== sourceNodeId ||
        normalizeConnectionSlot(link.source.slot) !== safeSourceSlot
      ) {
        continue;
      }

      const targetNode = this.options.graphNodes.get(link.target.nodeId);
      if (!targetNode) {
        continue;
      }

      const targetSlot = normalizeConnectionSlot(link.target.slot);
      writeRuntimeValue(targetNode.inputValues, targetSlot, data);
      this.notifyNodeStateChanged(targetNode.id, "input-values");
      nextNodeIds.add(targetNode.id);
    }

    for (const targetNodeId of nextNodeIds) {
      this.executeNodeRecursive(
        targetNodeId,
        context,
        executionState,
        "propagated",
        depth + 1
      );
    }
  }
}

function createExecutionChainId(nodeId: string): string {
  const chainId = `exec:${nodeId}:${Date.now()}:${executionChainSeed}`;
  executionChainSeed += 1;
  return chainId;
}

/** 把槽位定义和运行值拼成可直接展示的 IO 快照。 */
function createNodeIoValueEntries(
  slots: readonly NodeSlotSpec[],
  values: readonly unknown[]
): LeaferGraphNodeIoValueEntry[] {
  return slots.map((slot, index) => ({
    slot: index,
    name: slot.name,
    label: slot.label,
    type: slot.type,
    value: cloneReadableValue(values[index])
  }));
}

/** 把连线端点槽位统一约束成安全整数。 */
function normalizeConnectionSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

/** 把运行时值写到指定槽位；若当前数组长度不足则按需补齐。 */
function writeRuntimeValue(values: unknown[], slot: number, data: unknown): void {
  while (values.length <= slot) {
    values.push(undefined);
  }

  values[slot] = data;
}

/** 拷贝执行反馈，避免外部直接共享内部 Map 中的引用。 */
function cloneExecutionState(
  state: LeaferGraphNodeExecutionState | undefined
): LeaferGraphNodeExecutionState {
  return state
    ? { ...state }
    : {
        status: "idle",
        runCount: 0
      };
}

/** 为只读检查面板拷贝一份可安全读取的值。 */
function cloneReadableValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

/** 将任意执行异常归一成最小错误文本。 */
function toExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "节点执行失败";
}
