import type {
  GraphDocument,
  GraphLink,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";

type GraphDocumentListener = (document: GraphDocument) => void;

/** editor 当前阶段的最小 document session。 */
export interface EditorGraphDocumentSession {
  /** 当前缓存的正式文档快照。 */
  readonly currentDocument: GraphDocument;
  /** 通过 loopback authority 提交一条正式操作。 */
  submitOperation(operation: GraphOperation): GraphOperationApplyResult;
  /** 记录一组已经在 graph 上成功落地的操作。 */
  recordAppliedOperations(operations: readonly GraphOperation[]): void;
  /** 根据节点状态变化，从 graph 侧回填当前文档。 */
  reconcileNodeState(nodeId: string, exists: boolean): void;
  /** 替换当前正式文档并同步重置 graph。 */
  replaceDocument(document: GraphDocument): void;
  /** 订阅当前文档快照变化。 */
  subscribe(listener: GraphDocumentListener): () => void;
}

interface CreateLoopbackGraphDocumentSessionOptions {
  graph: LeaferGraph;
  document: GraphDocument;
}

/**
 * 创建一个最小 loopback document session。
 *
 * @remarks
 * 当前阶段它仍然以内存 graph 作为真实执行落点，
 * 但 editor 不再直接把 graph 当成唯一长期文档语义，而是统一通过 session 维护一份可替换的文档快照。
 */
export function createLoopbackGraphDocumentSession(
  options: CreateLoopbackGraphDocumentSessionOptions
): EditorGraphDocumentSession {
  const listeners = new Set<GraphDocumentListener>();
  let currentDocument = cloneGraphDocument(options.document);

  const emit = (): void => {
    if (!listeners.size) {
      return;
    }

    const snapshot = cloneGraphDocument(currentDocument);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const commitDocument = (nextDocument: GraphDocument): void => {
    currentDocument = nextDocument;
    emit();
  };

  const recordAppliedOperation = (
    result: GraphOperationApplyResult
  ): void => {
    commitDocument(syncDocumentWithApplyResult(currentDocument, options.graph, result));
  };

  return {
    get currentDocument(): GraphDocument {
      return cloneGraphDocument(currentDocument);
    },

    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      const result = options.graph.applyGraphOperation(operation);
      if (result.accepted) {
        recordAppliedOperation(result);
      }

      return result;
    },

    recordAppliedOperations(operations: readonly GraphOperation[]): void {
      if (!operations.length) {
        return;
      }

      let nextDocument = currentDocument;
      for (const operation of operations) {
        nextDocument = syncDocumentWithOperation(
          nextDocument,
          options.graph,
          operation
        );
      }

      commitDocument(nextDocument);
    },

    reconcileNodeState(nodeId: string, exists: boolean): void {
      commitDocument(syncDocumentWithNodeState(currentDocument, options.graph, nodeId, exists));
    },

    replaceDocument(document: GraphDocument): void {
      const nextDocument = cloneGraphDocument(document);
      options.graph.replaceGraphDocument(nextDocument);
      commitDocument(nextDocument);
    },

    subscribe(listener: GraphDocumentListener): () => void {
      listeners.add(listener);
      listener(cloneGraphDocument(currentDocument));

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function cloneGraphDocument(document: GraphDocument): GraphDocument {
  return structuredClone({
    documentId: document.documentId,
    revision: document.revision,
    appKind: document.appKind,
    nodes: document.nodes ?? [],
    links: document.links ?? [],
    meta: document.meta,
    capabilityProfile: document.capabilityProfile,
    adapterBinding: document.adapterBinding
  } satisfies GraphDocument);
}

function syncDocumentWithOperation(
  document: GraphDocument,
  graph: LeaferGraph,
  operation: GraphOperation
): GraphDocument {
  switch (operation.type) {
    case "node.create":
      return upsertNodeSnapshot(document, graph, operation.input.id);
    case "node.update":
    case "node.move":
    case "node.resize":
      return upsertNodeSnapshot(document, graph, operation.nodeId);
    case "node.remove":
      return removeNodeSnapshot(document, operation.nodeId);
    case "link.create":
      return upsertLinkSnapshot(document, graph, operation.input.id);
    case "link.remove":
      return removeLinkSnapshot(document, operation.linkId);
    case "link.reconnect":
      return upsertLinkSnapshot(document, graph, operation.linkId);
  }
}

function syncDocumentWithApplyResult(
  document: GraphDocument,
  graph: LeaferGraph,
  result: GraphOperationApplyResult
): GraphDocument {
  switch (result.operation.type) {
    case "node.create":
      return upsertNodeSnapshot(
        document,
        graph,
        result.affectedNodeIds[0] ?? result.operation.input.id
      );
    case "link.create":
      return upsertLinkSnapshot(
        document,
        graph,
        result.affectedLinkIds[0] ?? result.operation.input.id
      );
    default:
      return syncDocumentWithOperation(document, graph, result.operation);
  }
}

function syncDocumentWithNodeState(
  document: GraphDocument,
  graph: LeaferGraph,
  nodeId: string,
  exists: boolean
): GraphDocument {
  if (!exists) {
    return removeNodeSnapshot(document, nodeId);
  }

  return upsertNodeSnapshot(document, graph, nodeId);
}

function upsertNodeSnapshot(
  document: GraphDocument,
  graph: LeaferGraph,
  nodeId: string | undefined
): GraphDocument {
  if (!nodeId) {
    return document;
  }

  const snapshot = graph.getNodeSnapshot(nodeId);
  if (!snapshot) {
    return document;
  }

  const nextNodes = document.nodes.filter((node) => node.id !== snapshot.id);
  nextNodes.push(structuredClone(snapshot));

  return {
    ...document,
    nodes: nextNodes
  };
}

function upsertLinkSnapshot(
  document: GraphDocument,
  graph: LeaferGraph,
  linkId: string | undefined
): GraphDocument {
  if (!linkId) {
    return document;
  }

  const link = graph.getLink(linkId);
  if (!link) {
    return document;
  }

  const nextLinks = document.links.filter((item) => item.id !== link.id);
  nextLinks.push(cloneGraphLink(link));

  return {
    ...document,
    links: nextLinks
  };
}

function removeNodeSnapshot(
  document: GraphDocument,
  nodeId: string
): GraphDocument {
  const nextNodes = document.nodes.filter((node) => node.id !== nodeId);
  const nextLinks = document.links.filter(
    (link) => link.source.nodeId !== nodeId && link.target.nodeId !== nodeId
  );

  if (
    nextNodes.length === document.nodes.length &&
    nextLinks.length === document.links.length
  ) {
    return document;
  }

  return {
    ...document,
    nodes: nextNodes,
    links: nextLinks
  };
}

function removeLinkSnapshot(
  document: GraphDocument,
  linkId: string
): GraphDocument {
  const nextLinks = document.links.filter((link) => link.id !== linkId);
  if (nextLinks.length === document.links.length) {
    return document;
  }

  return {
    ...document,
    links: nextLinks
  };
}

function cloneGraphLink(link: GraphLink): GraphLink {
  return structuredClone(link);
}
