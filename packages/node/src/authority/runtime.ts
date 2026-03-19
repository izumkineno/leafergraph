import { isDeepStrictEqual } from "node:util";

import type {
  AdapterBinding,
  CapabilityProfile,
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint
} from "../graph.js";
import type { NodeSerializeResult, NodeSlotSpec } from "../types.js";
import type {
  AuthorityCreateLinkInput,
  AuthorityCreateNodeInput,
  AuthorityGraphExecutionEventType,
  AuthorityGraphExecutionState,
  AuthorityGraphOperation,
  AuthorityNodeExecutionEvent,
  AuthorityNodeExecutionState,
  AuthorityNodeStateChangeReason,
  AuthorityOperationResult,
  AuthorityRuntimeControlRequest,
  AuthorityRuntimeControlResult,
  AuthorityRuntimeFeedbackEvent,
  AuthorityUpdateDocumentInput
} from "./protocol.js";

export interface CreateNodeAuthorityRuntimeOptions {
  initialDocument?: GraphDocument;
  authorityName?: string;
}

export interface NodeAuthorityRuntime {
  getDocument(): GraphDocument;
  submitOperation(operation: AuthorityGraphOperation): AuthorityOperationResult;
  controlRuntime(
    request: AuthorityRuntimeControlRequest
  ): AuthorityRuntimeControlResult;
  replaceDocument(document: GraphDocument): GraphDocument;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  subscribe(listener: (event: AuthorityRuntimeFeedbackEvent) => void): () => void;
}

interface AuthorityGraphPlayRun {
  runId: string;
  startedAt: number;
  queue: string[];
  stepCount: number;
  timer: ReturnType<typeof setTimeout> | null;
}

interface ExecuteNodeChainOptions {
  rootNodeId: string;
  source: "node-play" | "graph-play" | "graph-step";
  runId?: string;
  startedAt: number;
}

let graphRunSeed = 1;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createDefaultAuthorityDocument(): GraphDocument {
  return {
    documentId: "node-authority-doc",
    revision: "1",
    appKind: "node-authority-demo",
    nodes: [
      {
        id: "node-1",
        type: "demo.pending",
        title: "Node 1",
        layout: { x: 0, y: 0, width: 240, height: 140 },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [],
        widgets: [],
        data: {}
      },
      {
        id: "node-2",
        type: "demo.pending",
        title: "Node 2",
        layout: { x: 320, y: 0, width: 240, height: 140 },
        flags: {},
        properties: {},
        propertySpecs: [],
        inputs: [],
        outputs: [],
        widgets: [],
        data: {}
      }
    ],
    links: [
      {
        id: "link-1",
        source: { nodeId: "node-1", slot: 0 },
        target: { nodeId: "node-2", slot: 0 }
      }
    ],
    meta: {}
  };
}

function nextRevision(revision: GraphDocument["revision"]): GraphDocument["revision"] {
  if (typeof revision === "number") {
    return revision + 1;
  }

  const numericRevision = Number(revision);
  if (Number.isFinite(numericRevision)) {
    return String(numericRevision + 1);
  }

  return `${revision}#1`;
}

function toNodeSlotSpecs(
  slots?: AuthorityCreateNodeInput["inputs"]
): NodeSlotSpec[] | undefined {
  if (!slots) {
    return undefined;
  }

  return slots.map((slot) => (typeof slot === "string" ? { name: slot } : clone(slot)));
}

function createNodeFromInput(
  input: AuthorityCreateNodeInput,
  nextNodeId: () => string
): NodeSerializeResult {
  return {
    id: input.id ?? nextNodeId(),
    type: input.type,
    title: input.title ?? input.type,
    layout: {
      x: input.x,
      y: input.y,
      width: input.width ?? 240,
      height: input.height ?? 140
    },
    flags: clone(input.flags ?? {}),
    properties: clone(input.properties ?? {}),
    propertySpecs: clone(input.propertySpecs ?? []),
    inputs: toNodeSlotSpecs(input.inputs) ?? [],
    outputs: toNodeSlotSpecs(input.outputs) ?? [],
    widgets: clone(input.widgets ?? []),
    data: clone(input.data ?? {})
  };
}

