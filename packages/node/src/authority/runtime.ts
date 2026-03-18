import type {
  GraphDocument,
  GraphLink
} from "../graph.js";
import type {
  NodeSerializeResult,
  NodeSlotSpec
} from "../types.js";
import type {
  AuthorityCreateNodeInput,
  AuthorityCreateLinkInput,
  AuthorityGraphOperation,
  AuthorityNodeStateChangeReason,
  AuthorityOperationResult,
  AuthorityRuntimeFeedbackEvent
} from "./protocol.js";

/** Node authority runtime 的最小创建参数。 */
export interface CreateNodeAuthorityRuntimeOptions {
  /** 初始图文档；未提供时使用内置 demo 文档。 */
  initialDocument?: GraphDocument;
  /** authority 名称，用于反馈事件与生成 ID。 */
  authorityName?: string;
}

/** Node authority runtime 对外暴露的最小能力。 */
export interface NodeAuthorityRuntime {
  getDocument(): GraphDocument;
  submitOperation(operation: AuthorityGraphOperation): AuthorityOperationResult;
  replaceDocument(document: GraphDocument): GraphDocument;
  subscribeDocument(listener: (document: GraphDocument) => void): () => void;
  subscribe(listener: (event: AuthorityRuntimeFeedbackEvent) => void): () => void;
}

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
        layout: {
          x: 0,
          y: 0,
          width: 240,
          height: 140
        },
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
        layout: {
          x: 320,
          y: 0,
          width: 240,
          height: 140
        },
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
        source: {
          nodeId: "node-1",
          slot: 0
        },
        target: {
          nodeId: "node-2",
          slot: 0
        }
      }
    ],
    meta: {}
  };
}

