import {
  createNodeApi,
  type GraphLink,
  type NodeRegistry,
  type NodeRuntimeState,
  type WidgetDefinitionReader
} from "@leafergraph/node";
import type {
  LeaferGraphActionExecutionOptions,
  LeaferGraphExecutionContext,
  LeaferGraphExecutionSource,
  LeaferGraphLongTaskController,
  LeaferGraphNodeLongTaskMode,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeExecutionTrigger,
  LeaferGraphPropagatedExecutionMetadata
} from "../types.js";

type LeaferGraphExecutionChainState = {
  chainId: string;
  rootNodeId: string;
  entryNodeId: string;
  source: LeaferGraphExecutionSource;
  runId?: string;
  startedAt: number;
  payload?: unknown;
  nextSequence: number;
};

type LeaferGraphNodeExecutionPhase = "sync" | "deferred";

type LeaferGraphLongTaskState = {
  task: LeaferGraphNodeExecutionTask;
  sequence: number;
  executionContext: LeaferGraphExecutionContext;
  controller: LeaferGraphLongTaskController;
  finished: boolean;
};

export interface LeaferGraphNodeExecutionTask {
  nodeId: string;
  trigger: LeaferGraphNodeExecutionTrigger;
  depth: number;
  activeNodeIds: ReadonlySet<string>;
  chain: LeaferGraphExecutionChainState;
  propagated?: {
    payload: unknown;
    metadata: LeaferGraphPropagatedExecutionMetadata;
  };
}

export interface LeaferGraphNodeExecutionTaskResult {
  handled: boolean;
  nextTasks: LeaferGraphNodeExecutionTask[];
}

export interface LeaferGraphDispatchNodeActionResult {
  handled: boolean;
  nextTasks: LeaferGraphNodeExecutionTask[];
}

export interface LeaferGraphCreateEntryExecutionTaskOptions {
  source: LeaferGraphExecutionSource;
  runId?: string;
  payload?: unknown;
  startedAt?: number;
}

interface LeaferGraphNodeExecutionHostOptions<
  TNodeState extends NodeRuntimeState
> {
  nodeRegistry: NodeRegistry;
  widgetRegistry: WidgetDefinitionReader;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, GraphLink>;
}

let executionChainSeed = 1;

/**
 * 封装 LeaferGraphNodeExecutionHost 的宿主能力。
 */
export class LeaferGraphNodeExecutionHost<
  TNodeState extends NodeRuntimeState = NodeRuntimeState
