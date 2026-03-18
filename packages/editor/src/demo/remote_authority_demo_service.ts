import type {
  GraphDocument,
  GraphOperation,
  LeaferGraphNodeStateChangeReason,
  RuntimeFeedbackEvent
} from "leafergraph";
import type {
  EditorRemoteAuthorityDocumentService
} from "../session/graph_document_authority_service";

/** 浏览器内 authority demo service 的最小创建参数。 */
export interface CreateDemoRemoteAuthorityServiceOptions {
  /** 初始图文档；未提供时使用内置 demo 文档。 */
  initialDocument?: GraphDocument;
  /** authority 标识，用于反馈事件。 */
  authorityName?: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

type GraphNodeSnapshot = GraphDocument["nodes"][number];
type GraphLinkSnapshot = GraphDocument["links"][number];

function createDefaultDemoDocument(): GraphDocument {
  return {
    documentId: "demo-worker-doc",
    revision: "1",
    appKind: "demo-worker",
    nodes: [
      {
        id: "node-1",
        type: "demo.worker",
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
        type: "demo.worker",
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

/**
 * 创建浏览器内可直接挂到 worker / iframe host 的 authority demo service。
 *
 * @remarks
 * 这层的职责是提供一个“真 authority 风格”的最小示例：
 * - 文档快照由 service 持有
 * - 图操作由 authority 确认并推进 revision
 * - 运行反馈通过统一 `RuntimeFeedbackEvent` 回流
 */
export function createDemoRemoteAuthorityService(
  options: CreateDemoRemoteAuthorityServiceOptions = {}
): EditorRemoteAuthorityDocumentService {
  const documentListeners = new Set<(document: GraphDocument) => void>();
  const runtimeFeedbackListeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();
  const nodeRunCountMap = new Map<string, number>();
  const authorityName = options.authorityName ?? "demo-worker";
  let generatedNodeSequence = 0;
  let generatedLinkSequence = 0;
  let currentDocument = clone(
    options.initialDocument ?? createDefaultDemoDocument()
  );

  const emitRuntimeFeedback = (event: RuntimeFeedbackEvent): void => {
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
    reason: LeaferGraphNodeStateChangeReason,
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

  const emitLinkPropagation = (link: GraphLinkSnapshot, source: string): void => {
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

  const nextNodeId = (): string => {
    generatedNodeSequence += 1;
    return `${authorityName}-node-${generatedNodeSequence}`;
  };

  const nextLinkId = (): string => {
    generatedLinkSequence += 1;
    return `${authorityName}-link-${generatedLinkSequence}`;
  };

  const toNodeSlotSpecs = (
    slots?: Extract<GraphOperation, { type: "node.create" }>["input"]["inputs"]
  ): GraphNodeSnapshot["inputs"] => {
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
  };

  const createNodeFromInput = (
    input: Extract<GraphOperation, { type: "node.create" }>["input"]
  ): GraphNodeSnapshot => {
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
  };

  const createLinkFromInput = (
    input: Extract<GraphOperation, { type: "link.create" }>["input"]
  ): GraphLinkSnapshot => {
    return {
      id: input.id ?? nextLinkId(),
      source: {
        nodeId: input.source.nodeId,
        slot: input.source.slot
      },
      target: {
        nodeId: input.target.nodeId,
        slot: input.target.slot
      },
      label: input.label,
      data: input.data ? clone(input.data) : undefined
    };
  };

  const applyOperation = (operation: GraphOperation) => {
    switch (operation.type) {
      case "node.create": {
        const nextNode = createNodeFromInput(operation.input);
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
        const nextLink = createLinkFromInput(operation.input);
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
        const link = currentDocument.links.find((item) => item.id === operation.linkId);
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
  };

  return {
    async getDocument(): Promise<GraphDocument> {
      return clone(currentDocument);
    },

    async submitOperation(operation: GraphOperation) {
      return applyOperation(operation);
    },

    async replaceDocument(document: GraphDocument): Promise<GraphDocument> {
      currentDocument = clone(document);
      emitDocument();
      return clone(currentDocument);
    },

    subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
      runtimeFeedbackListeners.add(listener);
      return () => {
        runtimeFeedbackListeners.delete(listener);
      };
    },

    subscribeDocument(listener: (document: GraphDocument) => void): () => void {
      documentListeners.add(listener);
      return () => {
        documentListeners.delete(listener);
      };
    }
  };
}
