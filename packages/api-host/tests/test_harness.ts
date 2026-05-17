import type { GraphDocument, GraphLink, NodeDefinition, NodeSerializeResult } from "@leafergraph/core/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphHistoryEvent,
  LeaferGraphInteractionActivityState,
  LeaferGraphInteractionCommitEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  LeaferGraphThemeMode,
  LeaferGraphUpdateNodeInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphCreateLinkInput,
  LeaferGraphWidgetEntry,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";
import {
  createHistoryRecordEvent,
  createLinkCreateHistoryRecord,
  createNodeWidgetHistoryRecord
} from "@leafergraph/api-host/history";
import { installLeaferGraphFacade } from "@leafergraph/api-host/facade/install";
import { LeaferGraphApiHost } from "@leafergraph/api-host";

type Listener<T> = (event: T) => void;

function createBus<T>() {
  const listeners = new Set<Listener<T>>();

  return {
    emit(event: T): void {
      for (const listener of listeners) {
        listener(structuredClone(event));
      }
    },
    subscribe(listener: Listener<T>): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy(): void {
      listeners.clear();
    }
  };
}

function createInteractionTarget(name: string, stroke?: string): {
  name: string;
  parent: null;
  on_(): void;
  off_(): void;
  stroke?: string;
} {
  return {
    name,
    parent: null,
    stroke,
    on_() {},
    off_() {}
  };
}

function resolveThemeLinkStroke(mode: LeaferGraphThemeMode): string {
  return mode === "dark" ? "#22c55e" : "#ff4d4f";
}

function syncThemeOverlay(state: TestHarnessState): void {
  let overlay = state.linkLayerChildren.find(
    (child) => child.name === "graph-link-data-flow-overlay"
  );
  if (!overlay) {
    overlay = {
      name: "graph-link-data-flow-overlay",
      children: []
    };
    state.linkLayerChildren.push(overlay);
  }

  overlay.children = state.linkViews.map((item) => ({
    name: `graph-link-data-flow-pulse-${item.linkId}`,
    stroke: item.view.stroke
  }));
}

function createNodeViewState(node: NodeSerializeResult) {
  return {
    state: node,
    view: createInteractionTarget(`node-${node.id}`),
    widgetLayer: {
      name: `widget-layer-${node.id}`
    },
    widgetInstances: [] as Array<unknown | null>
  };
}

function createGraphLink(input: LeaferGraphCreateLinkInput, fallbackSeed: number): GraphLink {
  return {
    id: input.id?.trim() || `link:${input.source.nodeId}:${input.source.slot ?? 0}->${input.target.nodeId}:${input.target.slot ?? 0}:${fallbackSeed}`,
    source: {
      nodeId: input.source.nodeId,
      slot: input.source.slot ?? 0
    },
    target: {
      nodeId: input.target.nodeId,
      slot: input.target.slot ?? 0
    },
    label: input.label,
    data: input.data ? structuredClone(input.data) : undefined
  };
}

function cloneGraphLink(link: GraphLink): GraphLink {
  return structuredClone(link);
}

function cloneNode(node: NodeSerializeResult): NodeSerializeResult {
  return structuredClone(node);
}

function snapshotNodeForComparison(node: NodeSerializeResult): unknown {
  return structuredClone({
    id: node.id,
    type: node.type,
    title: node.title,
    layout: node.layout,
    flags: node.flags,
    properties: node.properties,
    propertySpecs: node.propertySpecs,
    inputs: node.inputs,
    outputs: node.outputs,
    widgets: node.widgets,
    data: node.data
  });
}

function sameValue(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return Object.is(left, right);
  }
}

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }): boolean {
  return left.x === right.x && left.y === right.y;
}

function sameSize(left: { width: number; height: number }, right: { width: number; height: number }): boolean {
  return left.width === right.width && left.height === right.height;
}

function sameLinkEndpoints(left: Pick<GraphLink, "source" | "target">, right: Pick<GraphLink, "source" | "target">): boolean {
  return (
    left.source.nodeId === right.source.nodeId &&
    (left.source.slot ?? 0) === (right.source.slot ?? 0) &&
    left.target.nodeId === right.target.nodeId &&
    (left.target.slot ?? 0) === (right.target.slot ?? 0)
  );
}

