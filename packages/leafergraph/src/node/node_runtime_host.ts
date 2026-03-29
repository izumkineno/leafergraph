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

  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return serializeNode(this.options.nodeRegistry, node);
  }

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

  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return this.options.resolveNodeResizeConstraint(node);
  }

  getNodeExecutionState(
    nodeId: string
  ): LeaferGraphNodeExecutionState | undefined {
    return this.nodeExecutionHost.getNodeExecutionState(nodeId);
  }

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

  canResizeNode(nodeId: string): boolean {
    return Boolean(this.getNodeResizeConstraint(nodeId)?.enabled);
  }

  canExecuteNode(nodeId: string): boolean {
    const node = this.options.graphNodes.get(nodeId);
    if (!node) {
      return false;
    }

    return Boolean(this.options.nodeRegistry.getNode(node.type)?.onExecute);
  }

  listNodeIdsByType(type: string): string[] {
    return this.nodeExecutionHost.listNodeIdsByType(type);
  }

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

  executeNode(nodeId: string, context?: unknown): boolean {
    return this.playFromNode(nodeId, context);
  }

  createEntryExecutionTask(
    nodeId: string,
    options: LeaferGraphCreateEntryExecutionTaskOptions
  ): LeaferGraphNodeExecutionTask | undefined {
    return this.nodeExecutionHost.createEntryExecutionTask(nodeId, options);
  }

  executeExecutionTask(
    task: LeaferGraphNodeExecutionTask,
    stepIndex: number
  ): LeaferGraphNodeExecutionTaskResult {
    return this.nodeExecutionHost.executeExecutionTask(task, stepIndex);
  }

  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    return this.nodeExecutionHost.subscribeNodeExecution(listener);
  }

  projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void {
    this.nodeExecutionHost.projectExternalNodeExecution(event);
  }

  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void {
    return this.nodeExecutionHost.subscribeLinkPropagation(listener);
  }

  projectExternalLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    this.nodeExecutionHost.projectExternalLinkPropagation(event);
  }

  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void {
    this.stateListeners.add(listener);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

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

  clearNodeExecutionState(nodeId: string): void {
    this.nodeExecutionHost.clearNodeExecutionState(nodeId);
  }

  clearAllExecutionStates(): void {
    this.nodeExecutionHost.clearAllExecutionStates();
  }

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

  private refreshExecutedNode(nodeId: string): void {
    const state = this.options.nodeViews.get(nodeId);
    if (state) {
      this.options.sceneRuntime.refreshNodeView(state);
    }

    this.options.sceneRuntime.updateConnectedLinks(nodeId);
    this.options.sceneRuntime.requestRender();
  }

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

function normalizeConnectionSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

function cloneNodeStateEvent(
  event: LeaferGraphNodeStateChangeEvent
): LeaferGraphNodeStateChangeEvent {
  return {
    ...event
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