> {
  private readonly linkPropagationListeners = new Set<
    (event: LeaferGraphLinkPropagationEvent) => void
  >();

  private readonly executionListeners = new Set<
    (event: LeaferGraphNodeExecutionEvent) => void
  >();

  private readonly executionStateByNodeId = new Map<
    string,
    LeaferGraphNodeExecutionState
  >();

  private readonly longTaskStateByNodeId = new Map<string, LeaferGraphLongTaskState>();

  private readonly options: LeaferGraphNodeExecutionHostOptions<TNodeState>;

  /**
   * 初始化 LeaferGraphNodeExecutionHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphNodeExecutionHostOptions<TNodeState>) {
    this.options = options;
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
    if (!this.options.graphNodes.has(nodeId)) {
      return undefined;
    }

    return cloneExecutionState(this.executionStateByNodeId.get(nodeId));
  }

  /**
   * 按类型列出节点 ID 列表。
   *
   * @param type - 类型。
   * @returns 收集到的结果列表。
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
    // 先整理本轮执行所需的输入、上下文和前置约束，避免后续阶段重复分散取值。
    const node = this.options.graphNodes.get(task.nodeId);
    if (!node || task.activeNodeIds.has(task.nodeId)) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const definition = this.options.nodeRegistry.getNode(node.type);
    const propagatedMetadata = task.propagated?.metadata;
    const shouldDispatchAction =
      propagatedMetadata?.targetSlotType === "event" && Boolean(definition?.onAction);
    if (!definition || (!definition.onExecute && !shouldDispatchAction)) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    if (this.shouldSuppressNodeExecution(node, task)) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const sequence = task.chain.nextSequence;
    task.chain.nextSequence += 1;
    let executionContext!: LeaferGraphExecutionContext;
    let longTaskState: LeaferGraphLongTaskState | undefined;
    const executionPhase: { value: LeaferGraphNodeExecutionPhase } = {
      value: "sync"
    };
    const startLongTask = (): LeaferGraphLongTaskController => {
      if (!longTaskState) {
        longTaskState = this.beginLongTaskExecution(
          task,
          sequence,
          executionContext
        );
      }

      return longTaskState.controller;
    };
    executionContext = createExecutionContext(
      task.chain,
      stepIndex,
      startLongTask
    );
    const activeNodeIds = new Set(task.activeNodeIds);
    activeNodeIds.add(task.nodeId);
    const nextTasks: LeaferGraphNodeExecutionTask[] = [];
    let handled = false;
    const startedAt = Date.now();

    // 再推进核心执行或传播流程，并把结果、事件和运行态统一收口。
    this.updateExecutionState(task.nodeId, {
      status: "running",
      runCountDelta: 1,
      lastExecutedAt: startedAt,
      progress: 0
    });
    this.emitNodeExecutionEvent(
      task,
      sequence,
      executionContext,
      cloneExecutionState(this.executionStateByNodeId.get(task.nodeId))
    );

    try {
      const nodeApi = createNodeApi(node, {
        definition,
        widgetDefinitions: this.options.widgetRegistry,
        onSetOutputData: (slot, data) => {
          const propagatedTasks = this.collectPropagatedTasks(
            task,
            activeNodeIds,
            slot,
            data
          );

          if (!propagatedTasks.length) {
            return;
          }

          if (executionPhase.value === "sync") {
            nextTasks.push(...propagatedTasks);
            return;
          }

          this.runTaskQueue(propagatedTasks);
        }
      });

      if (shouldDispatchAction && task.propagated) {
        definition.onAction?.(
          node,
          propagatedMetadata?.targetSlotName ?? "",
          task.propagated.payload,
          createActionExecutionOptions(task, executionContext),
          nodeApi
        );
      } else {
        definition.onExecute?.(node, executionContext, nodeApi);
      }
      handled = true;
      if (!longTaskState) {
        const finishedAt = Date.now();
        this.updateExecutionState(task.nodeId, {
          status: "success",
          lastSucceededAt: finishedAt,
          clearLastErrorMessage: true,
          progress: undefined
        });
        this.emitNodeExecutionEvent(
          task,
          sequence,
          executionContext,
          cloneExecutionState(this.executionStateByNodeId.get(task.nodeId))
        );
      }
    } catch (error) {
      handled = true;
      const finishedAt = Date.now();
      const errorMessage = toExecutionErrorMessage(error);
      this.updateExecutionState(task.nodeId, {
        status: "error",
        lastFailedAt: finishedAt,
        lastErrorMessage: errorMessage,
        progress: undefined
      });
      this.emitNodeExecutionEvent(
        task,
        sequence,
        executionContext,
        cloneExecutionState(this.executionStateByNodeId.get(task.nodeId))
      );
      console.error(
        `[leafergraph] 节点 ${shouldDispatchAction ? "onAction" : "onExecute"} 执行失败: ${node.type}#${node.id}`,
        {
          context: executionContext,
          action: propagatedMetadata?.targetSlotName,
          propagation: propagatedMetadata
        },
        error
      );
      if (longTaskState && !longTaskState.finished) {
        longTaskState.finished = true;
        this.longTaskStateByNodeId.delete(task.nodeId);
      }
    }

    if (longTaskState && !longTaskState.finished) {
      executionPhase.value = "deferred";
    }

    return {
      handled,
      nextTasks
    };
  }

  /**
   * 分发节点动作。
   *
   * @param nodeId - 目标节点 ID。
   * @param action - 动作。
   * @param param - 解构后的输入参数。
   * @param options - 可选配置项。
   * @returns 分发节点动作的结果。
   */
  dispatchNodeAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): LeaferGraphDispatchNodeActionResult {
    // 先整理本轮执行所需的输入、上下文和前置约束，避免后续阶段重复分散取值。
    const safeAction = action.trim();
    if (!safeAction) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const definition = this.options.nodeRegistry.getNode(node.type);
    // 再推进核心执行或传播流程，并把结果、事件和运行态统一收口。
    if (!definition?.onAction) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    if (this.shouldSuppressNodeExecution(node)) {
      return {
        handled: false,
        nextTasks: []
      };
    }

    const widgetActionTask: LeaferGraphNodeExecutionTask = {
      nodeId,
      trigger: "direct",
      depth: 0,
      activeNodeIds: new Set<string>(),
      chain: {
        chainId: createExecutionChainId(nodeId),
        rootNodeId: nodeId,
        entryNodeId: nodeId,
        source: "node-play",
        startedAt: Date.now(),
        payload: options,
        nextSequence: 0
      }
    };
    const activeNodeIds = new Set<string>([nodeId]);
    const nextTasks: LeaferGraphNodeExecutionTask[] = [];
    const executionPhase: { value: LeaferGraphNodeExecutionPhase } = {
      value: "sync"
    };
    let executionContext!: LeaferGraphExecutionContext;
    let longTaskState: LeaferGraphLongTaskState | undefined;
    const startLongTask = (): LeaferGraphLongTaskController => {
      if (!longTaskState) {
        longTaskState = this.beginLongTaskExecution(
          widgetActionTask,
          0,
          executionContext
        );
      }

      return longTaskState.controller;
    };
    executionContext = createExecutionContext(
      widgetActionTask.chain,
      0,
      startLongTask
    );

    this.updateExecutionState(nodeId, {
      status: "running",
      runCountDelta: 1,
      lastExecutedAt: widgetActionTask.chain.startedAt,
      progress: 0
    });
    this.emitNodeExecutionEvent(
      widgetActionTask,
      0,
      executionContext,
      cloneExecutionState(this.executionStateByNodeId.get(nodeId))
    );

    try {
      definition.onAction(
        node,
        safeAction,
        param,
        createActionExecutionOptions(widgetActionTask, executionContext, options),
        createNodeApi(node, {
          definition,
          widgetDefinitions: this.options.widgetRegistry,
          onSetOutputData: (slot, data) => {
            const propagatedTasks = this.collectPropagatedTasks(
              widgetActionTask,
              activeNodeIds,
              slot,
              data
            );

            if (!propagatedTasks.length) {
              return;
            }

            if (executionPhase.value === "sync") {
              nextTasks.push(...propagatedTasks);
              return;
            }

            this.runTaskQueue(propagatedTasks);
          }
        })
      );
      if (!longTaskState) {
        const finishedAt = Date.now();
        this.updateExecutionState(nodeId, {
          status: "success",
          lastSucceededAt: finishedAt,
          clearLastErrorMessage: true,
          progress: undefined
        });
        this.emitNodeExecutionEvent(
          widgetActionTask,
          0,
          executionContext,
          cloneExecutionState(this.executionStateByNodeId.get(nodeId))
        );
      } else if (!longTaskState.finished) {
        executionPhase.value = "deferred";
      }
    } catch (error) {
      const finishedAt = Date.now();
      const errorMessage = toExecutionErrorMessage(error);
      this.updateExecutionState(nodeId, {
        status: "error",
        lastFailedAt: finishedAt,
        lastErrorMessage: errorMessage,
        progress: undefined
      });
      this.emitNodeExecutionEvent(
        widgetActionTask,
        0,
        executionContext,
        cloneExecutionState(this.executionStateByNodeId.get(nodeId))
      );
      console.error(
        `[leafergraph] 节点 onAction 执行失败: ${node.type}#${node.id}`,
        {
          context: executionContext,
          action: safeAction
        },
        error
      );
      if (longTaskState && !longTaskState.finished) {
        longTaskState.finished = true;
        this.longTaskStateByNodeId.delete(nodeId);
      }
    }

    return {
      handled: true,
      nextTasks
    };
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
    this.executionListeners.add(listener);

    return () => {
      this.executionListeners.delete(listener);
    };
  }

  /**
   * 映射外部节点执行。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void {
    const node = this.options.graphNodes.get(event.nodeId);
    if (node) {
      this.executionStateByNodeId.set(
        event.nodeId,
        cloneExecutionState(event.state)
      );
      if (event.state.status !== "running") {
        this.longTaskStateByNodeId.delete(event.nodeId);
      }

      if (
        typeof event.nodeTitle === "string" &&
        event.nodeTitle.trim().length > 0
      ) {
        node.title = event.nodeTitle;
      }
    }

    if (!this.executionListeners.size) {
      return;
    }

    const snapshot = cloneNodeExecutionEvent(event);
    for (const listener of this.executionListeners) {
      listener(snapshot);
    }
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
    this.linkPropagationListeners.add(listener);

    return () => {
      this.linkPropagationListeners.delete(listener);
    };
  }

  /**
   * 映射外部连线传播。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  projectExternalLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    const safeSourceSlot = normalizeConnectionSlot(event.sourceSlot);
    const safeTargetSlot = normalizeConnectionSlot(event.targetSlot);
    const sourceNode = this.options.graphNodes.get(event.sourceNodeId);
    const targetNode = this.options.graphNodes.get(event.targetNodeId);

    if (sourceNode) {
      writeRuntimeValue(
        sourceNode.outputValues,
        safeSourceSlot,
        cloneReadableValue(event.payload)
      );
    }

    if (targetNode) {
      if (this.shouldSuppressNodeInput(targetNode.id)) {
        return;
      }

      writeRuntimeValue(
        targetNode.inputValues,
        safeTargetSlot,
        cloneReadableValue(event.payload)
      );
    }

    if (!this.linkPropagationListeners.size) {
      return;
    }

    const snapshot = cloneLinkPropagationEvent(event);
    for (const listener of this.linkPropagationListeners) {
      listener(snapshot);
    }
  }

  /**
   * 清理节点执行状态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  clearNodeExecutionState(nodeId: string): void {
    this.executionStateByNodeId.delete(nodeId);
    this.longTaskStateByNodeId.delete(nodeId);
  }

  /**
   * 清理全部执行状态。
   *
   * @returns 无返回值。
   */
  clearAllExecutionStates(): void {
    this.executionStateByNodeId.clear();
    this.longTaskStateByNodeId.clear();
  }

  /**
   * 运行延迟任务队列。
   *
   * @param tasks - 待执行任务。
   * @returns 无返回值。
   */
  private runTaskQueue(tasks: LeaferGraphNodeExecutionTask[]): void {
    const queue = [...tasks];
    let stepIndex = 0;

    while (queue.length) {
      const task = queue.shift();
      if (!task) {
        break;
      }

      const result = this.executeExecutionTask(task, stepIndex);
      stepIndex += 1;
      queue.push(...result.nextTasks);
    }
  }

  /**
   * 启动长任务。
   *
   * @param task - 当前任务。
   * @param sequence - 当前序号。
   * @param executionContext - 当前执行上下文。
   * @returns 长任务状态。
   */
  private beginLongTaskExecution(
    task: LeaferGraphNodeExecutionTask,
    sequence: number,
    executionContext: LeaferGraphExecutionContext
  ): LeaferGraphLongTaskState {
    const existingState = this.longTaskStateByNodeId.get(task.nodeId);
    if (existingState && !existingState.finished) {
      existingState.task = task;
      existingState.sequence = sequence;
      existingState.executionContext = executionContext;
      return existingState;
    }

    const state = {
      task,
      sequence,
      executionContext,
      finished: false,
      controller: undefined as unknown as LeaferGraphLongTaskController
    };
    state.controller = {
      setProgress: (progress) => {
        this.updateLongTaskProgress(state, progress);
      },
      complete: () => {
        this.finishLongTaskExecution(state, "success");
      },
      fail: (error) => {
        this.finishLongTaskExecution(state, "error", error);
      }
    };
    this.longTaskStateByNodeId.set(task.nodeId, state);
    return state;
  }

  /**
   * 更新长任务进度。
   *
   * @param nodeId - 节点 ID。
   * @param sequence - 序号。
   * @param executionContext - 当前执行上下文。
   * @param progress - 当前进度。
   * @returns 无返回值。
   */
  private updateLongTaskProgress(
    state: LeaferGraphLongTaskState,
    progress: number
  ): void {
    const currentState = this.longTaskStateByNodeId.get(state.task.nodeId);
    if (!currentState || currentState.finished) {
      return;
    }

    this.updateExecutionState(state.task.nodeId, {
      status: "running",
      progress: clampProgress(progress)
    });
    this.emitNodeExecutionEvent(
      state.task,
      state.sequence,
      state.executionContext,
      cloneExecutionState(this.executionStateByNodeId.get(state.task.nodeId))
    );
  }

  /**
   * 结束长任务。
   *
   * @param nodeId - 节点 ID。
   * @param sequence - 序号。
   * @param executionContext - 当前执行上下文。
   * @param status - 最终状态。
   * @param error - 失败时错误。
   * @returns 无返回值。
   */
  private finishLongTaskExecution(
    state: LeaferGraphLongTaskState,
    status: "success" | "error",
    error?: unknown
  ): void {
    const currentState = this.longTaskStateByNodeId.get(state.task.nodeId);
    if (!currentState || currentState.finished) {
      return;
    }

    currentState.finished = true;
    const finishedAt = Date.now();
    if (status === "success") {
      this.updateExecutionState(state.task.nodeId, {
        status,
        lastSucceededAt: finishedAt,
        clearLastErrorMessage: true,
        progress: undefined
      });
    } else {
      this.updateExecutionState(state.task.nodeId, {
        status,
        lastFailedAt: finishedAt,
        lastErrorMessage: toExecutionErrorMessage(error),
        progress: undefined
      });
    }

    this.longTaskStateByNodeId.delete(state.task.nodeId);
    this.emitNodeExecutionEvent(
      state.task,
      state.sequence,
      state.executionContext,
      cloneExecutionState(this.executionStateByNodeId.get(state.task.nodeId))
    );
  }

  /**
   * 判断是否需要阻断当前节点执行。
   *
   * @param node - 节点。
   * @returns 无返回值。
   */
  private shouldSuppressNodeExecution(
    node: NodeRuntimeState,
    task?: LeaferGraphNodeExecutionTask
  ): boolean {
    if (this.isTimerTickTask(node.id, task)) {
      return false;
    }

    return this.shouldSuppressNodeInput(node.id);
  }

  /**
   * 判断是否需要阻断节点输入写入。
   *
   * @param nodeId - 节点 ID。
   * @returns 无返回值。
   */
  private shouldSuppressNodeInput(nodeId: string): boolean {
    const state = this.executionStateByNodeId.get(nodeId);
    if (state?.status !== "running") {
      return false;
    }

    const node = this.options.graphNodes.get(nodeId);
    return this.resolveNodeLongTaskMode(node) !== undefined;
  }

  /**
   * 判断当前任务是否为定时器回调。
   *
   * @param nodeId - 节点 ID。
   * @param task - 当前任务。
   * @returns 是否为定时器 tick。
   */
  private isTimerTickTask(
    nodeId: string,
    task: LeaferGraphNodeExecutionTask | undefined
  ): boolean {
    const payload = task?.chain.payload;
    if (!payload || typeof payload !== "object") {
      return false;
    }

    return (payload as { timerTickNodeId?: string }).timerTickNodeId === nodeId;
  }

  /**
   * 解析节点长任务显示模式。
   *
   * @param node - 节点。
   * @returns 当前模式。
   */
  private resolveNodeLongTaskMode(
    node: NodeRuntimeState | undefined
  ): LeaferGraphNodeLongTaskMode | undefined {
    const progressMode = node?.properties?.progressMode;
    return progressMode === "determinate" || progressMode === "indeterminate"
      ? progressMode
      : undefined;
  }

  /**
   * 更新执行状态。
   *
   * @param nodeId - 目标节点 ID。
   * @param input - 输入参数。
   * @returns 无返回值。
   */
  private updateExecutionState(
    nodeId: string,
    input: {
      status: LeaferGraphNodeExecutionState["status"];
      runCountDelta?: number;
      progress?: number;
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
      progress:
        input.progress !== undefined
          ? input.progress
          : input.status === "idle" ||
              input.status === "success" ||
              input.status === "error"
            ? undefined
            : prevState.progress,
      lastExecutedAt: input.lastExecutedAt ?? prevState.lastExecutedAt,
      lastSucceededAt: input.lastSucceededAt ?? prevState.lastSucceededAt,
      lastFailedAt: input.lastFailedAt ?? prevState.lastFailedAt,
      lastErrorMessage: input.clearLastErrorMessage
        ? undefined
        : input.lastErrorMessage ?? prevState.lastErrorMessage
    });
  }

  /**
   * 派发节点执行事件。
   *
   * @param task - 任务。
   * @param sequence - `sequence`。
   * @param executionContext - 当前上下文。
   * @param state - 当前状态。
   * @returns 无返回值。
   */
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
      state.status === "running"
        ? state.lastExecutedAt ?? Date.now()
        : state.status === "error"
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

  /**
   * 派发连线传播事件。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  private emitLinkPropagationEvent(
    event: LeaferGraphLinkPropagationEvent
  ): void {
    if (!this.linkPropagationListeners.size) {
      return;
    }

    for (const listener of this.linkPropagationListeners) {
      listener(event);
    }
  }

  /**
   * 收集`Propagated` 任务。
   *
   * @param task - 任务。
   * @param activeNodeIds - 活动节点 ID 列表。
   * @param sourceSlot - 来源槽位。
   * @param data - 当前数据。
   * @returns 收集`Propagated` 任务的结果。
   */
  private collectPropagatedTasks(
    task: LeaferGraphNodeExecutionTask,
    activeNodeIds: ReadonlySet<string>,
    sourceSlot: number,
    data: unknown
  ): LeaferGraphNodeExecutionTask[] {
    // 先整理本轮执行所需的输入、上下文和前置约束，避免后续阶段重复分散取值。
    const safeSourceSlot = normalizeConnectionSlot(sourceSlot);
    const nextTasks: LeaferGraphNodeExecutionTask[] = [];
    const nextNodeIds = new Set<string>();
    const sourceNode = this.options.graphNodes.get(task.nodeId);
    const sourceOutput = sourceNode?.outputs[safeSourceSlot];

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
      if (this.shouldSuppressNodeInput(targetNode.id)) {
        continue;
      }
      // 再推进核心执行或传播流程，并把结果、事件和运行态统一收口。
      const targetInput = targetNode.inputs[targetSlot];
      writeRuntimeValue(targetNode.inputValues, targetSlot, data);
      this.emitLinkPropagationEvent({
        linkId: link.id,
        chainId: task.chain.chainId,
        sourceNodeId: link.source.nodeId,
        sourceSlot: safeSourceSlot,
        targetNodeId: targetNode.id,
        targetSlot,
        payload: data,
        timestamp: Date.now()
      });

      const metadata: LeaferGraphPropagatedExecutionMetadata = {
        linkId: link.id,
        sourceNodeId: link.source.nodeId,
        sourceNodeType: sourceNode?.type ?? "",
        sourceSlot: safeSourceSlot,
        sourceSlotName: sourceOutput?.name,
        sourceSlotType: sourceOutput?.type,
        targetNodeId: targetNode.id,
        targetNodeType: targetNode.type,
        targetSlot,
        targetSlotName: targetInput?.name ?? `input_${targetSlot}`,
        targetSlotType: targetInput?.type
      };

      if (metadata.targetSlotType === "event") {
        nextTasks.push({
          nodeId: targetNode.id,
          trigger: "propagated",
          depth: task.depth + 1,
          activeNodeIds: new Set(activeNodeIds),
          chain: task.chain,
          propagated: {
            payload: data,
            metadata
          }
        });
        continue;
      }

      if (nextNodeIds.has(targetNode.id)) {
        continue;
      }

      nextNodeIds.add(targetNode.id);
      nextTasks.push({
        nodeId: targetNode.id,
        trigger: "propagated",
        depth: task.depth + 1,
        activeNodeIds: new Set(activeNodeIds),
        chain: task.chain,
        propagated: {
          payload: data,
          metadata
        }
      });
    }

    return nextTasks;
  }
}