export interface TestHarnessState {
  document: GraphDocument;
  nodes: Map<string, NodeSerializeResult>;
  links: Map<string, GraphLink>;
  nodeViews: Map<string, ReturnType<typeof createNodeViewState>>;
  linkViews: Array<{ linkId: string; view: ReturnType<typeof createInteractionTarget> }>;
  linkLayerChildren: Array<{
    name?: string;
    children?: Array<{ name?: string; stroke?: string }>;
    stroke?: string;
  }>;
  nodeDefinitions: NodeDefinition[];
  widgetDefinitions: LeaferGraphWidgetEntry[];
  selectedNodeIds: string[];
  themeMode: LeaferGraphThemeMode;
  historyEvents: LeaferGraphHistoryEvent[];
  runtimeFeedbackEvents: RuntimeFeedbackEvent[];
  interactionCommitEvents: LeaferGraphInteractionCommitEvent[];
  graphExecutionEvents: LeaferGraphGraphExecutionEvent[];
  nodeExecutionStates: Map<string, LeaferGraphNodeExecutionState>;
  nodeStateEvents: LeaferGraphNodeStateChangeEvent[];
  nodeExecutionEvents: LeaferGraphNodeExecutionEvent[];
  themeModeCalls: LeaferGraphThemeMode[];
  fitViewCalls: number[];
  createdLinks: string[];
  destroyedWidgets: Array<{ nodeId?: string; widgetCount: number }>;
  emitInteractionCommit(event: LeaferGraphInteractionCommitEvent): void;
  emitRuntimeFeedback(event: RuntimeFeedbackEvent): void;
}

export interface TestHarness {
  host: LeaferGraphApiHost<any, any, any>;
  runtime: any;
  state: TestHarnessState;
}

export interface TestGraphLayerLike {
  findId?(id: string): unknown;
  findOne?(query: { id?: string }): unknown;
  children?: unknown[];
  id?: string;
  name?: string;
}

export type TestGraphInstance = any;

export interface TestGraphHarness extends TestHarness {
  graph: TestGraphInstance;
}

