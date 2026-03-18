import { isDeepStrictEqual } from "node:util";

import type {
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint
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

function normalizeLinkEndpoint(endpoint: GraphLinkEndpoint): GraphLinkEndpoint {
  return {
    nodeId: endpoint.nodeId,
    slot: endpoint.slot ?? 0
  };
}

function resolveValidatedLinkEndpoint(
  document: GraphDocument,
  endpoint: GraphLinkEndpoint,
  label: "source" | "target"
): {
  accepted: boolean;
  endpoint?: GraphLinkEndpoint;
  reason?: string;
} {
  const nodeId = endpoint.nodeId?.trim();
  if (!nodeId) {
    return {
      accepted: false,
      reason: `${label} 节点不能为空`
    };
  }

  const slot = endpoint.slot ?? 0;
  if (!Number.isInteger(slot) || slot < 0) {
    return {
      accepted: false,
      reason: `${label} slot 必须是非负整数`
    };
  }

  if (!document.nodes.some((node) => node.id === nodeId)) {
    return {
      accepted: false,
      reason: `${label} 节点不存在`
    };
  }

  return {
    accepted: true,
    endpoint: {
      nodeId,
      slot
    }
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

  const resetDocumentCaches = (): void => {
    generatedNodeSequence = 0;
    generatedLinkSequence = 0;
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
          const previousNode = getNode(nextNode.id);
          if (previousNode && isDeepStrictEqual(previousNode, nextNode)) {
            return createCurrentSnapshotResult({
              reason: "文档无变化"
            });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: [
              ...currentDocument.nodes.filter((node) => node.id !== nextNode.id),
              nextNode
            ]
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
              operation.input.data !== undefined
                ? clone(operation.input.data)
                : node.data,
            flags:
              operation.input.flags !== undefined
                ? {
                    ...node.flags,
                    ...clone(operation.input.flags)
                  }
                : node.flags
          };
          if (isDeepStrictEqual(node, nextNode)) {
            return createCurrentSnapshotResult({
              reason: "文档无变化"
            });
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

          if (
            node.layout.x === operation.input.x &&
            node.layout.y === operation.input.y
          ) {
            return createCurrentSnapshotResult({
              reason: "文档无变化"
            });
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
            return createCurrentSnapshotResult({
              reason: "文档无变化"
            });
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
          const existed = currentDocument.nodes.some(
            (node) => node.id === operation.nodeId
          );
          if (!existed) {
            return createCurrentSnapshotResult({
              reason: "节点不存在"
            });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            nodes: currentDocument.nodes.filter(
              (node) => node.id !== operation.nodeId
            ),
            links: currentDocument.links.filter(
              (link) =>
                link.source.nodeId !== operation.nodeId &&
                link.target.nodeId !== operation.nodeId
            )
          });

          emitNodeState(operation.nodeId, "removed", false);
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
            return createCurrentSnapshotResult({
              reason: "文档无变化"
            });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: [
              ...currentDocument.links.filter((link) => link.id !== nextLink.id),
              nextLink
            ]
          });
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
          const removedLink = getLink(operation.linkId);
          if (!removedLink) {
            return createCurrentSnapshotResult({
              reason: "连线不存在"
            });
          }

          commitDocument({
            ...currentDocument,
            revision: nextRevision(currentDocument.revision),
            links: currentDocument.links.filter(
              (link) => link.id !== operation.linkId
            )
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
            ? resolveValidatedLinkEndpoint(
                currentDocument,
                operation.input.source,
                "source"
              )
            : {
                accepted: true as const,
                endpoint: normalizeLinkEndpoint(link.source)
              };
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
            ? resolveValidatedLinkEndpoint(
                currentDocument,
                operation.input.target,
                "target"
              )
            : {
                accepted: true as const,
                endpoint: normalizeLinkEndpoint(link.target)
              };
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
            return createCurrentSnapshotResult({
              reason: "文档无变化"
            });
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
            emitNodeState(nodeId, "connections", true);
          }
          emitLinkPropagation(nextLink, operation.source);
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
