import type {
  GraphDocument,
  GraphLink,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraph
} from "leafergraph";
import type {
  EditorRemoteAuthorityClient,
  EditorRemoteAuthorityOperationResult
} from "./graph_document_authority_client";

type GraphDocumentListener = (document: GraphDocument) => void;
type GraphPendingOperationIdsListener = (
  pendingOperationIds: readonly string[]
) => void;
type GraphOperationConfirmationListener = (
  confirmation: EditorGraphOperationAuthorityConfirmation
) => void;

/**
 * 一次操作在 authority 侧的最小确认结果。
 *
 * @remarks
 * 这层抽象专门用于把“同步 apply 结果”和“异步 authority 确认”分开，
 * 让命令层后续不需要散落地判断各种会话实现差异。
 */
export interface EditorGraphOperationAuthorityConfirmation {
  /** 被确认的操作 ID。 */
  operationId: string;
  /** authority 是否接受了这条操作。 */
  accepted: boolean;
  /** authority 确认后是否真的改动了文档。 */
  changed: boolean;
  /** 未接受或无变化时的最小原因。 */
  reason?: string;
  /** authority 确认完成后的文档 revision。 */
  revision: GraphDocument["revision"];
}

/** 一次操作提交的最小会话回执。 */
export interface EditorGraphOperationSubmission {
  /** 当前会话立即可见的 apply 结果。 */
  applyResult: GraphOperationApplyResult;
  /** authority 确认结果；loopback 会话会立即 resolve。 */
  confirmation: Promise<EditorGraphOperationAuthorityConfirmation>;
}

/** editor 当前阶段的最小 document session。 */
export interface EditorGraphDocumentSession {
  /** 当前缓存的正式文档快照。 */
  readonly currentDocument: GraphDocument;
  /** 当前仍在等待 authority 确认的操作 ID 列表。 */
  readonly pendingOperationIds: readonly string[];
  /** 提交一条正式操作，并返回可等待 authority 确认的回执。 */
  submitOperationWithAuthority(
    operation: GraphOperation
  ): EditorGraphOperationSubmission;
  /** 通过 loopback authority 提交一条正式操作。 */
  submitOperation(operation: GraphOperation): GraphOperationApplyResult;
  /** 记录一组已经在 graph 上成功落地的操作。 */
  recordAppliedOperations(operations: readonly GraphOperation[]): void;
  /** 根据节点状态变化，从 graph 侧回填当前文档。 */
  reconcileNodeState(nodeId: string, exists: boolean): void;
  /** 替换当前正式文档并同步重置 graph。 */
  replaceDocument(document: GraphDocument): void;
  /** 订阅 authority 操作确认事件。 */
  subscribeOperationConfirmation(
    listener: GraphOperationConfirmationListener
  ): () => void;
  /** 订阅 pending 队列变化。 */
  subscribePending(
    listener: GraphPendingOperationIdsListener
  ): () => void;
  /** 订阅当前文档快照变化。 */
  subscribe(listener: GraphDocumentListener): () => void;
}

interface CreateLoopbackGraphDocumentSessionOptions {
  graph: LeaferGraph;
  document: GraphDocument;
}

/** mock remote session 的最小可配置项。 */
export interface CreateMockRemoteGraphDocumentSessionOptions {
  graph: LeaferGraph;
  document: GraphDocument;
  /**
   * 操作确认延迟。
   *
   * @remarks
   * - 传数字：全部操作共用同一延迟（单位毫秒）
   * - 传函数：按操作动态计算延迟
   */
  confirmationDelayMs?:
    | number
    | ((operation: GraphOperation) => number);
  /**
   * 是否拒绝本次操作。
   *
   * @returns
   * - 返回 `string`：表示拒绝，并作为 `reason`
   * - 返回 `null / undefined / false`：表示接受
   */
  shouldRejectOperation?(
    operation: GraphOperation,
    context: {
      currentDocument: GraphDocument;
      pendingOperationIds: readonly string[];
    }
  ): string | null | undefined | false;
}