function createLinkFromInput(
  input: AuthorityCreateLinkInput,
  nextLinkId: () => string
): GraphLink {
  return {
    id: input.id ?? nextLinkId(),
    source: clone(input.source),
    target: clone(input.target),
    label: input.label,
    data: input.data ? clone(input.data) : undefined
  };
}

function normalizeLinkEndpoint(endpoint: GraphLinkEndpoint): GraphLinkEndpoint {
  return {
    nodeId: endpoint.nodeId,
    slot: endpoint.slot ?? 0
  };
}

function cloneOptionalRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  return value ? clone(value) : undefined;
}

function cloneOptionalCapabilityProfile(
  value: CapabilityProfile | null | undefined
): CapabilityProfile | undefined {
  return value === null || value === undefined ? undefined : clone(value);
}

function cloneOptionalAdapterBinding(
  value: AdapterBinding | null | undefined
): AdapterBinding | undefined {
  return value === null || value === undefined ? undefined : clone(value);
}

function patchDocumentRoot(
  document: GraphDocument,
  input: AuthorityUpdateDocumentInput
): GraphDocument {
  return {
    ...document,
    appKind: input.appKind ?? document.appKind,
    meta:
      input.meta !== undefined ? clone(input.meta) : cloneOptionalRecord(document.meta),
    capabilityProfile:
      input.capabilityProfile !== undefined
        ? cloneOptionalCapabilityProfile(input.capabilityProfile)
        : cloneOptionalCapabilityProfile(document.capabilityProfile),
    adapterBinding:
      input.adapterBinding !== undefined
        ? cloneOptionalAdapterBinding(input.adapterBinding)
        : cloneOptionalAdapterBinding(document.adapterBinding)
  };
}

function createIdleGraphExecutionState(): AuthorityGraphExecutionState {
  return { status: "idle", queueSize: 0, stepCount: 0 };
}

function cloneGraphExecutionState(
  state: AuthorityGraphExecutionState
): AuthorityGraphExecutionState {
  return { ...state };
}

function createGraphRunId(source: "graph-play" | "graph-step"): string {
  const runId = `graph:${source}:${Date.now()}:${graphRunSeed}`;
  graphRunSeed += 1;
  return runId;
}

function resolveValidatedLinkEndpoint(
  document: GraphDocument,
  endpoint: GraphLinkEndpoint,
  label: "source" | "target"
): { accepted: boolean; endpoint?: GraphLinkEndpoint; reason?: string } {
  const nodeId = endpoint.nodeId?.trim();
  if (!nodeId) {
    return { accepted: false, reason: `${label} 节点不能为空` };
  }

  const slot = endpoint.slot ?? 0;
  if (!Number.isInteger(slot) || slot < 0) {
    return { accepted: false, reason: `${label} slot 必须是非负整数` };
  }

  const node = document.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return { accepted: false, reason: `${label} 节点不存在` };
  }

  const slots = (label === "source" ? node.outputs : node.inputs) ?? [];
  if (!slots[slot]) {
    return { accepted: false, reason: `${label} 端点不存在` };
  }

  return { accepted: true, endpoint: { nodeId, slot } };
}

