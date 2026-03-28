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

  private readonly options: LeaferGraphNodeExecutionHostOptions<TNodeState>;

  constructor(options: LeaferGraphNodeExecutionHostOptions<TNodeState>) {
    this.options = options;
  }

  getNodeExecutionState(
    nodeId: string
  ): LeaferGraphNodeExecutionState | undefined {
    if (!this.options.graphNodes.has(nodeId)) {
      return undefined;
    }

    return cloneExecutionState(this.executionStateByNodeId.get(nodeId));
  }

  listNodeIdsByType(type: string): string[] {
    const nodeIds: string[] = [];

    for (const node of this.options.graphNodes.values()) {
      if (node.type === type) {
        nodeIds.push(node.id);
      }
    }

    return nodeIds;
  }

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

  executeExecutionTask(
    task: LeaferGraphNodeExecutionTask,
    stepIndex: number
  ): LeaferGraphNodeExecutionTaskResult {
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

    try {
      const nodeApi = createNodeApi(node, {
        definition,
        widgetDefinitions: this.options.widgetRegistry,
        onSetOutputData: (slot, data) => {
          nextTasks.push(
            ...this.collectPropagatedTasks(task, activeNodeIds, slot, data)
          );
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
        `[leafergraph] 节点 ${shouldDispatchAction ? "onAction" : "onExecute"} 执行失败: ${node.type}#${node.id}`,
        {
          context: executionContext,
          action: propagatedMetadata?.targetSlotName,
          propagation: propagatedMetadata
        },
        error
      );
    }

    return {
      handled,
      nextTasks
    };
  }

  dispatchNodeAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): LeaferGraphDispatchNodeActionResult {
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
    if (!definition?.onAction) {
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

    definition.onAction(
      node,
      safeAction,
      param,
      options,
      createNodeApi(node, {
        definition,
        widgetDefinitions: this.options.widgetRegistry,
        onSetOutputData: (slot, data) => {
          nextTasks.push(
            ...this.collectPropagatedTasks(
              widgetActionTask,
              activeNodeIds,
              slot,
              data
            )
          );
        }
      })
    );

    return {
      handled: true,
      nextTasks
    };
  }

  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    this.executionListeners.add(listener);

    return () => {
      this.executionListeners.delete(listener);
    };
  }

  projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void {
    const node = this.options.graphNodes.get(event.nodeId);
    if (node) {
      this.executionStateByNodeId.set(
        event.nodeId,
        cloneExecutionState(event.state)
      );

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

  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void {
    this.linkPropagationListeners.add(listener);

    return () => {
      this.linkPropagationListeners.delete(listener);
    };
  }

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

  clearNodeExecutionState(nodeId: string): void {
    this.executionStateByNodeId.delete(nodeId);
  }

  clearAllExecutionStates(): void {
    this.executionStateByNodeId.clear();
  }

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

  private collectPropagatedTasks(
    task: LeaferGraphNodeExecutionTask,
    activeNodeIds: ReadonlySet<string>,
    sourceSlot: number,
    data: unknown
  ): LeaferGraphNodeExecutionTask[] {
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

function createActionExecutionOptions(
  task: LeaferGraphNodeExecutionTask,
  executionContext: LeaferGraphExecutionContext
): LeaferGraphActionExecutionOptions {
  return {
    trigger: task.trigger,
    executionContext,
    propagation: task.propagated?.metadata
  };
}

function normalizeConnectionSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

function writeRuntimeValue(values: unknown[], slot: number, data: unknown): void {
  while (values.length <= slot) {
    values.push(undefined);
  }

  values[slot] = data;
}

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

function cloneNodeExecutionEvent(
  event: LeaferGraphNodeExecutionEvent
): LeaferGraphNodeExecutionEvent {
  return {
    ...event,
    executionContext: cloneReadableValue(event.executionContext),
    state: cloneExecutionState(event.state)
  };
}

function cloneLinkPropagationEvent(
  event: LeaferGraphLinkPropagationEvent
): LeaferGraphLinkPropagationEvent {
  return {
    ...event,
    payload: cloneReadableValue(event.payload)
  };
}

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

function toExecutionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "节点执行失败";
}
