/**
 * public façade 的 diff operation 分发表。
 *
 * @remarks
 * 这里只处理 `diff.operations` 的结构性增量投影；
 * `fieldChanges` 的 fast-path 和 full refresh 仍由上层流程单独处理。
 */

import type {
  GraphDocument,
  NodeSerializeResult
} from "@leafergraph/node";
import type {
  GraphOperationApplyResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphUpdateNodeInput
} from "@leafergraph/contracts";
import type {
  ApplyGraphDocumentDiffResult,
  GraphDocumentDiff
} from "@leafergraph/contracts/graph-document-diff";
import type { LeaferGraph } from "../leafer_graph";

type DiffProjectionOperation = GraphDocumentDiff["operations"][number];

/**
 * diff operation 投影层依赖的最小 API host 能力。
 */
export interface LeaferGraphDiffProjectionApiHostLike {
  createNode(
    input: Extract<DiffProjectionOperation, { type: "node.create" }>["input"]
  ): unknown;
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  updateNode(nodeId: string, input: LeaferGraphUpdateNodeInput): unknown;
  moveNode(
    nodeId: string,
    input: Extract<DiffProjectionOperation, { type: "node.move" }>["input"]
  ): unknown;
  resizeNode(
    nodeId: string,
    input: Extract<DiffProjectionOperation, { type: "node.resize" }>["input"]
  ): unknown;
  removeNode(nodeId: string): unknown;
  createLink(
    input: Extract<DiffProjectionOperation, { type: "link.create" }>["input"]
  ): unknown;
  removeLink(linkId: string): unknown;
  applyGraphOperation(
    operation: Extract<
      DiffProjectionOperation,
      { type: "link.reconnect" | "node.collapse" | "node.widget.value.set" }
    >
  ): GraphOperationApplyResult;
}

/**
 * diff operation 投影共享上下文。
 */
export interface LeaferGraphDiffProjectionOperationContext {
  /** 当前图实例。 */
  graph: LeaferGraph;
  /** 当前 API host 壳面。 */
  apiHost: LeaferGraphDiffProjectionApiHostLike;
  /** 已合并完成的目标正式文档。 */
  nextDocument: GraphDocument;
  /** 受影响节点集合。 */
  affectedNodeIds: Set<string>;
  /** 受影响连线集合。 */
  affectedLinkIds: Set<string>;
  /** 判断节点图元是否已存在。 */
  hasNodeGraphic(nodeId: string): boolean;
  /** 判断连线图元是否已存在。 */
  hasLinkGraphic(linkId: string): boolean;
  /** 在文档中查找节点快照。 */
  findNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
  /** 根据前后快照构造完整刷新输入。 */
  createRefreshNodeInput(options: {
    currentSnapshot?: NodeSerializeResult;
    nextSnapshot: NodeSerializeResult;
  }): LeaferGraphUpdateNodeInput | null;
  /** 创建整图替换回退结果。 */
  createFallback(reason: string): ApplyGraphDocumentDiffResult;
  /** 优先走 façade 方法，缺失时回退到 API host。 */
  callFacadeMethod<TArgs extends unknown[], TResult>(
    methodName: string,
    fallback: (...args: TArgs) => TResult,
    ...args: TArgs
  ): TResult;
}

type DiffProjectionOperationHandler<
  TOperation extends DiffProjectionOperation = DiffProjectionOperation
> = (
  context: LeaferGraphDiffProjectionOperationContext,
  operation: TOperation
) => ApplyGraphDocumentDiffResult | null;

type DiffProjectionOperationHandlerTable = {
  [TType in DiffProjectionOperation["type"]]: (
    context: LeaferGraphDiffProjectionOperationContext,
    operation: Extract<DiffProjectionOperation, { type: TType }>
  ) => ApplyGraphDocumentDiffResult | null;
};

/**
 * 顺序投影一组 diff operations。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operations - 待投影的结构变更列表。
 * @returns 成功时返回 `null`；需要整图替换时返回 fallback 结果。
 */
export function projectLeaferGraphDiffOperations(
  context: LeaferGraphDiffProjectionOperationContext,
  operations: readonly DiffProjectionOperation[]
): ApplyGraphDocumentDiffResult | null {
  for (const operation of operations) {
    try {
      const handler = diffProjectionOperationHandlers[
        operation.type
      ] as DiffProjectionOperationHandler;
      const fallback = handler(context, operation);
      if (fallback) {
        return fallback;
      }
    } catch (error) {
      return context.createFallback(
        error instanceof Error ? error.message : "diff 增量投影时发生未知异常"
      );
    }
  }

  return null;
}