interface MockRemotePendingOperationEntry {
  operation: GraphOperation;
  resolveConfirmation: (
    confirmation: EditorGraphOperationAuthorityConfirmation
  ) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** 真实 authority client 模式的最小创建参数。 */
export interface CreateRemoteGraphDocumentSessionOptions {
  document: GraphDocument;
  client: EditorRemoteAuthorityClient;
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
  const confirmationListeners = new Set<GraphOperationConfirmationListener>();
  const pendingListeners = new Set<GraphPendingOperationIdsListener>();
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

  const commitDocument = (nextDocument: GraphDocument): GraphDocument => {
    if (nextDocument === currentDocument) {
      return currentDocument;
    }

    currentDocument = nextDocument;
    emit();
    return currentDocument;
  };

  const commitDocumentWithNextRevision = (
    nextDocument: GraphDocument
  ): GraphDocument => {
    if (nextDocument === currentDocument) {
      return currentDocument;
    }

    return commitDocument(createDocumentWithNextRevision(nextDocument));
  };

  const createAuthorityConfirmation = (
    applyResult: GraphOperationApplyResult
  ): EditorGraphOperationAuthorityConfirmation => {
    return {
      operationId: applyResult.operation.operationId,
      accepted: applyResult.accepted,
      changed: applyResult.changed,
      reason: applyResult.reason,
      revision: currentDocument.revision
    };
  };

  const emitOperationConfirmation = (
    confirmation: EditorGraphOperationAuthorityConfirmation
  ): void => {
    if (!confirmationListeners.size) {
      return;
    }

    for (const listener of confirmationListeners) {
      listener(confirmation);
    }
  };

  const submitOperationWithAuthority = (
    operation: GraphOperation
  ): EditorGraphOperationSubmission => {
    const result = options.graph.applyGraphOperation(operation);
    if (result.accepted && result.changed) {
      const nextDocument = syncDocumentWithApplyResult(
        currentDocument,
        options.graph,
        result
      );
      commitDocumentWithNextRevision(nextDocument);
    }

    const confirmation = createAuthorityConfirmation(result);
    emitOperationConfirmation(confirmation);

    return {
      applyResult: result,
      confirmation: Promise.resolve(confirmation)
    };
  };

  return {
    get currentDocument(): GraphDocument {
      return cloneGraphDocument(currentDocument);
    },

    get pendingOperationIds(): readonly string[] {
      return [];
    },

    submitOperationWithAuthority(
      operation: GraphOperation
    ): EditorGraphOperationSubmission {
      return submitOperationWithAuthority(operation);
    },

    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return submitOperationWithAuthority(operation).applyResult;
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

      commitDocumentWithNextRevision(nextDocument);
    },

    reconcileNodeState(nodeId: string, exists: boolean): void {
      commitDocumentWithNextRevision(
        syncDocumentWithNodeState(currentDocument, options.graph, nodeId, exists)
      );
    },

    replaceDocument(document: GraphDocument): void {
      const nextDocument = cloneGraphDocument(document);
      options.graph.replaceGraphDocument(nextDocument);
      commitDocument(nextDocument);
    },

    subscribeOperationConfirmation(
      listener: GraphOperationConfirmationListener
    ): () => void {
      confirmationListeners.add(listener);

      return () => {
        confirmationListeners.delete(listener);
      };
    },

