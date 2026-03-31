/**
 * `LeaferGraphApiHost` 正式图操作历史分发表。
 *
 * @remarks
 * 这一层专门负责把已成功应用的正式图操作归类为对应的 history record，
 * 避免 `document.ts` 继续内联长段 `operation.type` 分发。
 */

import type {
  GraphDocument,
  GraphLink,
  NodeSerializeResult
} from "@leafergraph/node";
import {
  createLinkCreateHistoryRecord,
  createLinkReconnectHistoryRecord,
  createLinkRemoveHistoryRecord,
  createNodeCreateHistoryRecord,
  createNodeMoveHistoryRecord,
  createNodeResizeHistoryRecord,
  createSnapshotHistoryRecord
} from "../../graph/history";
import type {
  LeaferGraphApiGraphOperation,
  LeaferGraphApiGraphOperationResult,
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";

type SnapshotOperationType = Extract<
  LeaferGraphApiGraphOperation,
  { type: "node.update" | "node.remove" | "document.update" }
>["type"];

/**
 * 正式图操作历史分发共享上下文。
 *
 * @typeParam TNodeState - 当前运行时中的节点状态。
 * @typeParam TNodeViewState - 节点视图状态。
 * @typeParam TLinkViewState - 连线视图状态。
 * @typeParam TOperation - 当前历史分发对应的操作类型。
 */
export interface LeaferGraphApiOperationHistoryContext<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState,
  TOperation extends LeaferGraphApiGraphOperation = LeaferGraphApiGraphOperation
> {
  /** API host 共享上下文。 */
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>;
  /** 已成功应用的正式图操作。 */
  operation: TOperation;
  /** 场景运行时返回的正式图操作结果。 */
  result: LeaferGraphApiGraphOperationResult;
  /** 历史捕获前的正式图文档。 */
  beforeDocument: GraphDocument;
  /** 历史捕获前的节点快照。 */
  beforeNodeSnapshot?: NodeSerializeResult;
  /** 历史捕获前的连线快照。 */
  beforeLink?: GraphLink;
}

type LeaferGraphApiOperationHistoryHandlerTable = {
  [TType in LeaferGraphApiGraphOperation["type"]]: <
    TNodeState extends LeaferGraphRenderableNodeState,
    TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
    TLinkViewState extends LeaferGraphApiLinkViewState
  >(
    context: LeaferGraphApiOperationHistoryContext<
      TNodeState,
      TNodeViewState,
      TLinkViewState,
      Extract<LeaferGraphApiGraphOperation, { type: TType }>
    >
  ) => void;
};

/**
 * 发出一条正式图操作对应的 history record。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
export function emitLeaferGraphApiGraphOperationHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState
  >
): void {
  const handler = graphOperationHistoryHandlers[
    context.operation.type
  ] as <
    TResolvedNodeState extends LeaferGraphRenderableNodeState,
    TResolvedNodeViewState extends LeaferGraphApiNodeViewState<TResolvedNodeState>,
    TResolvedLinkViewState extends LeaferGraphApiLinkViewState
  >(
    nextContext: LeaferGraphApiOperationHistoryContext<
      TResolvedNodeState,
      TResolvedNodeViewState,
      TResolvedLinkViewState
    >
  ) => void;
  handler(context);
}

/**
 * 处理 `node.create` 的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleNodeCreateHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<LeaferGraphApiGraphOperation, { type: "node.create" }>
  >
): void {
  const runtime = context.context.options.runtime;
  const nodeSnapshot = context.result.affectedNodeIds[0]
    ? runtime.nodeRuntimeHost.getNodeSnapshot(context.result.affectedNodeIds[0])
    : undefined;
  if (nodeSnapshot) {
    context.context.emitHistoryRecord(
      createNodeCreateHistoryRecord({
        nodeSnapshot,
        source: context.operation.source || "api"
      })
    );
  }
}

/**
 * 处理 `node.move` 的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleNodeMoveHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<LeaferGraphApiGraphOperation, { type: "node.move" }>
  >
): void {
  const afterSnapshot = context.context.options.runtime.nodeRuntimeHost.getNodeSnapshot(
    context.operation.nodeId
  );
  if (context.beforeNodeSnapshot && afterSnapshot) {
    context.context.emitHistoryRecord(
      createNodeMoveHistoryRecord({
        nodeId: context.operation.nodeId,
        before: {
          x: context.beforeNodeSnapshot.layout.x,
          y: context.beforeNodeSnapshot.layout.y
        },
        after: {
          x: afterSnapshot.layout.x,
          y: afterSnapshot.layout.y
        },
        source: context.operation.source || "api"
      })
    );
  }
}

/**
 * 处理 `node.resize` 的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleNodeResizeHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<LeaferGraphApiGraphOperation, { type: "node.resize" }>
  >
): void {
  const afterSnapshot = context.context.options.runtime.nodeRuntimeHost.getNodeSnapshot(
    context.operation.nodeId
  );
  if (context.beforeNodeSnapshot && afterSnapshot) {
    context.context.emitHistoryRecord(
      createNodeResizeHistoryRecord({
        nodeId: context.operation.nodeId,
        before: context.context.resolveNodeSizeForHistory(
          context.operation.nodeId,
          context.beforeNodeSnapshot
        ),
        after: context.context.resolveNodeSizeForHistory(
          context.operation.nodeId,
          afterSnapshot
        ),
        source: context.operation.source || "api"
      })
    );
  }
}

/**
 * 处理 `link.create` 的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleLinkCreateHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<LeaferGraphApiGraphOperation, { type: "link.create" }>
  >
): void {
  const runtime = context.context.options.runtime;
  const link = context.result.affectedLinkIds[0]
    ? runtime.sceneRuntime.getLink(context.result.affectedLinkIds[0])
    : undefined;
  if (link) {
    context.context.emitHistoryRecord(
      createLinkCreateHistoryRecord({
        link,
        source: context.operation.source || "api"
      })
    );
  }
}

/**
 * 处理 `link.remove` 的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleLinkRemoveHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<LeaferGraphApiGraphOperation, { type: "link.remove" }>
  >
): void {
  if (context.beforeLink) {
    context.context.emitHistoryRecord(
      createLinkRemoveHistoryRecord({
        link: context.beforeLink,
        source: context.operation.source || "api"
      })
    );
  }
}

/**
 * 处理 `link.reconnect` 的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleLinkReconnectHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<LeaferGraphApiGraphOperation, { type: "link.reconnect" }>
  >
): void {
  const afterLink = context.context.options.runtime.sceneRuntime.getLink(
    context.operation.linkId
  );
  if (context.beforeLink && afterLink) {
    context.context.emitHistoryRecord(
      createLinkReconnectHistoryRecord({
        linkId: context.operation.linkId,
        before: context.beforeLink,
        after: afterLink,
        source: context.operation.source || "api"
      })
    );
  }
}

/**
 * 处理 snapshot 型正式图操作的 history record 发射。
 *
 * @param context - 当前历史分发上下文。
 * @returns 无返回值。
 */
function handleSnapshotHistory<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiOperationHistoryContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState,
    Extract<
      LeaferGraphApiGraphOperation,
      { type: "node.update" | "node.remove" | "document.update" }
    >
  >
): void {
  context.context.emitHistoryRecord(
    createSnapshotHistoryRecord({
      beforeDocument: context.beforeDocument,
      afterDocument: context.context.options.runtime.getGraphDocument(),
      source: context.operation.source || "api",
      label: SNAPSHOT_OPERATION_LABELS[context.operation.type]
    })
  );
}

const SNAPSHOT_OPERATION_LABELS = {
  "node.update": "Update Node",
  "node.remove": "Remove Node",
  "document.update": "Update Document"
} satisfies Record<SnapshotOperationType, string>;

const graphOperationHistoryHandlers = {
  "node.create": handleNodeCreateHistory,
  "node.move": handleNodeMoveHistory,
  "node.resize": handleNodeResizeHistory,
  "link.create": handleLinkCreateHistory,
  "link.remove": handleLinkRemoveHistory,
  "link.reconnect": handleLinkReconnectHistory,
  "node.update": handleSnapshotHistory,
  "node.remove": handleSnapshotHistory,
  "document.update": handleSnapshotHistory
} satisfies LeaferGraphApiOperationHistoryHandlerTable;