/**
 * 处理 `document.update` diff operation。
 *
 * @param _context - 当前 diff 投影上下文。
 * @param _operation - 文档根更新操作。
 * @returns 始终返回 `null`，表示继续走增量链路。
 */
function handleDocumentUpdate(
  _context: LeaferGraphDiffProjectionOperationContext,
  _operation: Extract<DiffProjectionOperation, { type: "document.update" }>
): ApplyGraphDocumentDiffResult | null {
  return null;
}

/**
 * 处理 `node.create` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点创建操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeCreate(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.create" }>
): ApplyGraphDocumentDiffResult | null {
  const nodeId = operation.input.id;
  if (!nodeId || context.hasNodeGraphic(nodeId)) {
    return context.createFallback("node.create 无法安全增量投影");
  }

  context.callFacadeMethod(
    "createNode",
    (input) => context.apiHost.createNode(input),
    operation.input
  );
  context.affectedNodeIds.add(nodeId);
  return null;
}

/**
 * 处理 `node.update` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点更新操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeUpdate(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.update" }>
): ApplyGraphDocumentDiffResult | null {
  const snapshot = context.findNodeSnapshot(operation.nodeId);
  const currentSnapshot = context.callFacadeMethod(
    "getNodeSnapshot",
    (nodeId) => context.apiHost.getNodeSnapshot(nodeId),
    operation.nodeId
  );
  const refreshInput =
    snapshot && currentSnapshot
      ? context.createRefreshNodeInput({
          currentSnapshot,
          nextSnapshot: snapshot
        })
      : null;
  if (!snapshot || !refreshInput || !context.hasNodeGraphic(operation.nodeId)) {
    return context.createFallback(`node.update 目标节点缺失: ${operation.nodeId}`);
  }

  if (
    !context.callFacadeMethod(
      "updateNode",
      (nodeId, input) => context.apiHost.updateNode(nodeId, input),
      operation.nodeId,
      refreshInput
    )
  ) {
    return context.createFallback(`node.update 投影失败: ${operation.nodeId}`);
  }

  context.affectedNodeIds.add(operation.nodeId);
  return null;
}

/**
 * 处理 `node.move` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点移动操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeMove(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.move" }>
): ApplyGraphDocumentDiffResult | null {
  if (
    !context.hasNodeGraphic(operation.nodeId) ||
    !context.callFacadeMethod(
      "moveNode",
      (nodeId, input) => context.apiHost.moveNode(nodeId, input),
      operation.nodeId,
      operation.input
    )
  ) {
    return context.createFallback(`node.move 投影失败: ${operation.nodeId}`);
  }

  context.affectedNodeIds.add(operation.nodeId);
  return null;
}

/**
 * 处理 `node.resize` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点尺寸更新操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeResize(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.resize" }>
): ApplyGraphDocumentDiffResult | null {
  if (
    !context.hasNodeGraphic(operation.nodeId) ||
    !context.callFacadeMethod(
      "resizeNode",
      (nodeId, input) => context.apiHost.resizeNode(nodeId, input),
      operation.nodeId,
      operation.input
    )
  ) {
    return context.createFallback(`node.resize 投影失败: ${operation.nodeId}`);
  }

  context.affectedNodeIds.add(operation.nodeId);
  return null;
}

/**
 * 处理 `node.collapse` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点折叠状态操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeCollapse(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.collapse" }>
): ApplyGraphDocumentDiffResult | null {
  if (!context.hasNodeGraphic(operation.nodeId)) {
    return context.createFallback(`node.collapse 投影失败: ${operation.nodeId}`);
  }

  const result = context.callFacadeMethod(
    "applyGraphOperation",
    (nextOperation) => context.apiHost.applyGraphOperation(nextOperation),
    operation
  );
  if (!result.accepted) {
    return context.createFallback(
      result.reason ?? `node.collapse 投影失败: ${operation.nodeId}`
    );
  }

  result.affectedNodeIds.forEach((nodeId) => context.affectedNodeIds.add(nodeId));
  return null;
}

/**
 * 处理 `node.widget.value.set` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点 Widget 值更新操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeWidgetValueSet(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.widget.value.set" }>
): ApplyGraphDocumentDiffResult | null {
  if (!context.hasNodeGraphic(operation.nodeId)) {
    return context.createFallback(
      `node.widget.value.set 投影失败: ${operation.nodeId}`
    );
  }

  const result = context.callFacadeMethod(
    "applyGraphOperation",
    (nextOperation) => context.apiHost.applyGraphOperation(nextOperation),
    operation
  );
  if (!result.accepted) {
    return context.createFallback(
      result.reason ?? `node.widget.value.set 投影失败: ${operation.nodeId}`
    );
  }

  result.affectedNodeIds.forEach((nodeId) => context.affectedNodeIds.add(nodeId));
  return null;
}

/**
 * 处理 `node.remove` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 节点删除操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleNodeRemove(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "node.remove" }>
): ApplyGraphDocumentDiffResult | null {
  if (
    !context.hasNodeGraphic(operation.nodeId) ||
    !context.callFacadeMethod(
      "removeNode",
      (nodeId) => context.apiHost.removeNode(nodeId),
      operation.nodeId
    )
  ) {
    return context.createFallback(`node.remove 投影失败: ${operation.nodeId}`);
  }

  context.affectedNodeIds.add(operation.nodeId);
  return null;
}

/**
 * 处理 `link.create` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 连线创建操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleLinkCreate(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "link.create" }>
): ApplyGraphDocumentDiffResult | null {
  const linkId = operation.input.id;
  if (!linkId || context.hasLinkGraphic(linkId)) {
    return context.createFallback("link.create 无法安全增量投影");
  }

  context.callFacadeMethod(
    "createLink",
    (input) => context.apiHost.createLink(input),
    operation.input as LeaferGraphCreateLinkInput
  );
  context.affectedNodeIds.add(operation.input.source.nodeId);
  context.affectedNodeIds.add(operation.input.target.nodeId);
  context.affectedLinkIds.add(linkId);
  return null;
}

/**
 * 处理 `link.remove` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 连线删除操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleLinkRemove(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "link.remove" }>
): ApplyGraphDocumentDiffResult | null {
  if (
    !context.hasLinkGraphic(operation.linkId) ||
    !context.callFacadeMethod(
      "removeLink",
      (linkId) => context.apiHost.removeLink(linkId),
      operation.linkId
    )
  ) {
    return context.createFallback(`link.remove 投影失败: ${operation.linkId}`);
  }

  context.affectedLinkIds.add(operation.linkId);
  return null;
}

/**
 * 处理 `link.reconnect` diff operation。
 *
 * @param context - 当前 diff 投影上下文。
 * @param operation - 连线重连操作。
 * @returns 成功时返回 `null`；失败时返回 full replace fallback。
 */