    subscribePending(listener: GraphPendingOperationIdsListener): () => void {
      pendingListeners.add(listener);
      listener([]);

      return () => {
        pendingListeners.delete(listener);
      };
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

/**
 * 创建一个最小 mock remote document session。
 *
 * @remarks
 * 这一层仍然使用本地 graph 作为最终落地点，但会先进入 pending 队列，
 * 再在异步确认阶段决定“接受 / 拒绝”，用于模拟真实后端 authority 的确认语义。
 */
export function createMockRemoteGraphDocumentSession(
  options: CreateMockRemoteGraphDocumentSessionOptions
): EditorGraphDocumentSession {
  const listeners = new Set<GraphDocumentListener>();
  const confirmationListeners = new Set<GraphOperationConfirmationListener>();
  const pendingListeners = new Set<GraphPendingOperationIdsListener>();
  const pendingOperations = new Map<string, MockRemotePendingOperationEntry>();
  let currentDocument = cloneGraphDocument(options.document);

  const resolveConfirmationDelayMs = (operation: GraphOperation): number => {
    const { confirmationDelayMs } = options;
    if (typeof confirmationDelayMs === "function") {
      return normalizeConfirmationDelayMs(confirmationDelayMs(operation));
    }

    return normalizeConfirmationDelayMs(confirmationDelayMs);
  };

  const emitDocument = (): void => {
    if (!listeners.size) {
      return;
    }

    const snapshot = cloneGraphDocument(currentDocument);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const emitPending = (): void => {
    if (!pendingListeners.size) {
      return;
    }

    const pendingIds = [...pendingOperations.keys()];
    for (const listener of pendingListeners) {
      listener(pendingIds);
    }
  };

  const emitOperationConfirmation = (
    confirmation: EditorGraphOperationAuthorityConfirmation
  ): void => {
    if (!confirmationListeners.size) {
      return;
    }

    for (const listener of confirmationListeners) {
      listener(confirmation);
    }
  };

  const commitDocument = (nextDocument: GraphDocument): GraphDocument => {
    if (nextDocument === currentDocument) {
      return currentDocument;
    }

    currentDocument = nextDocument;
    emitDocument();
    return currentDocument;
  };

  const commitDocumentWithNextRevision = (
    nextDocument: GraphDocument
  ): GraphDocument => {
    if (nextDocument === currentDocument) {
      return currentDocument;
    }

    return commitDocument(createDocumentWithNextRevision(nextDocument));
  };

  const resolveRejectedReason = (operation: GraphOperation): string | null => {
    const reason = options.shouldRejectOperation?.(operation, {
      currentDocument: cloneGraphDocument(currentDocument),
      pendingOperationIds: [...pendingOperations.keys()]
    });

    return typeof reason === "string" && reason.trim()
      ? reason.trim()
      : null;
  };

  const removePendingOperation = (
    operationId: string
  ): MockRemotePendingOperationEntry | undefined => {
    const pendingOperation = pendingOperations.get(operationId);
    if (!pendingOperation) {
      return undefined;
    }

    pendingOperations.delete(operationId);
    emitPending();
    return pendingOperation;
  };

  const createDuplicatePendingSubmission = (
    operation: GraphOperation
  ): EditorGraphOperationSubmission => {
    const applyResult: GraphOperationApplyResult = {
      accepted: false,
      changed: false,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: [],
      reason: "操作仍在等待 authority 确认"
    };

    const confirmation: EditorGraphOperationAuthorityConfirmation = {
      operationId: operation.operationId,
      accepted: false,
      changed: false,
      reason: applyResult.reason,
      revision: currentDocument.revision
    };

    return {
      applyResult,
      confirmation: Promise.resolve(confirmation)
    };
  };

  const submitOperationWithAuthority = (
    operation: GraphOperation
  ): EditorGraphOperationSubmission => {
    if (pendingOperations.has(operation.operationId)) {
      return createDuplicatePendingSubmission(operation);
    }

    const applyResult: GraphOperationApplyResult = {
      accepted: true,
      changed: false,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: [],
      reason: "等待 authority 确认"
    };

    let resolveConfirmation:
      | ((value: EditorGraphOperationAuthorityConfirmation) => void)
      | null = null;
    const confirmation = new Promise<EditorGraphOperationAuthorityConfirmation>(
      (resolve) => {
        resolveConfirmation = resolve;
      }
    );

    const confirmationDelayMs = resolveConfirmationDelayMs(operation);
    const timer = setTimeout(() => {
      const pendingOperation = removePendingOperation(operation.operationId);
      if (!pendingOperation) {
        return;
      }

      const rejectedReason = resolveRejectedReason(operation);
      if (rejectedReason) {
        const confirmation: EditorGraphOperationAuthorityConfirmation = {
          operationId: operation.operationId,
          accepted: false,
          changed: false,
          reason: rejectedReason,
          revision: currentDocument.revision
        };
        pendingOperation.resolveConfirmation(confirmation);
        emitOperationConfirmation(confirmation);
        return;
      }

      const result = options.graph.applyGraphOperation(operation);
      if (result.accepted && result.changed) {
        const nextDocument = syncDocumentWithApplyResult(
          currentDocument,
          options.graph,
          result
        );
        commitDocumentWithNextRevision(nextDocument);
      }

      const confirmation: EditorGraphOperationAuthorityConfirmation = {
        operationId: operation.operationId,
        accepted: result.accepted,
        changed: result.changed,
        reason: result.reason,
        revision: currentDocument.revision
      };
      pendingOperation.resolveConfirmation(confirmation);
      emitOperationConfirmation(confirmation);
    }, confirmationDelayMs);

    pendingOperations.set(operation.operationId, {
      operation,
      resolveConfirmation: resolveConfirmation ?? (() => {}),
      timer
    });
    emitPending();

    return {
      applyResult,
      confirmation
    };
  };

  return {
    get currentDocument(): GraphDocument {
      return cloneGraphDocument(currentDocument);
    },

    get pendingOperationIds(): readonly string[] {
      return [...pendingOperations.keys()];
    },

    submitOperationWithAuthority(
      operation: GraphOperation
    ): EditorGraphOperationSubmission {
      return submitOperationWithAuthority(operation);
    },

    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return submitOperationWithAuthority(operation).applyResult;
    },

    recordAppliedOperations(operations: readonly GraphOperation[]): void {
      if (!operations.length) {
        return;
      }

      let nextDocument = currentDocument;
      let pendingChanged = false;
      for (const operation of operations) {
        nextDocument = syncDocumentWithOperation(
          nextDocument,
          options.graph,
          operation
        );

        if (pendingOperations.has(operation.operationId)) {
          const pendingOperation = pendingOperations.get(operation.operationId);
          if (pendingOperation) {
            clearTimeout(pendingOperation.timer);
          }
          pendingOperations.delete(operation.operationId);
          pendingChanged = true;
        }
      }

      commitDocumentWithNextRevision(nextDocument);

      if (pendingChanged) {
        emitPending();
      }
    },

    reconcileNodeState(nodeId: string, exists: boolean): void {
      commitDocumentWithNextRevision(
        syncDocumentWithNodeState(currentDocument, options.graph, nodeId, exists)
      );
    },

    replaceDocument(document: GraphDocument): void {
      for (const pendingOperation of pendingOperations.values()) {
        clearTimeout(pendingOperation.timer);
        const confirmation: EditorGraphOperationAuthorityConfirmation = {
          operationId: pendingOperation.operation.operationId,
          accepted: false,
          changed: false,
          reason: "文档已替换，待确认操作已取消",
          revision: currentDocument.revision
        };
        pendingOperation.resolveConfirmation(confirmation);
        emitOperationConfirmation(confirmation);
      }
      pendingOperations.clear();
      emitPending();

      const nextDocument = cloneGraphDocument(document);
      options.graph.replaceGraphDocument(nextDocument);
      commitDocument(nextDocument);
    },

    subscribeOperationConfirmation(
      listener: GraphOperationConfirmationListener
    ): () => void {
      confirmationListeners.add(listener);

      return () => {
        confirmationListeners.delete(listener);
      };
    },

    subscribePending(listener: GraphPendingOperationIdsListener): () => void {
      pendingListeners.add(listener);
      listener([...pendingOperations.keys()]);

      return () => {
        pendingListeners.delete(listener);
      };
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

/**
 * 创建一个 authority client 驱动的 remote document session。
 *
 * @remarks
 * 这一层不再假设 authority 运行在浏览器内；session 只维护 pending 队列、
 * authority 确认事件和当前正式文档快照，真正的确认逻辑全部交给外部 client。
 */
export function createRemoteGraphDocumentSession(
  options: CreateRemoteGraphDocumentSessionOptions
): EditorGraphDocumentSession {
  const listeners = new Set<GraphDocumentListener>();
  const confirmationListeners = new Set<GraphOperationConfirmationListener>();
  const pendingListeners = new Set<GraphPendingOperationIdsListener>();
  const pendingOperations = new Map<
    string,
    {
      operation: GraphOperation;
      resolveConfirmation: (
        confirmation: EditorGraphOperationAuthorityConfirmation
      ) => void;
    }
  >();
  let currentDocument = cloneGraphDocument(options.document);

  const emitDocument = (): void => {
    if (!listeners.size) {
      return;
    }

    const snapshot = cloneGraphDocument(currentDocument);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const emitPending = (): void => {
    if (!pendingListeners.size) {
      return;
    }

    const pendingIds = [...pendingOperations.keys()];
    for (const listener of pendingListeners) {
      listener(pendingIds);
    }
  };

  const emitOperationConfirmation = (
    confirmation: EditorGraphOperationAuthorityConfirmation
  ): void => {
    if (!confirmationListeners.size) {
      return;
    }

    for (const listener of confirmationListeners) {
      listener(confirmation);
    }
  };

  const commitDocument = (nextDocument: GraphDocument): GraphDocument => {
    if (nextDocument === currentDocument) {
      return currentDocument;
    }

    currentDocument = nextDocument;
    emitDocument();
    return currentDocument;
  };

  const commitResponseDocument = (
    response: EditorRemoteAuthorityOperationResult
  ): void => {
    if (response.document) {
      commitDocument(cloneGraphDocument(response.document));
      return;
    }

    if (response.accepted && !response.changed) {
      commitDocument({
        ...currentDocument,
        revision: response.revision
      });
    }
  };

  const removePendingOperation = (
    operationId: string
  ):
    | {
        operation: GraphOperation;
        resolveConfirmation: (
          confirmation: EditorGraphOperationAuthorityConfirmation
        ) => void;
      }
    | undefined => {
    const pendingOperation = pendingOperations.get(operationId);
    if (!pendingOperation) {
      return undefined;
    }

    pendingOperations.delete(operationId);
    emitPending();
    return pendingOperation;
  };

  const createDuplicatePendingSubmission = (
    operation: GraphOperation
  ): EditorGraphOperationSubmission => {
    const applyResult: GraphOperationApplyResult = {
      accepted: false,
      changed: false,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: [],
      reason: "操作仍在等待 authority 确认"
    };

    const confirmation: EditorGraphOperationAuthorityConfirmation = {
      operationId: operation.operationId,
      accepted: false,
      changed: false,
      reason: applyResult.reason,
      revision: currentDocument.revision
    };

    return {
      applyResult,
      confirmation: Promise.resolve(confirmation)
    };
  };

  const submitOperationWithAuthority = (
    operation: GraphOperation
  ): EditorGraphOperationSubmission => {
    if (pendingOperations.has(operation.operationId)) {
      return createDuplicatePendingSubmission(operation);
    }

    const applyResult: GraphOperationApplyResult = {
      accepted: true,
      changed: false,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: [],
      reason: "等待 authority 确认"
    };

    let resolveConfirmation:
      | ((value: EditorGraphOperationAuthorityConfirmation) => void)
      | null = null;
    const confirmation = new Promise<EditorGraphOperationAuthorityConfirmation>(
      (resolve) => {
        resolveConfirmation = resolve;
      }
    );

    pendingOperations.set(operation.operationId, {
      operation,
      resolveConfirmation: resolveConfirmation ?? (() => {})
    });
    emitPending();

    void options.client
      .submitOperation(operation, {
        currentDocument: cloneGraphDocument(currentDocument),
        pendingOperationIds: [...pendingOperations.keys()]
      })
      .then((response) => {
        const pendingOperation = removePendingOperation(operation.operationId);
        if (!pendingOperation) {
          return;
        }

        commitResponseDocument(response);

        const nextConfirmation: EditorGraphOperationAuthorityConfirmation = {
          operationId: operation.operationId,
          accepted: response.accepted,
          changed: response.changed,
          reason: response.reason,
          revision: response.revision
        };
        pendingOperation.resolveConfirmation(nextConfirmation);
        emitOperationConfirmation(nextConfirmation);
      })
      .catch((error: unknown) => {
        const pendingOperation = removePendingOperation(operation.operationId);
        if (!pendingOperation) {
          return;
        }

        const reason =
          error instanceof Error && error.message
            ? error.message
            : "authority 请求失败";
        const confirmation: EditorGraphOperationAuthorityConfirmation = {
          operationId: operation.operationId,
          accepted: false,
          changed: false,
          reason,
          revision: currentDocument.revision
        };
        pendingOperation.resolveConfirmation(confirmation);
        emitOperationConfirmation(confirmation);
      });

    return {
      applyResult,
      confirmation
    };
  };

  return {
    get currentDocument(): GraphDocument {
      return cloneGraphDocument(currentDocument);
    },

    get pendingOperationIds(): readonly string[] {
      return [...pendingOperations.keys()];
    },

    submitOperationWithAuthority(
      operation: GraphOperation
    ): EditorGraphOperationSubmission {
      return submitOperationWithAuthority(operation);
    },

    submitOperation(operation: GraphOperation): GraphOperationApplyResult {
      return submitOperationWithAuthority(operation).applyResult;
    },

    recordAppliedOperations(): void {},

    reconcileNodeState(): void {},

    replaceDocument(document: GraphDocument): void {
      for (const pendingOperation of pendingOperations.values()) {
        const confirmation: EditorGraphOperationAuthorityConfirmation = {
          operationId: pendingOperation.operation.operationId,
          accepted: false,
          changed: false,
          reason: "文档已替换，待确认操作已取消",
          revision: currentDocument.revision
        };
        pendingOperation.resolveConfirmation(confirmation);
        emitOperationConfirmation(confirmation);
      }
      pendingOperations.clear();
      emitPending();

      const previousDocument = cloneGraphDocument(currentDocument);
      const nextDocument = cloneGraphDocument(document);
      commitDocument(nextDocument);

      if (!options.client.replaceDocument) {
        return;
      }

      void options.client
        .replaceDocument(nextDocument, {
          currentDocument: previousDocument
        })
        .then((authorityDocument) => {
          if (authorityDocument) {
            commitDocument(cloneGraphDocument(authorityDocument));
          }
        })
        .catch(() => {
          // 当前阶段先保持本地替换成功，真实回滚策略留到后续 authority 冲突阶段。
        });
    },

    subscribeOperationConfirmation(
      listener: GraphOperationConfirmationListener
    ): () => void {
      confirmationListeners.add(listener);

      return () => {
        confirmationListeners.delete(listener);
      };
    },

    subscribePending(listener: GraphPendingOperationIdsListener): () => void {
      pendingListeners.add(listener);
      listener([...pendingOperations.keys()]);

      return () => {
        pendingListeners.delete(listener);
      };
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

function normalizeConfirmationDelayMs(
  delayMs: number | undefined
): number {
  if (typeof delayMs !== "number" || Number.isNaN(delayMs)) {
    return 120;
  }

  return Math.max(0, Math.round(delayMs));
}

function resolveNextDocumentRevision(
  revision: GraphDocument["revision"]
): GraphDocument["revision"] {
  if (typeof revision === "number") {
    return Number.isFinite(revision) ? revision + 1 : 1;
  }

  const trimmedRevision = revision.trim();
  if (!trimmedRevision) {
    return "1";
  }

  const numericRevision = Number(trimmedRevision);
  if (Number.isFinite(numericRevision)) {
    return String(numericRevision + 1);
  }

  const markerMatch = /^(.+)#(\d+)$/.exec(trimmedRevision);
  if (markerMatch) {
    return `${markerMatch[1]}#${Number(markerMatch[2]) + 1}`;
  }

  return `${trimmedRevision}#1`;
}

function createDocumentWithNextRevision(document: GraphDocument): GraphDocument {
  return {
    ...document,
    revision: resolveNextDocumentRevision(document.revision)
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