function nextRevision(
  revision: GraphDocument["revision"]
): GraphDocument["revision"] {
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

  return slots.map((slot) =>
    typeof slot === "string"
      ? {
          name: slot
        }
      : clone(slot)
  );
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

/**
 * 创建内存态 Node authority runtime。
 *
 * @remarks
 * 第一版只服务真实外部 bridge demo：
 * - 文档由 Node 进程持有
 * - 操作由 runtime 确认
 * - 运行反馈回流给浏览器侧 authority client
 */
export function createNodeAuthorityRuntime(
  options: CreateNodeAuthorityRuntimeOptions = {}
): NodeAuthorityRuntime {
  const authorityName = options.authorityName ?? "node-authority";
  const documentListeners = new Set<(document: GraphDocument) => void>();
  const runtimeFeedbackListeners = new Set<
    (event: AuthorityRuntimeFeedbackEvent) => void
  >();
  const nodeRunCountMap = new Map<string, number>();
  let generatedNodeSequence = 0;
  let generatedLinkSequence = 0;
  let currentDocument = clone(
    options.initialDocument ?? createDefaultAuthorityDocument()
  );

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

  const nextNodeRunCount = (nodeId: string): number => {
    const nextRunCount = (nodeRunCountMap.get(nodeId) ?? 0) + 1;
    nodeRunCountMap.set(nodeId, nextRunCount);
    return nextRunCount;
  };

  const emitNodeExecution = (nodeId: string, source: string): void => {
    const node = getNode(nodeId);
    if (!node) {
      return;
    }

    const timestamp = Date.now();
    const runCount = nextNodeRunCount(nodeId);
    emitRuntimeFeedback({
      type: "node.execution",
      event: {
        chainId: `${authorityName}:${nodeId}:${timestamp}`,
        rootNodeId: node.id,
        rootNodeType: node.type,
        rootNodeTitle: node.title ?? node.id,
        nodeId: node.id,
        nodeType: node.type,
        nodeTitle: node.title ?? node.id,
        depth: 0,
        sequence: 0,
        source: "node-play",
        trigger: "direct",
        timestamp,
        executionContext: {
          source: "node-play",
          entryNodeId: node.id,
          stepIndex: 0,
          startedAt: timestamp,
          payload: {
            authority: authorityName,
            operationSource: source
          }
        },
        state: {
          status: "success",
          runCount,
          lastExecutedAt: timestamp,
          lastSucceededAt: timestamp
        }
      }
    });
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

  const emitLinkPropagation = (link: GraphLink, source: string): void => {
    emitRuntimeFeedback({
      type: "link.propagation",
      event: {
        linkId: link.id,
        chainId: `${authorityName}:${link.id}:${Date.now()}`,
        sourceNodeId: link.source.nodeId,
        sourceSlot: link.source.slot ?? 0,
        targetNodeId: link.target.nodeId,
        targetSlot: link.target.slot ?? 0,
        payload: {
          authority: authorityName,
          operationSource: source
        },
        timestamp: Date.now()
      }
    });
  };

  return {
    getDocument(): GraphDocument {
      return clone(currentDocument);
    },

    submitOperation(operation: AuthorityGraphOperation): AuthorityOperationResult {
      switch (operation.type) {
        case "node.create": {
          const nextNode = createNodeFromInput(
            operation.input,
            resolveGeneratedNodeId
          );
        currentDocument = {
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
          nodes: [
            ...currentDocument.nodes.filter((node) => node.id !== nextNode.id),
            nextNode
          ]
        };
        emitDocument();
        emitNodeState(nextNode.id, "created", true);
        emitNodeExecution(nextNode.id, operation.source);
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

        currentDocument = {
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.map((item) =>
              item.id === operation.nodeId
                ? {
                    ...item,
                    title: operation.input.title ?? item.title,
                    layout: {
                      ...item.layout,
                      x: operation.input.x ?? item.layout.x,
                      y: operation.input.y ?? item.layout.y,
                      width: operation.input.width ?? item.layout.width,
                      height: operation.input.height ?? item.layout.height
                    },
                    properties:
                      operation.input.properties !== undefined
                        ? clone(operation.input.properties)
                        : item.properties,
                    propertySpecs:
                      operation.input.propertySpecs !== undefined
                        ? clone(operation.input.propertySpecs)
                        : item.propertySpecs,
                    inputs:
                      operation.input.inputs !== undefined
                        ? toNodeSlotSpecs(operation.input.inputs)
                        : item.inputs,
                    outputs:
                      operation.input.outputs !== undefined
                        ? toNodeSlotSpecs(operation.input.outputs)
                        : item.outputs,
                    widgets:
                      operation.input.widgets !== undefined
                        ? clone(operation.input.widgets)
                        : item.widgets,
                    data:
                      operation.input.data !== undefined
                        ? clone(operation.input.data)
                        : item.data,
                    flags:
                      operation.input.flags !== undefined
                        ? {
                            ...item.flags,
                            ...clone(operation.input.flags)
                          }
                        : item.flags
                  }
                : item
            )
          };
        emitDocument();
        emitNodeState(operation.nodeId, "updated", true);
        emitNodeExecution(operation.nodeId, operation.source);
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

        currentDocument = {
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
          };
        emitDocument();
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

        currentDocument = {
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
          };
        emitDocument();
        emitNodeState(operation.nodeId, "resized", true);
        emitNodeExecution(operation.nodeId, operation.source);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "node.remove": {
          const existed = currentDocument.nodes.some(
            (node) => node.id === operation.nodeId
          );
          currentDocument = {
            ...currentDocument,
            revision: existed
              ? nextRevision(currentDocument.revision)
              : currentDocument.revision,
            nodes: currentDocument.nodes.filter(
              (node) => node.id !== operation.nodeId
            ),
            links: currentDocument.links.filter(
              (link) =>
                link.source.nodeId !== operation.nodeId &&
                link.target.nodeId !== operation.nodeId
            )
        };
        if (existed) {
          emitDocument();
          emitNodeState(operation.nodeId, "removed", false);
        }
          return {
            accepted: true,
            changed: existed,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.create": {
          const nextLink = createLinkFromInput(
            operation.input,
            resolveGeneratedLinkId
          );
        currentDocument = {
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
            links: [
              ...currentDocument.links.filter((link) => link.id !== nextLink.id),
              nextLink
            ]
          };
        emitDocument();
        emitNodeState(nextLink.source.nodeId, "connections", true);
          emitNodeState(nextLink.target.nodeId, "connections", true);
          emitLinkPropagation(nextLink, operation.source);
          return {
            accepted: true,
            changed: true,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.remove": {
          const existed = currentDocument.links.some(
            (link) => link.id === operation.linkId
          );
        currentDocument = {
          ...currentDocument,
          revision: existed
              ? nextRevision(currentDocument.revision)
              : currentDocument.revision,
          links: currentDocument.links.filter(
            (link) => link.id !== operation.linkId
          )
        };
        if (existed) {
          emitDocument();
        }
        return {
            accepted: true,
            changed: existed,
            revision: currentDocument.revision,
            document: clone(currentDocument)
          };
        }
        case "link.reconnect": {
          const link = currentDocument.links.find(
            (item) => item.id === operation.linkId
          );
          if (!link) {
            return {
              accepted: false,
              changed: false,
              reason: "连线不存在",
              revision: currentDocument.revision,
              document: clone(currentDocument)
            };
          }

        currentDocument = {
          ...currentDocument,
          revision: nextRevision(currentDocument.revision),
            links: currentDocument.links.map((item) =>
              item.id === operation.linkId
                ? {
                    ...item,
                    source: operation.input.source ?? item.source,
                    target: operation.input.target ?? item.target
                  }
                : item
            )
          };
        const nextLink = currentDocument.links.find(
          (item) => item.id === operation.linkId
        );
        if (nextLink) {
          emitDocument();
          emitNodeState(nextLink.source.nodeId, "connections", true);
          emitNodeState(nextLink.target.nodeId, "connections", true);
          emitLinkPropagation(nextLink, operation.source);
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

    replaceDocument(document: GraphDocument): GraphDocument {
      currentDocument = clone(document);
      emitDocument();
      return clone(currentDocument);
    },

    subscribeDocument(listener: (document: GraphDocument) => void): () => void {
      documentListeners.add(listener);

      return () => {
        documentListeners.delete(listener);
      };
    },

    subscribe(
      listener: (event: AuthorityRuntimeFeedbackEvent) => void
    ): () => void {
      runtimeFeedbackListeners.add(listener);

      return () => {
        runtimeFeedbackListeners.delete(listener);
      };
    }
  };
}