export function createTestHarness(options?: {
  document?: GraphDocument;
  nodes?: NodeSerializeResult[];
  links?: GraphLink[];
  themeMode?: LeaferGraphThemeMode;
}) : TestHarness {
  const historyBus = createBus<LeaferGraphHistoryEvent>();
  const runtimeFeedbackBus = createBus<RuntimeFeedbackEvent>();
  const interactionCommitBus = createBus<LeaferGraphInteractionCommitEvent>();
  const graphExecutionBus = createBus<LeaferGraphGraphExecutionEvent>();
  const nodeStateBus = createBus<LeaferGraphNodeStateChangeEvent>();
  const nodeExecutionBus = createBus<LeaferGraphNodeExecutionEvent>();

  const emitHistoryEvent = (event: LeaferGraphHistoryEvent): void => {
    state.historyEvents.push(structuredClone(event));
    historyBus.emit(event);
  };

  const state: TestHarnessState = {
    document: structuredClone(options?.document ?? {
      documentId: "test-doc",
      revision: 1,
      appKind: "test",
      nodes: [],
      links: []
    }),
    nodes: new Map(),
    links: new Map(),
    nodeViews: new Map(),
    linkViews: [],
    linkLayerChildren: [],
    nodeDefinitions: [],
    widgetDefinitions: [],
    selectedNodeIds: [],
    themeMode: options?.themeMode ?? "light",
    historyEvents: [],
    runtimeFeedbackEvents: [],
    interactionCommitEvents: [],
    graphExecutionEvents: [],
    nodeExecutionStates: new Map(),
    nodeStateEvents: [],
    nodeExecutionEvents: [],
    themeModeCalls: [],
    fitViewCalls: [],
    createdLinks: [],
    destroyedWidgets: [],
    emitInteractionCommit(event) {
      state.interactionCommitEvents.push(structuredClone(event));
      interactionCommitBus.emit(event);
      if (event.type === "link.create.commit") {
        const link = createLink(event.input, "interaction.commit");
        emitHistoryEvent(
          createHistoryRecordEvent(
            createLinkCreateHistoryRecord({
              link,
              source: "interaction.commit"
            })
          )
        );
      }
      if (event.type === "node.widget.commit") {
        setNodeWidgetValue(event.nodeId, event.widgetIndex, event.afterValue);
        emitHistoryEvent(
          createHistoryRecordEvent(
            createNodeWidgetHistoryRecord({
              nodeId: event.nodeId,
              widgetIndex: event.widgetIndex,
              beforeValue: event.beforeValue,
              afterValue: event.afterValue,
              source: "interaction.commit"
            })!
          )
        );
      }
    },
    emitRuntimeFeedback(event) {
      state.runtimeFeedbackEvents.push(structuredClone(event));
      if (event.type === "node.execution") {
        state.nodeExecutionStates.set(event.event.nodeId, structuredClone(event.event.state ?? {}));
      }
      runtimeFeedbackBus.emit(event);
    }
  };

  for (const node of options?.nodes ?? []) {
    state.nodes.set(node.id, cloneNode(node));
    state.nodeViews.set(node.id, createNodeViewState(node));
  }
  for (const link of options?.links ?? []) {
    const cloned = cloneGraphLink(link);
    state.links.set(cloned.id, cloned);
    state.linkViews.push({
      linkId: cloned.id,
      view: createInteractionTarget(
        `graph-link-${cloned.id}`,
        resolveThemeLinkStroke(state.themeMode)
      )
    });
  }
  syncThemeOverlay(state);

  let linkSeed = 1;

  const syncDocument = () => {
    state.document = {
      ...state.document,
      nodes: [...state.nodes.values()].map((node) => cloneNode(node)),
      links: [...state.links.values()].map((link) => cloneGraphLink(link))
    };
  };

  const ensureNodeView = (node: NodeSerializeResult) => {
    const viewState = createNodeViewState(node);
    state.nodeViews.set(node.id, viewState);
    return viewState;
  };

  const removeLinkView = (linkId: string) => {
    const index = state.linkViews.findIndex((item) => item.linkId === linkId);
    if (index >= 0) {
      state.linkViews.splice(index, 1);
    }
    syncThemeOverlay(state);
  };

  const createNode = (input: LeaferGraphCreateNodeInput): NodeSerializeResult => {
    if (!input.id) {
      throw new Error("node id is required");
    }
    if (state.nodes.has(input.id)) {
      throw new Error(`节点已存在：${input.id}`);
    }
    const node: NodeSerializeResult = {
      id: input.id,
      type: input.type,
      title: input.title,
      layout: {
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height
      },
      properties: input.properties ? structuredClone(input.properties) : {},
      propertySpecs: input.propertySpecs ? structuredClone(input.propertySpecs) : [],
      inputs: input.inputs ? structuredClone(input.inputs) : [],
      outputs: input.outputs ? structuredClone(input.outputs) : [],
      widgets: input.widgets ? structuredClone(input.widgets) : [],
      data: input.data ? structuredClone(input.data) : undefined,
      flags: input.flags ? structuredClone(input.flags) : {}
    } as NodeSerializeResult;
    state.nodes.set(node.id, node);
    ensureNodeView(node);
    syncDocument();
    return cloneNode(node);
  };

  const updateNode = (nodeId: string, input: LeaferGraphUpdateNodeInput): NodeSerializeResult | undefined => {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }
    if (input.title !== undefined) {
      node.title = input.title;
    }
    if (input.x !== undefined) {
      node.layout.x = input.x;
    }
    if (input.y !== undefined) {
      node.layout.y = input.y;
    }
    if (input.width !== undefined) {
      node.layout.width = input.width;
    }
    if (input.height !== undefined) {
      node.layout.height = input.height;
    }
    if (input.properties !== undefined) {
      node.properties = { ...node.properties, ...structuredClone(input.properties) };
    }
    if (input.propertySpecs !== undefined) {
      node.propertySpecs = structuredClone(input.propertySpecs);
    }
    if (input.inputs !== undefined) {
      node.inputs = structuredClone(input.inputs);
    }
    if (input.outputs !== undefined) {
      node.outputs = structuredClone(input.outputs);
    }
    if (input.widgets !== undefined) {
      node.widgets = structuredClone(input.widgets);
    }
    if (input.data !== undefined) {
      node.data = input.data ? structuredClone(input.data) : undefined;
    }
    if (input.flags !== undefined) {
      node.flags = { ...node.flags, ...structuredClone(input.flags) };
    }
    const view = state.nodeViews.get(nodeId);
    if (view) {
      view.state = node;
    }
    syncDocument();
    return cloneNode(node);
  };

  const moveNode = (nodeId: string, position: LeaferGraphMoveNodeInput): NodeSerializeResult | undefined => {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }
    node.layout.x = position.x;
    node.layout.y = position.y;
    const view = state.nodeViews.get(nodeId);
    if (view) {
      view.state = node;
      view.view.name = `node-${nodeId}`;
    }
    syncDocument();
    return cloneNode(node);
  };

  const resizeNode = (nodeId: string, size: LeaferGraphResizeNodeInput): NodeSerializeResult | undefined => {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }
    if (size.width !== undefined) {
      node.layout.width = size.width;
    }
    if (size.height !== undefined) {
      node.layout.height = size.height;
    }
    syncDocument();
    return cloneNode(node);
  };

  const setNodeCollapsed = (nodeId: string, collapsed: boolean): boolean => {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    const nextCollapsed = Boolean(collapsed);
    const before = Boolean(node.flags?.collapsed);
    if (before === nextCollapsed) {
      return false;
    }
    node.flags = { ...(node.flags ?? {}), collapsed: nextCollapsed };
    syncDocument();
    return true;
  };

  const setNodeWidgetValue = (nodeId: string, widgetIndex: number, newValue: unknown): boolean => {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    const widget = node.widgets?.[widgetIndex];
    if (!widget) {
      return false;
    }
    if (sameValue(widget.value, newValue)) {
      return false;
    }
    widget.value = structuredClone(newValue);
    syncDocument();
    return true;
  };

  const renameNode = (nodeId: string, newTitle: string): void => {
    const node = state.nodes.get(nodeId);
    if (!node) {
      return;
    }
    node.title = newTitle;
    syncDocument();
  };

  const findLinksByNode = (nodeId: string): GraphLink[] =>
    [...state.links.values()].filter((link) => link.source.nodeId === nodeId || link.target.nodeId === nodeId).map(cloneGraphLink);

  const getLink = (linkId: string): GraphLink | undefined => {
    const link = state.links.get(linkId);
    return link ? cloneGraphLink(link) : undefined;
  };

  const removeLink = (linkId: string): boolean => {
    const removed = state.links.delete(linkId);
    if (removed) {
      removeLinkView(linkId);
      syncDocument();
    }
    return removed;
  };

  const createLink = (input: LeaferGraphCreateLinkInput, _source?: string): GraphLink => {
    const link = createGraphLink(input, linkSeed++);
    if (state.links.has(link.id)) {
      throw new Error(`连线已存在：${link.id}`);
    }
    state.links.set(link.id, link);
    state.linkViews.push({
      linkId: link.id,
      view: createInteractionTarget(
        `graph-link-${link.id}`,
        resolveThemeLinkStroke(state.themeMode)
      )
    });
    syncThemeOverlay(state);
    state.createdLinks.push(link.id);
    syncDocument();
    return cloneGraphLink(link);
  };

  const removeNode = (nodeId: string): boolean => {
    const existed = state.nodes.delete(nodeId);
    if (!existed) {
      return false;
    }
    state.nodeViews.delete(nodeId);
    for (const link of [...state.links.values()]) {
      if (link.source.nodeId === nodeId || link.target.nodeId === nodeId) {
        state.links.delete(link.id);
        removeLinkView(link.id);
      }
    }
    syncThemeOverlay(state);
    syncDocument();
    return true;
  };

  const applyGraphOperation = (operation: GraphOperation): GraphOperationApplyResult => {
    const beforeDocument = structuredClone(state.document);
    const affectedNodeIds = new Set<string>();
    const affectedLinkIds = new Set<string>();
    let changed = false;
    let reason: string | undefined;

    switch (operation.type) {
      case "node.create": {
        const node = createNode(operation.input);
        affectedNodeIds.add(node.id);
        changed = true;
        break;
      }
      case "node.update": {
        const current = state.nodes.get(operation.nodeId);
        if (!current) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        const before = snapshotNodeForComparison(current);
        const node = updateNode(operation.nodeId, operation.input);
        const after = node ? snapshotNodeForComparison(node) : before;
        changed = !sameValue(before, after);
        reason = changed ? undefined : "节点补丁没有产生变化";
        affectedNodeIds.add(operation.nodeId);
        break;
      }
      case "node.move": {
        const node = moveNode(operation.nodeId, operation.input);
        if (!node) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        changed = !samePoint(node.layout, { x: operation.input.x, y: operation.input.y });
        affectedNodeIds.add(operation.nodeId);
        break;
      }
      case "node.resize": {
        const node = resizeNode(operation.nodeId, operation.input);
        if (!node) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        changed = !sameSize(node.layout, { width: operation.input.width ?? node.layout.width, height: operation.input.height ?? node.layout.height });
        affectedNodeIds.add(operation.nodeId);
        break;
      }
      case "node.collapse": {
        changed = setNodeCollapsed(operation.nodeId, operation.collapsed);
        if (!state.nodes.has(operation.nodeId)) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        affectedNodeIds.add(operation.nodeId);
        reason = changed ? undefined : "节点折叠状态没有变化";
        break;
      }
      case "node.widget.value.set": {
        changed = setNodeWidgetValue(operation.nodeId, operation.widgetIndex, operation.value);
        if (!state.nodes.has(operation.nodeId)) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        affectedNodeIds.add(operation.nodeId);
        reason = changed ? undefined : "节点 widget 值没有变化";
        break;
      }
      case "node.rename": {
        const node = state.nodes.get(operation.nodeId);
        if (!node) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        changed = node.title !== operation.title;
        renameNode(operation.nodeId, operation.title);
        affectedNodeIds.add(operation.nodeId);
        reason = changed ? undefined : "标题未发生变化";
        break;
      }
      case "node.remove": {
        const node = state.nodes.get(operation.nodeId);
        if (!node) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `节点不存在：${operation.nodeId}` };
        }
        const relatedLinks = findLinksByNode(operation.nodeId).map((link) => link.id);
        changed = removeNode(operation.nodeId);
        affectedNodeIds.add(operation.nodeId);
        for (const linkId of relatedLinks) {
          affectedLinkIds.add(linkId);
        }
        break;
      }
      case "link.create": {
        const link = createLink(operation.input);
        affectedNodeIds.add(link.source.nodeId);
        affectedNodeIds.add(link.target.nodeId);
        affectedLinkIds.add(link.id);
        changed = true;
        break;
      }
      case "link.remove": {
        const current = state.links.get(operation.linkId);
        if (!current) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `连线不存在：${operation.linkId}` };
        }
        changed = removeLink(operation.linkId);
        affectedNodeIds.add(current.source.nodeId);
        affectedNodeIds.add(current.target.nodeId);
        affectedLinkIds.add(operation.linkId);
        break;
      }
      case "link.reconnect": {
        const current = state.links.get(operation.linkId);
        if (!current) {
          return { accepted: false, changed: false, operation, affectedNodeIds: [], affectedLinkIds: [], reason: `连线不存在：${operation.linkId}` };
        }
        const next = {
          id: current.id,
          source: operation.input.source ?? current.source,
          target: operation.input.target ?? current.target,
          label: current.label,
          data: current.data
        } satisfies GraphLink;
        if (sameLinkEndpoints(current, next)) {
          return {
            accepted: true,
            changed: false,
            operation,
            affectedNodeIds: [current.source.nodeId, current.target.nodeId],
            affectedLinkIds: [current.id],
            reason: "连线端点没有变化",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            link: cloneGraphLink(current) as any
          } as GraphOperationApplyResult;
        }
        state.links.delete(operation.linkId);
        removeLinkView(operation.linkId);
        state.links.set(next.id, structuredClone(next));
        state.linkViews.push({ linkId: next.id, view: createInteractionTarget(`graph-link-${next.id}`) });
        affectedNodeIds.add(current.source.nodeId);
        affectedNodeIds.add(current.target.nodeId);
        affectedNodeIds.add(next.source.nodeId);
        affectedNodeIds.add(next.target.nodeId);
        affectedLinkIds.add(next.id);
        changed = true;
        break;
      }
      case "document.update": {
        const hasPatch = operation.input.appKind !== undefined || operation.input.meta !== undefined || operation.input.capabilityProfile !== undefined || operation.input.adapterBinding !== undefined;
        if (hasPatch) {
          if (operation.input.appKind !== undefined) {
            state.document.appKind = operation.input.appKind;
          }
          if (operation.input.meta !== undefined) {
            state.document.meta = operation.input.meta ? structuredClone(operation.input.meta) : undefined;
          }
          if (operation.input.capabilityProfile !== undefined) {
            state.document.capabilityProfile = operation.input.capabilityProfile ? structuredClone(operation.input.capabilityProfile) : undefined;
          }
          if (operation.input.adapterBinding !== undefined) {
            state.document.adapterBinding = operation.input.adapterBinding ? structuredClone(operation.input.adapterBinding) : undefined;
          }
        }
        changed = hasPatch;
        reason = hasPatch ? undefined : "文档根字段补丁为空";
        break;
      }
    }

    syncDocument();
    const result: GraphOperationApplyResult & { link?: GraphLink; node?: NodeSerializeResult } = {
      accepted: true,
      changed,
      operation,
      affectedNodeIds: [...affectedNodeIds],
      affectedLinkIds: [...affectedLinkIds],
      reason
    };
    // Preserve the before/after behavior for tests that inspect returned entities.
    if (operation.type === "node.create") {
      result.node = state.nodes.get((operation as Extract<GraphOperation, { type: "node.create" }>).input.id);
    }
    if (operation.type === "node.update" || operation.type === "node.move" || operation.type === "node.resize" || operation.type === "node.collapse" || operation.type === "node.rename" || operation.type === "node.remove") {
      result.node = state.nodes.get((operation as any).nodeId);
    }
    if (operation.type === "link.create" || operation.type === "link.remove" || operation.type === "link.reconnect") {
      const linkId = operation.type === "link.create" ? (operation as Extract<GraphOperation, { type: "link.create" }>).input.id : operation.linkId;
      result.link = state.links.get(linkId);
    }
    void beforeDocument;
    return result as GraphOperationApplyResult;
  };

  const runtime = {
    app: { destroy() {} },
    bootstrapRuntime: {
      async use(_plugin: LeaferGraphNodePlugin): Promise<void> {},
      installModule(_module: unknown, _options?: unknown): unknown {},
      async initialize(_options: LeaferGraphOptions): Promise<void> {},
      replaceGraphDocument(document?: LeaferGraphOptions["document"]): void {
        if (!document) {
          return;
        }
        state.document = structuredClone(document as GraphDocument);
        state.nodes.clear();
        state.links.clear();
        state.nodeViews.clear();
        state.linkViews = [];
        for (const node of document.nodes ?? []) {
          state.nodes.set(node.id, cloneNode(node));
          state.nodeViews.set(node.id, createNodeViewState(node));
        }
        for (const link of document.links ?? []) {
          const cloned = cloneGraphLink(link);
          state.links.set(cloned.id, cloned);
          state.linkViews.push({ linkId: cloned.id, view: createInteractionTarget(`graph-link-${cloned.id}`) });
        }
      },
      registerNode(definition: NodeDefinition, _options?: unknown): void {
        const index = state.nodeDefinitions.findIndex((node) => node.type === definition.type);
        if (index >= 0) {
          state.nodeDefinitions[index] = definition;
        } else {
          state.nodeDefinitions.push(definition);
        }
      },
      unregisterNode(type: string): void {
        state.nodeDefinitions = state.nodeDefinitions.filter((node) => node.type !== type);
      },
      listNodes(): NodeDefinition[] {
        return structuredClone(state.nodeDefinitions);
      },
      registerWidget(entry: LeaferGraphWidgetEntry, _options?: unknown): void {
        const index = state.widgetDefinitions.findIndex((widget) => widget.type === entry.type);
        if (index >= 0) {
          state.widgetDefinitions[index] = entry;
        } else {
          state.widgetDefinitions.push(entry);
        }
      },
      unregisterWidget(type: string): void {
        state.widgetDefinitions = state.widgetDefinitions.filter((widget) => widget.type !== type);
      },
      getWidget(type: string): LeaferGraphWidgetEntry | undefined {
        return state.widgetDefinitions.find((widget) => widget.type === type);
      },
      listWidgets(): LeaferGraphWidgetEntry[] {
        return structuredClone(state.widgetDefinitions);
      }
    },
    getGraphDocument(): GraphDocument {
      return structuredClone(state.document);
    },
    runtimeFeedbackHost: {
      subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
        return runtimeFeedbackBus.subscribe(listener);
      },
      projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void {
        state.emitRuntimeFeedback(feedback);
        if (feedback.type === "node.execution") {
          state.nodeExecutionStates.set(feedback.event.nodeId, structuredClone(feedback.event.state ?? {} as LeaferGraphNodeExecutionState));
        }
      },
      destroy(): void {
        runtimeFeedbackBus.destroy();
      }
    },
    widgetEditingManager: { destroy() {} },
    dataFlowAnimationHost: { destroy() {} },
    nodeShellHost: { destroy() {} },
    sceneRuntime: {
      setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): boolean {
        return setNodeWidgetValue(nodeId, widgetIndex, newValue);
      },
      findLinksByNode(nodeId: string): GraphLink[] {
        return findLinksByNode(nodeId);
      },
      getLink(linkId: string): GraphLink | undefined {
        return getLink(linkId);
      },
      applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult {
        return applyGraphOperation(operation);
      },
      createNode(input: LeaferGraphCreateNodeInput): NodeSerializeResult {
        return createNode(input);
      },
      removeNode(nodeId: string): boolean {
        return removeNode(nodeId);
      },
      updateNode(nodeId: string, input: LeaferGraphUpdateNodeInput): NodeSerializeResult | undefined {
        return updateNode(nodeId, input);
      },
      moveNode(nodeId: string, position: LeaferGraphMoveNodeInput): NodeSerializeResult | undefined {
        return moveNode(nodeId, position);
      },
      resizeNode(nodeId: string, size: LeaferGraphResizeNodeInput): NodeSerializeResult | undefined {
        return resizeNode(nodeId, size);
      },
      createLink(input: LeaferGraphCreateLinkInput, source?: string): GraphLink {
        return createLink(input, source);
      },
      removeLink(linkId: string): boolean {
        return removeLink(linkId);
      }
    },
    historySource: {
      emit(event: LeaferGraphHistoryEvent): void {
        emitHistoryEvent(event);
      },
      subscribe(listener: (event: LeaferGraphHistoryEvent) => void): () => void {
        return historyBus.subscribe(listener);
      },
      destroy(): void {
        historyBus.destroy();
      }
    },
    destroyHistoryCapture(): void {},
    interactionCommitSource: {
      subscribe(listener: (event: LeaferGraphInteractionCommitEvent) => void): () => void {
        return interactionCommitBus.subscribe(listener);
      }
    },
    nodeRegistry: { dispose() {} },
    widgetRegistry: { dispose() {} },
    nodeExecutionHost: { dispose() {} },
    interactionHost: {
      getInteractionActivityState(): LeaferGraphInteractionActivityState {
        return { active: false } as LeaferGraphInteractionActivityState;
      },
      subscribeInteractionActivity(listener: (state: LeaferGraphInteractionActivityState) => void): () => void {
        return () => {
          void listener;
        };
      },
      destroy(): void {}
    },
    interactionRuntime: {
      resolvePort(): LeaferGraphConnectionPortState | undefined {
        return undefined;
      },
      resolvePortAtPoint(): LeaferGraphConnectionPortState | undefined {
        return undefined;
      },
      setConnectionSourcePort(): void {},
      setConnectionCandidatePort(): void {},
      setConnectionPreview(): void {},
      clearConnectionPreview(): void {},
      canCreateLink(): LeaferGraphConnectionValidationResult {
        return { allowed: true } as LeaferGraphConnectionValidationResult;
      }
    },
    nodeRuntimeHost: {
      getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
        const node = state.nodes.get(nodeId);
        return node ? cloneNode(node) : undefined;
      },
      getNodeInspectorState(): LeaferGraphNodeInspectorState | undefined {
        return undefined;
      },
      setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
        return setNodeCollapsed(nodeId, collapsed);
      },
      getNodeResizeConstraint(): LeaferGraphNodeResizeConstraint | undefined {
        return undefined;
      },
      getNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined {
        return state.nodeExecutionStates.get(nodeId);
      },
      canResizeNode(nodeId: string): boolean {
        return state.nodes.has(nodeId);
      },
      resetNodeSize(nodeId: string): NodeSerializeResult | undefined {
        const node = state.nodes.get(nodeId);
        if (!node) {
          return undefined;
        }
        return cloneNode(node);
      },
      playFromNode(nodeId: string): boolean {
        if (!state.nodes.has(nodeId)) {
          return false;
        }
        const linkedNodeIds = findLinksByNode(nodeId).map((link) => link.target.nodeId);
        state.emitRuntimeFeedback({ type: "node.state", event: { nodeId } } as RuntimeFeedbackEvent);
        for (const targetNodeId of linkedNodeIds) {
          state.emitRuntimeFeedback({ type: "link.propagation", event: { sourceNodeId: nodeId, targetNodeId } } as RuntimeFeedbackEvent);
        }
        state.emitRuntimeFeedback({ type: "node.state", event: { nodeId, status: "finished" } } as RuntimeFeedbackEvent);
        state.emitRuntimeFeedback({ type: "node.execution", event: { nodeId, state: { status: "finished" } } } as RuntimeFeedbackEvent);
        state.nodeExecutionStates.set(nodeId, { status: "finished" } as LeaferGraphNodeExecutionState);
        return true;
      },
      subscribeNodeState(listener: (event: LeaferGraphNodeStateChangeEvent) => void): () => void {
        return nodeStateBus.subscribe(listener);
      },
      subscribeNodeExecution(listener: (event: LeaferGraphNodeExecutionEvent) => void): () => void {
        return nodeExecutionBus.subscribe(listener);
      },
      projectExternalNodeExecution(event: LeaferGraphNodeExecutionEvent): void {
        state.nodeExecutionStates.set(event.nodeId, event.state as LeaferGraphNodeExecutionState);
        nodeExecutionBus.emit(event);
      },
      projectExternalNodeState(event: LeaferGraphNodeStateChangeEvent): void {
        nodeStateBus.emit(event);
      },
      projectExternalLinkPropagation(): void {}
    },
    graphExecutionHost: {
      play(): boolean {
        state.graphExecutionEvents.push({ type: "graph.execution", state: "playing" } as LeaferGraphGraphExecutionEvent);
        return true;
      },
      step(): boolean {
        return true;
      },
      stop(): boolean {
        state.graphExecutionEvents.push({ type: "graph.execution", state: "stopped" } as LeaferGraphGraphExecutionEvent);
        return true;
      },
      getGraphExecutionState(): LeaferGraphGraphExecutionState {
        return { status: "idle" } as LeaferGraphGraphExecutionState;
      },
      subscribeGraphExecution(listener: (event: LeaferGraphGraphExecutionEvent) => void): () => void {
        return graphExecutionBus.subscribe(listener);
      },
      dispose() {},
      projectExternalGraphExecution(event: LeaferGraphGraphExecutionEvent): void {
        graphExecutionBus.emit(event);
      }
    },
    themeHost: {
      setThemeMode(mode: LeaferGraphThemeMode): void {
        state.themeMode = mode;
        state.themeModeCalls.push(mode);
        for (const item of state.linkViews) {
          item.view.stroke = resolveThemeLinkStroke(mode);
        }
        syncThemeOverlay(state);
      },
      getWidgetTheme(): unknown {
        return { mode: state.themeMode };
      }
    },
    viewHost: {
      fitView(padding: number): boolean {
        state.fitViewCalls.push(padding);
        return true;
      },
      setNodeSelected(nodeId: string, selected: boolean): boolean {
        const exists = state.selectedNodeIds.includes(nodeId);
        if (selected && !exists) {
          state.selectedNodeIds = [...state.selectedNodeIds, nodeId];
          return true;
        }
        if (!selected && exists) {
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== nodeId);
          return true;
        }
        return false;
      },
      listSelectedNodeIds(): string[] {
        return [...state.selectedNodeIds];
      },
      isNodeSelected(nodeId: string): boolean {
        return state.selectedNodeIds.includes(nodeId);
      },
      setSelectedNodeIds(nodeIds: readonly string[], mode: "replace" | "add" | "remove" = "replace"): string[] {
        if (mode === "replace") {
          state.selectedNodeIds = [...nodeIds];
        } else if (mode === "add") {
          state.selectedNodeIds = [...new Set([...state.selectedNodeIds, ...nodeIds])];
        } else {
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => !nodeIds.includes(id));
        }
        return [...state.selectedNodeIds];
      },
      clearSelectedNodes(): string[] {
        const cleared = [...state.selectedNodeIds];
        state.selectedNodeIds = [];
        return cleared;
      }
    },
    widgetHost: {
      destroyNodeWidgets(widgetInstances: Array<unknown | null>, widgetLayer: unknown): void {
        state.destroyedWidgets.push({
          widgetCount: widgetInstances.length
        });
        void widgetLayer;
      },
      dispose() {}
    }
  };

  const host = new LeaferGraphApiHost<any, any, any>({
    runtime,
    nodeViews: state.nodeViews as any,
    linkViews: state.linkViews as any
  });

  return { host, runtime, state };
}