/**
 * 创建执行链路 ID。
 *
 * @param nodeId - 目标节点 ID。
 * @returns 创建后的结果对象。
 */
function createExecutionChainId(nodeId: string): string {
  const chainId = `exec:${nodeId}:${Date.now()}:${executionChainSeed}`;
  executionChainSeed += 1;
  return chainId;
}

/**
 * 创建执行上下文。
 *
 * @param chain - 链路。
 * @param stepIndex - 步骤`Index`。
 * @returns 创建后的结果对象。
 */
function createExecutionContext(
  chain: LeaferGraphExecutionChainState,
  stepIndex: number,
  startLongTask: () => LeaferGraphLongTaskController
): LeaferGraphExecutionContext {
  return {
    source: chain.source,
    runId: chain.runId,
    entryNodeId: chain.entryNodeId,
    stepIndex,
    startedAt: chain.startedAt,
    payload: chain.payload,
    startLongTask
  };
}

/**
 * 创建动作执行选项。
 *
 * @param task - 任务。
 * @param executionContext - 当前上下文。
 * @returns 创建后的结果对象。
 */
function createActionExecutionOptions(
  task: LeaferGraphNodeExecutionTask,
  executionContext: LeaferGraphExecutionContext,
  options?: Record<string, unknown>
): LeaferGraphActionExecutionOptions {
  return {
    ...(options ?? {}),
    trigger: task.trigger,
    executionContext,
    propagation: task.propagated?.metadata
  };
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
 * 规范化进度值。
 *
 * @param progress - 进度。
 * @returns 处理后的结果。
 */
function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

/**
 * 写入运行时值。
 *
 * @param values - 值。
 * @param slot - 槽位。
 * @param data - 当前数据。
 * @returns 无返回值。
 */
function writeRuntimeValue(values: unknown[], slot: number, data: unknown): void {
  while (values.length <= slot) {
    values.push(undefined);
  }

  values[slot] = data;
}

/**
 * 克隆执行状态。
 *
 * @param state - 当前状态。
 * @returns 处理后的结果。
 */
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

/**
 * 克隆节点执行事件。
 *
 * @param event - 当前事件对象。
 * @returns 处理后的结果。
 */
function cloneNodeExecutionEvent(
  event: LeaferGraphNodeExecutionEvent
): LeaferGraphNodeExecutionEvent {
  return {
    ...event,
    executionContext: cloneReadableValue(event.executionContext),
    state: cloneExecutionState(event.state)
  };
}

/**
 * 克隆连线传播事件。
 *
 * @param event - 当前事件对象。
 * @returns 处理后的结果。
 */
function cloneLinkPropagationEvent(
  event: LeaferGraphLinkPropagationEvent
): LeaferGraphLinkPropagationEvent {
  return {
    ...event,
    payload: cloneReadableValue(event.payload)
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

/**
 * 转换为执行错误消息。
 *
 * @param error - 错误。
 * @returns 处理后的结果。
 */
function toExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "节点执行失败";
}
