/**
 * 节点运行时宿主模块。
 *
 * @remarks
 * 负责节点快照、折叠态、尺寸约束、Widget 动作回抛和统一执行调度原语。
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
  LeaferGraphExecutionContext,
  LeaferGraphExecutionSource,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeExecutionTrigger,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeIoValueEntry,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason
} from "../api/graph_api_types";
import type { LeaferGraphRenderableNodeState } from "../graph/graph_runtime_types";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";
import type { LeaferGraphWidgetRegistry } from "../widgets/widget_registry";

type LeaferGraphRuntimeNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  state: TNodeState;
};

interface LeaferGraphExecutionChainState {
  chainId: string;
  rootNodeId: string;
  entryNodeId: string;
  source: LeaferGraphExecutionSource;
  runId?: string;
  startedAt: number;
  payload?: unknown;
  nextSequence: number;
}

export interface LeaferGraphNodeExecutionTask {
  nodeId: string;
  trigger: LeaferGraphNodeExecutionTrigger;
  depth: number;
  activeNodeIds: ReadonlySet<string>;
  chain: LeaferGraphExecutionChainState;
}

export interface LeaferGraphNodeExecutionTaskResult {
  handled: boolean;
  nextTasks: LeaferGraphNodeExecutionTask[];
}

let executionChainSeed = 1;

/**
 * 节点运行时宿主依赖项。
 *
 * @remarks
 * 节点运行时宿主只关心“节点层面的业务动作”：
 * 取快照、折叠、查询 resize 约束、把 Widget 动作回抛给节点定义，
 * 以及提供可被图级运行时复用的统一任务执行原语。
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
 * 5. 统一节点执行任务调度原语
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
   * 判断某个节点当前是否具备可执行的 `onExecute(...)`。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 是否存在可执行生命周期。
   */
  canExecuteNode(nodeId: string): boolean {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return false;
    }

    return Boolean(this.options.nodeRegistry.getNode(node.type)?.onExecute);
  }

  /**
   * 按当前图中的插入顺序列出指定类型的节点 ID。
   *
   * @param type - 目标节点类型。
   * @returns 稳定顺序的节点 ID 列表。
   */
  listNodeIdsByType(type: string): string[] {
    const nodeIds: string[] = [];

    for (const node of this.options.graphNodes.values()) {
      if (node.type === type) {
        nodeIds.push(node.id);
      }
    }

    return nodeIds;
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
   * 从单个节点开始执行一条完整运行链。
   *
   * @remarks
   * 这是节点级调试入口，不会进入图级 active run。
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 附加调试上下文。
   * @returns 是否命中了可执行节点并真正进入执行路径。
   */
  playFromNode(nodeId: string, context?: unknown): boolean {
    const entryTask = this.createEntryExecutionTask(nodeId, {
      source: "node-play",
      payload: context
    });
    if (!entryTask) {
      return false;
    }

    const queue: LeaferGraphNodeExecutionTask[] = [entryTask];
    let stepIndex = 0;
    let handled = false;

    while (queue.length) {
      const task = queue.shift();
      if (!task) {
        break;
      }

      const result = this.executeExecutionTask(task, stepIndex);
      stepIndex += 1;
      handled = handled || result.handled;
      queue.push(...result.nextTasks);
    }

    return handled;
  }

  /**
   * 兼容旧名称的节点执行入口。
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 附加调试上下文。
   * @returns 是否命中了可执行节点并真正进入执行路径。
   */
  executeNode(nodeId: string, context?: unknown): boolean {
    return this.playFromNode(nodeId, context);
  }

  /**
   * 创建一个图级或节点级入口任务。
   *
   * @param nodeId - 入口节点 ID。
   * @param options - 入口任务配置。
   * @returns 可进入统一调度器的入口任务；节点不存在时返回 `undefined`。
   */
  createEntryExecutionTask(
    nodeId: string,
    options: {
      source: LeaferGraphExecutionSource;
      runId?: string;
      payload?: unknown;
      startedAt?: number;
    }
  ): LeaferGraphNodeExecutionTask | undefined {
    if (!this.options.graphNodes.has(nodeId)) {
      return undefined;
    }

    return {
      nodeId,
      trigger: "direct",
      depth: 0,
      activeNodeIds: new Set<string>(),
      chain: {
        chainId: createExecutionChainId(nodeId),
        rootNodeId: nodeId,
        entryNodeId: nodeId,
        source: options.source,
        runId: options.runId,
        startedAt: options.startedAt ?? Date.now(),
        payload: options.payload,
        nextSequence: 0
      }
    };
  }

  /**
   * 执行一个已经进入调度队列的节点任务。
   *
   * @param task - 待执行任务。
   * @param stepIndex - 当前运行推进到的全局步数。
   * @returns 本次执行是否真正命中节点，以及需要追加的下游任务。
   */
  executeExecutionTask(
    task: LeaferGraphNodeExecutionTask,
    stepIndex: number
  ): LeaferGraphNodeExecutionTaskResult {
    const node = this.options.graphNodes.get(task.nodeId);
    if (!node) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    if (task.activeNodeIds.has(task.nodeId)) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const definition = this.options.nodeRegistry.getNode(node.type);
    if (!definition?.onExecute) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const sequence = task.chain.nextSequence;
    task.chain.nextSequence += 1;
    const executionContext = createExecutionContext(task.chain, stepIndex);
    const activeNodeIds = new Set(task.activeNodeIds);
    activeNodeIds.add(task.nodeId);
    const nextTasks: LeaferGraphNodeExecutionTask[] = [];
    let handled = false;
    const startedAt = Date.now();

    this.updateExecutionState(task.nodeId, {
      status: "running",
      lastExecutedAt: startedAt
    });
    this.refreshExecutedNode(task.nodeId);
    this.notifyNodeStateChanged(task.nodeId, "execution");

    try {
      definition.onExecute(
        node,
        executionContext,
        createNodeApi(node, {
          definition,
          widgetDefinitions: this.options.widgetRegistry,
          onSetOutputData: (slot, data) => {
            this.notifyNodeStateChanged(task.nodeId, "execution");
            nextTasks.push(
              ...this.collectPropagatedTasks(
                task,
                activeNodeIds,
                slot,
                data
              )
            );
          }
        })
      );
      handled = true;
      const finishedAt = Date.now();
      this.updateExecutionState(task.nodeId, {
        status: "success",
        runCountDelta: 1,
        lastSucceededAt: finishedAt,
        clearLastErrorMessage: true
      });
      this.emitNodeExecutionEvent(
        task,
        sequence,
        executionContext,
        cloneExecutionState(this.executionStateByNodeId.get(task.nodeId))
      );
    } catch (error) {
      handled = true;
      const finishedAt = Date.now();
      const errorMessage = toExecutionErrorMessage(error);
      this.updateExecutionState(task.nodeId, {
        status: "error",
        runCountDelta: 1,
        lastFailedAt: finishedAt,
        lastErrorMessage: errorMessage
      });
      this.emitNodeExecutionEvent(
        task,
        sequence,
        executionContext,
        cloneExecutionState(this.executionStateByNodeId.get(task.nodeId))
      );
      console.error(
        `[leafergraph] 节点 onExecute 执行失败: ${node.type}#${node.id}`,
        { context: executionContext },
        error
      );
    } finally {
      const state = this.options.nodeViews.get(task.nodeId);
      if (state) {
        this.options.sceneRuntime.refreshNodeView(state);
      }
      this.options.sceneRuntime.updateConnectedLinks(task.nodeId);
      this.options.sceneRuntime.requestRender();
      this.notifyNodeStateChanged(task.nodeId, "execution");
    }

    return {
      handled,
      nextTasks
    };
  }

  /**
   * 订阅节点执行完成事件。
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
    task: LeaferGraphNodeExecutionTask,
    sequence: number,
    executionContext: LeaferGraphExecutionContext,
    state: LeaferGraphNodeExecutionState
  ): void {
    if (!this.executionListeners.size) {
      return;
    }

    const node = this.options.graphNodes.get(task.nodeId);
    const rootNode = this.options.graphNodes.get(task.chain.rootNodeId);
    if (!node) {
      return;
    }

    const timestamp =
      state.status === "error"
        ? state.lastFailedAt ?? state.lastExecutedAt ?? Date.now()
        : state.lastSucceededAt ?? state.lastExecutedAt ?? Date.now();
    const event: LeaferGraphNodeExecutionEvent = {
      chainId: task.chain.chainId,
      rootNodeId: task.chain.rootNodeId,
      rootNodeType: rootNode?.type ?? node.type,
      rootNodeTitle: rootNode?.title ?? node.title,
      nodeId: task.nodeId,
      nodeType: node.type,
      nodeTitle: node.title,
      depth: task.depth,
      sequence,
      source: task.chain.source,
      trigger: task.trigger,
      timestamp,
      executionContext,
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

  /** 收集一个输出槽位对应的全部下游任务，并保持正式连线顺序。 */
  private collectPropagatedTasks(
    task: LeaferGraphNodeExecutionTask,
    activeNodeIds: ReadonlySet<string>,
    sourceSlot: number,
    data: unknown
  ): LeaferGraphNodeExecutionTask[] {
    const safeSourceSlot = normalizeConnectionSlot(sourceSlot);
    const nextTasks: LeaferGraphNodeExecutionTask[] = [];
    const nextNodeIds = new Set<string>();

    for (const link of this.options.graphLinks.values()) {
      if (
        link.source.nodeId !== task.nodeId ||
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

      if (nextNodeIds.has(targetNode.id)) {
        continue;
      }

      nextNodeIds.add(targetNode.id);
      nextTasks.push({
        nodeId: targetNode.id,
        trigger: "propagated",
        depth: task.depth + 1,
        activeNodeIds: new Set(activeNodeIds),
        chain: task.chain
      });
    }

    return nextTasks;
  }
}

function createExecutionChainId(nodeId: string): string {
  const chainId = `exec:${nodeId}:${Date.now()}:${executionChainSeed}`;
  executionChainSeed += 1;
  return chainId;
}

function createExecutionContext(
  chain: LeaferGraphExecutionChainState,
  stepIndex: number
): LeaferGraphExecutionContext {
  return {
    source: chain.source,
    runId: chain.runId,
    entryNodeId: chain.entryNodeId,
    stepIndex,
    startedAt: chain.startedAt,
    payload: chain.payload
  };
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