function handleLinkReconnect(
  context: LeaferGraphDiffProjectionOperationContext,
  operation: Extract<DiffProjectionOperation, { type: "link.reconnect" }>
): ApplyGraphDocumentDiffResult | null {
  if (!context.hasLinkGraphic(operation.linkId)) {
    return context.createFallback(
      `link.reconnect 目标连线缺失: ${operation.linkId}`
    );
  }

  const result = context.callFacadeMethod(
    "applyGraphOperation",
    (nextOperation) => context.apiHost.applyGraphOperation(nextOperation),
    operation
  );
  if (!result.accepted) {
    return context.createFallback(
      result.reason ?? `link.reconnect 投影失败: ${operation.linkId}`
    );
  }

  result.affectedNodeIds.forEach((nodeId) => context.affectedNodeIds.add(nodeId));
  result.affectedLinkIds.forEach((linkId) => context.affectedLinkIds.add(linkId));
  return null;
}

const diffProjectionOperationHandlers = {
  "document.update": handleDocumentUpdate,
  "node.create": handleNodeCreate,
  "node.update": handleNodeUpdate,
  "node.move": handleNodeMove,
  "node.resize": handleNodeResize,
  "node.collapse": handleNodeCollapse,
  "node.widget.value.set": handleNodeWidgetValueSet,
  "node.remove": handleNodeRemove,
  "link.create": handleLinkCreate,
  "link.remove": handleLinkRemove,
  "link.reconnect": handleLinkReconnect
} satisfies DiffProjectionOperationHandlerTable;
