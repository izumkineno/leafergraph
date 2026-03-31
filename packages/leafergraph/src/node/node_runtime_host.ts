/**
 * 节点运行时宿主模块。
 *
 * @remarks
 * 主包节点运行时宿主现在只负责：
 * 1. 节点快照与检查面板快照
 * 2. 折叠态、resize 约束和连接变化回抛
 * 3. Widget 动作入口与宿主状态投影
 * 4. 组合纯执行内核 `@leafergraph/execution`
 */

import {
  serializeNode,
  createNodeApi,
  type GraphLink,
  type NodeRegistry,
  type NodeSlotSpec,
  type NodeSerializeResult
} from "@leafergraph/node";
import {
  LeaferGraphNodeExecutionHost,
  type LeaferGraphCreateEntryExecutionTaskOptions,
  type LeaferGraphNodeExecutionTask,
  type LeaferGraphNodeExecutionTaskResult
} from "@leafergraph/execution";
import type {
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeIoValueEntry,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason
} from "@leafergraph/contracts";
import type { LeaferGraphWidgetRegistry } from "@leafergraph/widget-runtime";
import type { LeaferGraphRenderableNodeState } from "../graph/graph_runtime_types";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";

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
  graphLinks: Map<string, GraphLink>;
  nodeViews: Map<string, TNodeViewState>;
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "refreshNodeView" | "updateConnectedLinks" | "resizeNode" | "requestRender"
  >;
  resolveNodeResizeConstraint(node: TNodeState): LeaferGraphNodeResizeConstraint;
}

export type {
  LeaferGraphCreateEntryExecutionTaskOptions,
  LeaferGraphNodeExecutionTask,
  LeaferGraphNodeExecutionTaskResult
} from "@leafergraph/execution";

/**
 * 封装 LeaferGraphNodeRuntimeHost 的宿主能力。
 */
export class LeaferGraphNodeRuntimeHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  private readonly stateListeners = new Set<
    (event: LeaferGraphNodeStateChangeEvent) => void
  >();

  private readonly options: LeaferGraphNodeRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;

  private readonly nodeExecutionHost: LeaferGraphNodeExecutionHost<TNodeState>;

  /**
   * 初始化 LeaferGraphNodeRuntimeHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(
    options: LeaferGraphNodeRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
    this.nodeExecutionHost = new LeaferGraphNodeExecutionHost({
      nodeRegistry: options.nodeRegistry,
      widgetRegistry: options.widgetRegistry,
      graphNodes: options.graphNodes,
      graphLinks: options.graphLinks
    });

    this.nodeExecutionHost.subscribeNodeExecution((event) => {
      this.refreshExecutedNode(event.nodeId);
      this.notifyNodeStateChanged(event.nodeId, "execution");
    });
    this.nodeExecutionHost.subscribeLinkPropagation((event) => {
      this.options.sceneRuntime.requestRender();
      this.notifyNodeStateChanged(event.targetNodeId, "input-values");
    });
  }

  /**
   * 获取节点快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
   */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return serializeNode(this.options.nodeRegistry, node);
  }

  /**
   * 设置节点`Collapsed`。
   *
   * @param nodeId - 目标节点 ID。
   * @param collapsed - `collapsed`。
   * @returns 对应的判断结果。
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
   * 处理 `getNodeResizeConstraint` 相关逻辑。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
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
   * 获取节点执行状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
   */
  getNodeExecutionState(
    nodeId: string
  ): LeaferGraphNodeExecutionState | undefined {
    return this.nodeExecutionHost.getNodeExecutionState(nodeId);
  }

  /**
   * 获取节点`Inspector` 状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 处理后的结果。
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
      executionState: this.nodeExecutionHost.getNodeExecutionState(nodeId) ?? {
        status: "idle",
        runCount: 0
      }
    };
  }

  /**
   * 判断是否可以`Resize` 节点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 对应的判断结果。
   */
  canResizeNode(nodeId: string): boolean {
    return Boolean(this.getNodeResizeConstraint(nodeId)?.enabled);
  }

  /**
   * 判断是否可以执行节点。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 对应的判断结果。
   */
  canExecuteNode(nodeId: string): boolean {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return false;
    }

    return Boolean(this.options.nodeRegistry.getNode(node.type)?.onExecute);
  }

  /**
   * 按类型列出节点 ID 列表。
   *
   * @param type - 类型。
   * @returns 收集到的结果列表。
   */
  listNodeIdsByType(type: string): string[] {
    return this.nodeExecutionHost.listNodeIdsByType(type);
  }

  /**
   * 重置节点`Size`。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 重置节点`Size`的结果。
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
   * 处理 `playFromNode` 相关逻辑。
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 当前上下文。
   * @returns 对应的判断结果。
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
   * 执行节点。
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 当前上下文。
   * @returns 对应的判断结果。
   */
  executeNode(nodeId: string, context?: unknown): boolean {
    return this.playFromNode(nodeId, context);
  }

  /**
   * 创建条目执行任务。
   *
   * @param nodeId - 目标节点 ID。
   * @param options - 可选配置项。
   * @returns 创建后的结果对象。
   */
  createEntryExecutionTask(
    nodeId: string,
    options: LeaferGraphCreateEntryExecutionTaskOptions
  ): LeaferGraphNodeExecutionTask | undefined {
    return this.nodeExecutionHost.createEntryExecutionTask(nodeId, options);
  }

  /**
   * 执行执行任务。
   *
   * @param task - 任务。
   * @param stepIndex - 步骤`Index`。
   * @returns 执行执行任务的结果。
   */
  executeExecutionTask(
    task: LeaferGraphNodeExecutionTask,
    stepIndex: number
  ): LeaferGraphNodeExecutionTaskResult {
    return this.nodeExecutionHost.executeExecutionTask(task, stepIndex);
  }

  /**
   * 订阅节点执行。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消当前订阅的清理函数。
   */
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    return this.nodeExecutionHost.subscribeNodeExecution(listener);
  }

  /**
   * 映射外部节点执行。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void {
    this.nodeExecutionHost.projectExternalNodeExecution(event);
  }

  /**
   * 订阅连线传播。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消当前订阅的清理函数。
   */
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void {
    return this.nodeExecutionHost.subscribeLinkPropagation(listener);
  }

  /**
   * 映射外部连线传播。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  projectExternalLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    this.nodeExecutionHost.projectExternalLinkPropagation(event);
  }

  /**
   * 订阅节点状态。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消当前订阅的清理函数。
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
   * 映射外部节点状态。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  projectExternalNodeState(event: LeaferGraphNodeStateChangeEvent): void {
    if (!event.exists) {
      this.nodeExecutionHost.clearNodeExecutionState(event.nodeId);
    } else if (event.reason === "execution") {
      this.refreshExecutedNode(event.nodeId);
    } else if (event.reason === "connections") {
      this.options.sceneRuntime.updateConnectedLinks(event.nodeId);
      this.options.sceneRuntime.requestRender();
    }

    if (!this.stateListeners.size) {
      return;
    }

    const snapshot = cloneNodeStateEvent(event);
    for (const listener of this.stateListeners) {
      listener(snapshot);
    }
  }

  /**
   * 处理 `notifyNodeStateChanged` 相关逻辑。
   *
   * @param nodeId - 目标节点 ID。
   * @param reason - `reason`。
   * @returns 无返回值。
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

  /**
   * 清理节点执行状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  clearNodeExecutionState(nodeId: string): void {
    this.nodeExecutionHost.clearNodeExecutionState(nodeId);
  }

  /**
   * 清理全部执行状态。
   *
   * @returns 无返回值。
   */
  clearAllExecutionStates(): void {
    this.nodeExecutionHost.clearAllExecutionStates();
  }

  /**
   * 处理 `notifyLinkCreated` 相关逻辑。
   *
   * @param link - 连线。
   * @returns 无返回值。
   */
  notifyLinkCreated(link: GraphLink): void {
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
   * 处理 `notifyLinkRemoved` 相关逻辑。
   *
   * @param link - 连线。
   * @returns 无返回值。
   */
  notifyLinkRemoved(link: GraphLink): void {
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
   * 派发节点 Widget 动作。
   *
   * @param nodeId - 目标节点 ID。
   * @param action - 动作。
   * @param param - 解构后的输入参数。
   * @param options - 可选配置项。
   * @returns 对应的判断结果。
   */
  emitNodeWidgetAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): boolean {
    const result = this.nodeExecutionHost.dispatchNodeAction(
      nodeId,
      action,
      param,
      options
    );
    if (!result.handled) {
      return false;
    }

    let stepIndex = 0;
    const queue = [...result.nextTasks];
    while (queue.length) {
      const task = queue.shift();
      if (!task) {
        break;
      }

      const taskResult = this.executeExecutionTask(task, stepIndex);
      stepIndex += 1;
      queue.push(...taskResult.nextTasks);
    }

    this.options.sceneRuntime.requestRender();
    this.notifyNodeStateChanged(nodeId, "widget-action");
    return true;
  }

  /**
   * 处理 `refreshExecutedNode` 相关逻辑。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  private refreshExecutedNode(nodeId: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (state) {
      this.options.sceneRuntime.refreshNodeView(state);
    }

    this.options.sceneRuntime.updateConnectedLinks(nodeId);
    this.options.sceneRuntime.requestRender();
  }

  /**
   * 判断是否存在`Remaining` 连接。
   *
   * @param nodeId - 目标节点 ID。
   * @param type - 类型。
   * @param slot - 槽位。
   * @returns 对应的判断结果。
   */
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

  /**
   * 分发连接`Change`。
   *
   * @param nodeId - 目标节点 ID。
   * @param type - 类型。
   * @param slot - 槽位。
   * @param connected - `connected`。
   * @returns 无返回值。
   */
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

/**
 * 处理 `createNodeIoValueEntries` 相关逻辑。
 *
 * @param slots - 槽位。
 * @param values - 值。
 * @returns 创建后的结果对象。
 */
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

/**
 * 规范化连接槽位。
 *
 * @param slot - 槽位。
 * @returns 处理后的结果。
 */
function normalizeConnectionSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

/**
 * 克隆节点状态事件。
 *
 * @param event - 当前事件对象。
 * @returns 处理后的结果。
 */
function cloneNodeStateEvent(
  event: LeaferGraphNodeStateChangeEvent
): LeaferGraphNodeStateChangeEvent {
  return {
    ...event
  };
}

/**
 * 克隆可读值。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
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