class TestLeaferGraph {
  readonly ready = Promise.resolve();

  constructor(
    public apiHost: LeaferGraphApiHost<any, any, any>,
    public defaultFitViewPadding: number,
    public nodeLayer: TestGraphLayerLike,
    public linkLayer: TestGraphLayerLike,
    private readonly onDestroy: () => void
  ) {}

  destroy(): void {
    this.onDestroy();
  }
}

installLeaferGraphFacade(TestLeaferGraph as unknown as { prototype: object });

export function createTestGraphHarness(options?: {
  document?: GraphDocument;
  nodes?: NodeSerializeResult[];
  links?: GraphLink[];
  themeMode?: LeaferGraphThemeMode;
}): TestGraphHarness {
  const harness = createTestHarness(options);
  const findNodeLayerGraphic = (id: string) => {
    if (id.startsWith("widget-")) {
      return {
        id,
        name: id
      };
    }
    if (id.startsWith("node-")) {
      const nodeId = id.slice("node-".length);
      return harness.state.nodeViews.get(nodeId)?.view;
    }
    return undefined;
  };
  const graph = new TestLeaferGraph(
    harness.host,
    0,
    {
      findId(id: string) {
        return findNodeLayerGraphic(id);
      }
    },
    {
      findId(id: string) {
        return harness.state.linkViews.find((item) => item.linkId === id)?.view;
      },
      get children() {
        return harness.state.linkLayerChildren;
      }
    },
    () => harness.host.destroy()
  );

  return {
    ...harness,
    graph
  };
}