export function createNodeAuthorityRuntime(
  options: CreateNodeAuthorityRuntimeOptions = {}
): NodeAuthorityRuntime {
  const authorityName = options.authorityName ?? "node-authority";
  const documentListeners = new Set<(document: GraphDocument) => void>();
  const runtimeFeedbackListeners = new Set<
    (event: AuthorityRuntimeFeedbackEvent) => void
  >();
  const nodeExecutionStateMap = new Map<string, AuthorityNodeExecutionState>();
  let generatedNodeSequence = 0;
  let generatedLinkSequence = 0;
  let currentDocument = clone(options.initialDocument ?? createDefaultAuthorityDocument());
  let graphExecutionState = createIdleGraphExecutionState();
  let activeGraphPlayRun: AuthorityGraphPlayRun | null = null;
  let stepCursor = 0;

  const emitRuntimeFeedback = (event: AuthorityRuntimeFeedbackEvent): void => {
    const snapshot = clone(event);
    for (const listener of runtimeFeedbackListeners) {
      listener(snapshot);
    }
  };

  const emitDocument = (): void => {
    const snapshot = clone(currentDocument);
    for (const listener of documentListeners) {
      listener(snapshot);
    }
  };

  const hasNodeId = (nodeId: string): boolean =>
    currentDocument.nodes.some((node) => node.id === nodeId);
  const hasLinkId = (linkId: string): boolean =>
    currentDocument.links.some((link) => link.id === linkId);

  const resolveGeneratedNodeId = (): string => {
    do {
      generatedNodeSequence += 1;
    } while (hasNodeId(`${authorityName}-node-${generatedNodeSequence}`));

    return `${authorityName}-node-${generatedNodeSequence}`;
  };

  const resolveGeneratedLinkId = (): string => {
    do {
      generatedLinkSequence += 1;
    } while (hasLinkId(`${authorityName}-link-${generatedLinkSequence}`));

    return `${authorityName}-link-${generatedLinkSequence}`;
  };

  const getNode = (nodeId: string) =>
    currentDocument.nodes.find((node) => node.id === nodeId) ?? null;
  const getLink = (linkId: string) =>
    currentDocument.links.find((link) => link.id === linkId) ?? null;

  const createCurrentSnapshotResult = (
    overrides: Partial<AuthorityOperationResult>
  ): AuthorityOperationResult => ({
    accepted: true,
    changed: false,
    revision: currentDocument.revision,
    document: clone(currentDocument),
    ...overrides
  });

  const commitDocument = (nextDocument: GraphDocument): void => {
    currentDocument = nextDocument;
    emitDocument();
  };

  const stopActiveGraphPlayWithoutEvent = (): void => {
    if (!activeGraphPlayRun) {
      return;
    }

    if (activeGraphPlayRun.timer !== null) {
      clearTimeout(activeGraphPlayRun.timer);
    }
    activeGraphPlayRun = null;
  };

  const resetDocumentCaches = (): void => {
    generatedNodeSequence = 0;
    generatedLinkSequence = 0;
    stopActiveGraphPlayWithoutEvent();
    nodeExecutionStateMap.clear();
    graphExecutionState = createIdleGraphExecutionState();
    stepCursor = 0;
  };

  const emitNodeState = (
    nodeId: string,
    reason: AuthorityNodeStateChangeReason,
    exists: boolean
  ): void => {
    emitRuntimeFeedback({
      type: "node.state",
      event: {
        nodeId,
        exists,
        reason,
        timestamp: Date.now()
      }
    });
  };

  const emitLinkPropagation = (
    link: GraphLink,
    source: "node-play" | "graph-play" | "graph-step",
    chainId: string
  ): void => {
    emitRuntimeFeedback({
      type: "link.propagation",
      event: {
        linkId: link.id,
        chainId,
        sourceNodeId: link.source.nodeId,
        sourceSlot: link.source.slot ?? 0,
        targetNodeId: link.target.nodeId,
        targetSlot: link.target.slot ?? 0,
        payload: {
          authority: authorityName,
          source
        },
        timestamp: Date.now()
      }
    });
  };

  const emitGraphExecution = (
    type: AuthorityGraphExecutionEventType,
    input: {
      runId?: string;
      source?: "graph-play" | "graph-step";
      nodeId?: string;
      timestamp: number;
    }
  ): void => {
    emitRuntimeFeedback({
      type: "graph.execution",
      event: {
        type,
        state: cloneGraphExecutionState(graphExecutionState),
        runId: input.runId,
        source: input.source,
        nodeId: input.nodeId,
        timestamp: input.timestamp
      }
    });
  };

  const advanceNodeExecutionState = (
    nodeId: string,
    timestamp: number
  ): AuthorityNodeExecutionState => {
    const previousState = nodeExecutionStateMap.get(nodeId) ?? {
      status: "idle",
      runCount: 0
    };
    const nextState: AuthorityNodeExecutionState = {
      status: "success",
      runCount: previousState.runCount + 1,
      lastExecutedAt: timestamp,
      lastSucceededAt: timestamp,
      lastFailedAt: previousState.lastFailedAt,
      lastErrorMessage: previousState.lastErrorMessage
    };
    nodeExecutionStateMap.set(nodeId, nextState);
    return clone(nextState);
  };

  const emitNodeExecution = (
    rootNode: NodeSerializeResult,
    node: NodeSerializeResult,
    input: {
      source: "node-play" | "graph-play" | "graph-step";
      runId?: string;
      chainId: string;
      depth: number;
      sequence: number;
      trigger: "direct" | "propagated";
      startedAt: number;
      timestamp: number;
    }
  ): void => {
    const state = advanceNodeExecutionState(node.id, input.timestamp);
    const event: AuthorityNodeExecutionEvent = {
      chainId: input.chainId,
      rootNodeId: rootNode.id,
      rootNodeType: rootNode.type,
      rootNodeTitle: rootNode.title ?? rootNode.id,
      nodeId: node.id,
      nodeType: node.type,
      nodeTitle: node.title ?? node.id,
      depth: input.depth,
      sequence: input.sequence,
      source: input.source,
      trigger: input.trigger,
      timestamp: input.timestamp,
      executionContext: {
        source: input.source,
        runId: input.runId,
        entryNodeId: rootNode.id,
        stepIndex: input.sequence,
        startedAt: input.startedAt,
        payload: {
          authority: authorityName
        }
      },
      state
    };

    emitRuntimeFeedback({
      type: "node.execution",
      event
    });
    emitNodeState(node.id, "execution", true);
  };

  const executeNodeChain = (input: ExecuteNodeChainOptions): boolean => {
    const rootNode = getNode(input.rootNodeId);
    if (!rootNode) {
      return false;
    }

    const chainId = `${authorityName}:${input.source}:${rootNode.id}:${input.startedAt}`;
    const visited = new Set<string>();
    let sequence = 0;

    const walk = (
      nodeId: string,
      depth: number,
      trigger: "direct" | "propagated"
    ): void => {
      if (visited.has(nodeId)) {
        return;
      }

      const node = getNode(nodeId);
      if (!node) {
        return;
      }

      visited.add(nodeId);
      const currentSequence = sequence;
      sequence += 1;
      emitNodeExecution(rootNode, node, {
        source: input.source,
        runId: input.runId,
        chainId,
        depth,
        sequence: currentSequence,
        trigger,
        startedAt: input.startedAt,
        timestamp: Date.now()
      });

      for (const link of currentDocument.links) {
        if (link.source.nodeId !== nodeId || !getNode(link.target.nodeId)) {
          continue;
        }

        emitLinkPropagation(link, input.source, chainId);
        walk(link.target.nodeId, depth + 1, "propagated");
      }
    };

    walk(rootNode.id, 0, "direct");
    return true;
  };

  const finalizeGraphPlayRun = (
    run: AuthorityGraphPlayRun,
    type: "drained" | "stopped"
  ): void => {
    if (activeGraphPlayRun?.runId !== run.runId) {
      return;
    }

    if (run.timer !== null) {
      clearTimeout(run.timer);
    }
    activeGraphPlayRun = null;
    const timestamp = Date.now();
    graphExecutionState = {
      status: "idle",
      queueSize: 0,
      stepCount: run.stepCount,
      startedAt: run.startedAt,
      stoppedAt: timestamp,
      lastSource: "graph-play"
    };
    emitGraphExecution(type, {
      runId: run.runId,
      source: "graph-play",
      timestamp
    });
  };

  const scheduleNextGraphPlayRunTick = (): void => {
    const run = activeGraphPlayRun;
    if (!run) {
      return;
    }

    run.timer = setTimeout(() => {
      const activeRun = activeGraphPlayRun;
      if (!activeRun || activeRun.runId !== run.runId) {
        return;
      }

      const rootNodeId = activeRun.queue.shift();
      if (!rootNodeId) {
        finalizeGraphPlayRun(activeRun, "drained");
        return;
      }

      executeNodeChain({
        rootNodeId,
        source: "graph-play",
        runId: activeRun.runId,
        startedAt: activeRun.startedAt
      });
      activeRun.stepCount += 1;

      const timestamp = Date.now();
      const hasMore = activeRun.queue.length > 0;
      graphExecutionState = {
        status: hasMore ? "running" : "idle",
        runId: hasMore ? activeRun.runId : undefined,
        queueSize: activeRun.queue.length,
        stepCount: activeRun.stepCount,
        startedAt: activeRun.startedAt,
        stoppedAt: hasMore ? undefined : timestamp,
        lastSource: "graph-play"
      };
      emitGraphExecution("advanced", {
        runId: activeRun.runId,
        source: "graph-play",
        nodeId: rootNodeId,
        timestamp
      });

      if (hasMore) {
        scheduleNextGraphPlayRunTick();
        return;
      }

      finalizeGraphPlayRun(activeRun, "drained");
    }, 0);
  };

  const collectRootNodeIds = (): string[] =>
    currentDocument.nodes
      .map((node) => node.id)
      .filter((nodeId) => Boolean(getNode(nodeId)));

  const createRuntimeControlResult = (
    overrides: Partial<AuthorityRuntimeControlResult>
  ): AuthorityRuntimeControlResult => ({
    accepted: true,
    changed: false,
    state: cloneGraphExecutionState(graphExecutionState),
    ...overrides
  });

  return {
    getDocument(): GraphDocument {
      return clone(currentDocument);
    },

    submitOperation(operation: AuthorityGraphOperation): AuthorityOperationResult {
      switch (operation.type) {
        case "document.update": {
          const nextDocument = patchDocumentRoot(currentDocument, operation.input);
          if (isDeepStrictEqual(currentDocument, nextDocument)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...nextDocument,
            revision: nextRevision(currentDocument.revision)
          });
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.create": {
          const nextNode = createNodeFromInput(operation.input, resolveGeneratedNodeId);
          const previousNode = getNode(nextNode.id);
          if (previousNode && isDeepStrictEqual(previousNode, nextNode)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: [...currentDocument.nodes.filter((node) => node.id !== nextNode.id), nextNode]
          });
          emitNodeState(nextNode.id, "created", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.update": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return {
              accepted: false,
              changed: false,
              reason: "节点不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const nextNode: NodeSerializeResult = {
            ...node,
            title: operation.input.title ?? node.title,
            layout: {
              ...node.layout,
              x: operation.input.x ?? node.layout.x,
              y: operation.input.y ?? node.layout.y,
              width: operation.input.width ?? node.layout.width,
              height: operation.input.height ?? node.layout.height
            },
            properties:
              operation.input.properties !== undefined
                ? clone(operation.input.properties)
                : node.properties,
            propertySpecs:
              operation.input.propertySpecs !== undefined
                ? clone(operation.input.propertySpecs)
                : node.propertySpecs,
            inputs:
              operation.input.inputs !== undefined
                ? toNodeSlotSpecs(operation.input.inputs)
                : node.inputs,
            outputs:
              operation.input.outputs !== undefined
                ? toNodeSlotSpecs(operation.input.outputs)
                : node.outputs,
            widgets:
              operation.input.widgets !== undefined
                ? clone(operation.input.widgets)
                : node.widgets,
            data:
              operation.input.data !== undefined ? clone(operation.input.data) : node.data,
            flags:
              operation.input.flags !== undefined
                ? {
                    ...node.flags,
                    ...clone(operation.input.flags)
                  }
                : node.flags
          };
          if (isDeepStrictEqual(node, nextNode)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId ? nextNode : item
            )
          });
          emitNodeState(operation.nodeId, "updated", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.move": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return {
              accepted: false,
              changed: false,
              reason: "节点不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }
          if (node.layout.x === operation.input.x && node.layout.y === operation.input.y) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId
                ? {
                    ...item,
                    layout: {
                      ...item.layout,
                      x: operation.input.x,
                      y: operation.input.y
                    }
                  }
                : item
            )
          });
          emitNodeState(operation.nodeId, "moved", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.resize": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return {
              accepted: false,
              changed: false,
              reason: "节点不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }
          if (
            node.layout.width === operation.input.width &&
            node.layout.height === operation.input.height
          ) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId
                ? {
                    ...item,
                    layout: {
                      ...item.layout,
                      width: operation.input.width,
                      height: operation.input.height
                    }
                  }
                : item
            )
          });
          emitNodeState(operation.nodeId, "resized", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.remove": {
          const node = getNode(operation.nodeId);
          if (!node) {
            return createCurrentSnapshotResult({ reason: "节点不存在" });
          }

          const relatedLinks = currentDocument.links.filter(
            (link) =>
              link.source.nodeId === operation.nodeId ||
              link.target.nodeId === operation.nodeId
          );
          const affectedNodeIds = new Set<string>();
          for (const link of relatedLinks) {
            if (link.source.nodeId !== operation.nodeId) {
              affectedNodeIds.add(link.source.nodeId);
            }
            if (link.target.nodeId !== operation.nodeId) {
              affectedNodeIds.add(link.target.nodeId);
            }
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.filter((item) => item.id !== operation.nodeId),
            links: currentDocument.links.filter(
              (link) =>
                link.source.nodeId !== operation.nodeId &&
                link.target.nodeId !== operation.nodeId
            )
          });
          nodeExecutionStateMap.delete(operation.nodeId);
          emitNodeState(operation.nodeId, "removed", false);
          for (const nodeId of affectedNodeIds) {
            if (getNode(nodeId)) {
              emitNodeState(nodeId, "connections", true);
            }
          }
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.create": {
          const sourceResolution = resolveValidatedLinkEndpoint(
            currentDocument,
            operation.input.source,
            "source"
          );
          if (!sourceResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: sourceResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const targetResolution = resolveValidatedLinkEndpoint(
            currentDocument,
            operation.input.target,
            "target"
          );
          if (!targetResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: targetResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const nextLink = createLinkFromInput(
            {
              ...operation.input,
              source: sourceResolution.endpoint!,
              target: targetResolution.endpoint!
            },
            resolveGeneratedLinkId
          );
          const previousLink = getLink(nextLink.id);
          if (previousLink && isDeepStrictEqual(previousLink, nextLink)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: [...currentDocument.links.filter((link) => link.id !== nextLink.id), nextLink]
          });
          emitNodeState(nextLink.source.nodeId, "connections", true);
          emitNodeState(nextLink.target.nodeId, "connections", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.remove": {
          const removedLink = getLink(operation.linkId);
          if (!removedLink) {
            return createCurrentSnapshotResult({ reason: "连线不存在" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: currentDocument.links.filter((link) => link.id !== operation.linkId)
          });
          emitNodeState(removedLink.source.nodeId, "connections", true);
          emitNodeState(removedLink.target.nodeId, "connections", true);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.reconnect": {
          const link = getLink(operation.linkId);
          if (!link) {
            return {
              accepted: false,
              changed: false,
              reason: "连线不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const sourceResolution = operation.input.source
            ? resolveValidatedLinkEndpoint(currentDocument, operation.input.source, "source")
            : { accepted: true as const, endpoint: normalizeLinkEndpoint(link.source) };
          if (!sourceResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: sourceResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const targetResolution = operation.input.target
            ? resolveValidatedLinkEndpoint(currentDocument, operation.input.target, "target")
            : { accepted: true as const, endpoint: normalizeLinkEndpoint(link.target) };
          if (!targetResolution.accepted) {
            return {
              accepted: false,
              changed: false,
              reason: targetResolution.reason,
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

          const nextLink: GraphLink = {
            ...link,
            source: sourceResolution.endpoint!,
            target: targetResolution.endpoint!
          };
          if (isDeepStrictEqual(link, nextLink)) {
            return createCurrentSnapshotResult({ reason: "文档无变化" });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: currentDocument.links.map((item) =>
              item.id === operation.linkId ? nextLink : item
            )
          });
          const affectedNodeIds = new Set([
            link.source.nodeId,
            link.target.nodeId,
            nextLink.source.nodeId,
            nextLink.target.nodeId
          ]);
          for (const nodeId of affectedNodeIds) {
            if (getNode(nodeId)) {
              emitNodeState(nodeId, "connections", true);
            }
          }
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
      }
    },

    controlRuntime(request: AuthorityRuntimeControlRequest): AuthorityRuntimeControlResult {
      switch (request.type) {
        case "node.play": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({
              accepted: false,
              reason: "图级运行中，无法从单节点开始运行"
            });
          }

          const changed = executeNodeChain({
            rootNodeId: request.nodeId,
            source: "node-play",
            startedAt: Date.now()
          });
          return createRuntimeControlResult({
            accepted: changed,
            changed,
            reason: changed ? undefined : "节点不存在"
          });
        }
        case "graph.play": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({ reason: "图已在运行中" });
          }

          const queue = collectRootNodeIds();
          if (!queue.length) {
            return createRuntimeControlResult({ reason: "图中没有可执行节点" });
          }

          const startedAt = Date.now();
          const runId = createGraphRunId("graph-play");
          activeGraphPlayRun = {
            runId,
            startedAt,
            queue,
            stepCount: 0,
            timer: null
          };
          graphExecutionState = {
            status: "running",
            runId,
            queueSize: queue.length,
            stepCount: 0,
            startedAt,
            lastSource: "graph-play"
          };
          stepCursor = 0;
          emitGraphExecution("started", {
            runId,
            source: "graph-play",
            timestamp: startedAt
          });
          scheduleNextGraphPlayRunTick();
          return createRuntimeControlResult({ changed: true });
        }
        case "graph.step": {
          if (activeGraphPlayRun) {
            return createRuntimeControlResult({
              accepted: false,
              reason: "图级运行中，无法单步推进"
            });
          }

          const rootNodeIds = collectRootNodeIds();
          if (!rootNodeIds.length) {
            return createRuntimeControlResult({ reason: "图中没有可执行节点" });
          }

          if (stepCursor >= rootNodeIds.length) {
            stepCursor = 0;
          }
          const rootNodeId = rootNodeIds[stepCursor];
          stepCursor = (stepCursor + 1) % rootNodeIds.length;
          const startedAt = Date.now();
          const runId = createGraphRunId("graph-step");
          graphExecutionState = {
            status: "stepping",
            runId,
            queueSize: 1,
            stepCount: 0,
            startedAt,
            lastSource: "graph-step"
          };
          emitGraphExecution("started", {
            runId,
            source: "graph-step",
            timestamp: startedAt
          });

          const changed = executeNodeChain({
            rootNodeId,
            source: "graph-step",
            runId,
            startedAt
          });
          const timestamp = Date.now();
          graphExecutionState = {
            status: "idle",
            queueSize: 0,
            stepCount: changed ? 1 : 0,
            startedAt,
            stoppedAt: timestamp,
            lastSource: "graph-step"
          };
          emitGraphExecution("advanced", {
            runId,
            source: "graph-step",
            nodeId: rootNodeId,
            timestamp
          });
          emitGraphExecution("drained", {
            runId,
            source: "graph-step",
            timestamp: Date.now()
          });
          return createRuntimeControlResult({
            changed,
            reason: changed ? undefined : "节点不存在"
          });
        }
        case "graph.stop": {
          if (!activeGraphPlayRun) {
            return createRuntimeControlResult({ reason: "当前没有活动中的图运行" });
          }

          finalizeGraphPlayRun(activeGraphPlayRun, "stopped");
          return createRuntimeControlResult({ changed: true });
        }
      }
    },

    replaceDocument(document: GraphDocument): GraphDocument {
      currentDocument = clone(document);
      resetDocumentCaches();
      emitDocument();
      return clone(currentDocument);
    },

    subscribeDocument(listener: (document: GraphDocument) => void): () => void {
      documentListeners.add(listener);
      return () => {
        documentListeners.delete(listener);
      };
    },

    subscribe(listener: (event: AuthorityRuntimeFeedbackEvent) => void): () => void {
      runtimeFeedbackListeners.add(listener);
      return () => {
        runtimeFeedbackListeners.delete(listener);
      };
    }
  };
}
