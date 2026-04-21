/**
 * 图场景运行时的正式图操作分发表。
 *
 * @remarks
 * 这一层专门负责 `GraphOperation["type"]` 到具体 handler 的分发，
 * 让宿主入口文件只保留 `try/catch` 和上下文组装。
 */

import type { GraphLink, NodeRuntimeState } from "@leafergraph/core/node";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphNodeStateChangeReason,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateDocumentInput,
  LeaferGraphUpdateNodeInput
} from "@leafergraph/core/contracts";
import type { GraphDragNodePosition } from "../../interaction/graph_interaction_runtime_host";
import type { GraphDocumentRootState } from "../types";

/**
 * `scene runtime` 内部使用的正式图操作应用结果。
 *
 * @typeParam TNodeState - 当前运行时中的节点状态。
 */
export type InternalGraphOperationApplyResult<
  TNodeState extends NodeRuntimeState
> = GraphOperationApplyResult & {
  node?: TNodeState;
  link?: GraphLink;
};

/**
 * 场景运行时层依赖的图变更能力。
 *
 * @remarks
 * 这里聚焦正式图的节点、连线增删改移，不承担交互态和渲染层状态管理。
 *
 * @typeParam TNodeState - 当前运行时中的节点状态。
 */
export interface LeaferGraphSceneRuntimeMutationHostLike<
  TNodeState extends NodeRuntimeState
> {
  findLinksByNode(nodeId: string): GraphLink[];
  getLink(linkId: string): GraphLink | undefined;
  createNode(input: LeaferGraphCreateNodeInput): TNodeState;
  removeNode(nodeId: string): boolean;
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined;
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined;
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined;
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
  renameNode(nodeId: string, newTitle: string): void;
  setNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    newValue: unknown
  ): boolean;
  commitNodeWidgetValue(
    nodeId: string,
    widgetIndex: number,
    commit: {
      newValue?: unknown;
      beforeValue: unknown;
      beforeWidgets: NodeRuntimeState["widgets"];
    }
  ): void;
  createLink(input: LeaferGraphCreateLinkInput): GraphLink;
  removeLink(linkId: string): boolean;
  moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): string[];
}

/**
 * 图操作分发器依赖的最小上下文。
 *
 * @typeParam TNodeState - 当前运行时中的节点状态。
 */
export interface LeaferGraphSceneRuntimeDispatchContext<
  TNodeState extends NodeRuntimeState
> {
  /** 当前正式图根状态。 */
  graphDocument: GraphDocumentRootState;
  /** 当前正式节点容器。 */
  graphNodes: Map<string, TNodeState>;
  /** 正式图变更宿主。 */
  mutationHost: LeaferGraphSceneRuntimeMutationHostLike<TNodeState>;
  /** 节点状态变化通知钩子。 */
  notifyNodeStateChanged?(
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason
  ): void;
}

type SceneRuntimeOperationHandler<
  TNodeState extends NodeRuntimeState,
  TOperation extends GraphOperation = GraphOperation
> = (
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: TOperation
) => InternalGraphOperationApplyResult<TNodeState>;

type SceneRuntimeOperationHandlerTable = {
  [TType in GraphOperation["type"]]: <
    TNodeState extends NodeRuntimeState
  >(
    context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
    operation: Extract<GraphOperation, { type: TType }>
  ) => InternalGraphOperationApplyResult<TNodeState>;
};

/**
 * 分发一条正式图操作到对应 handler。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 待应用的正式图操作。
 * @returns 标准化的操作应用结果。
 */
export function dispatchSceneRuntimeGraphOperation<
  TNodeState extends NodeRuntimeState
>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: GraphOperation
): InternalGraphOperationApplyResult<TNodeState> {
  const handler = sceneRuntimeOperationHandlers[operation.type] as SceneRuntimeOperationHandler<
    TNodeState
  >;
  return handler(context, operation);
}

/**
 * 处理 `document.update` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 文档根字段补丁操作。
 * @returns 标准化的操作应用结果。
 */
function handleDocumentUpdate<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "document.update" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const changed = hasDocumentRootPatch(operation.input);
  if (changed) {
    patchGraphDocumentRoot(context.graphDocument, operation.input);
  }

  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason: changed ? undefined : "文档根字段补丁为空"
  };
}

/**
 * 处理 `node.create` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点创建操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeCreate<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.create" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const node = context.mutationHost.createNode(operation.input);
  context.notifyNodeStateChanged?.(node.id, "created");

  return {
    accepted: true,
    changed: true,
    operation,
    affectedNodeIds: [node.id],
    affectedLinkIds: [],
    node
  };
}

/**
 * 处理 `node.update` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点更新操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeUpdate<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.update" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentNode = context.graphNodes.get(operation.nodeId);
  if (!currentNode) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const before = createComparableNodeSnapshot(currentNode);
  const node = context.mutationHost.updateNode(operation.nodeId, operation.input);
  if (!node) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const changed = !isStructurallyEqual(
    before,
    createComparableNodeSnapshot(node)
  );
  if (changed) {
    context.notifyNodeStateChanged?.(operation.nodeId, "updated");
  }

  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: [],
    reason: changed ? undefined : "节点补丁没有产生变化",
    node
  };
}

/**
 * 处理 `node.move` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点移动操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeMove<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.move" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentNode = context.graphNodes.get(operation.nodeId);
  if (!currentNode) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const before = {
    x: currentNode.layout.x,
    y: currentNode.layout.y
  };
  const node = context.mutationHost.moveNode(operation.nodeId, operation.input);
  if (!node) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const changed = before.x !== node.layout.x || before.y !== node.layout.y;
  if (changed) {
    context.notifyNodeStateChanged?.(operation.nodeId, "moved");
  }

  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: [],
    reason: changed ? undefined : "节点位置没有变化",
    node
  };
}

/**
 * 处理 `node.resize` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点尺寸更新操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeResize<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.resize" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentNode = context.graphNodes.get(operation.nodeId);
  if (!currentNode) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const before = {
    width: currentNode.layout.width,
    height: currentNode.layout.height
  };
  const node = context.mutationHost.resizeNode(operation.nodeId, operation.input);
  if (!node) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const changed =
    before.width !== node.layout.width || before.height !== node.layout.height;
  if (changed) {
    context.notifyNodeStateChanged?.(operation.nodeId, "resized");
  }

  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: [],
    reason: changed ? undefined : "节点尺寸没有变化或当前不允许调整",
    node
  };
}

/**
 * 处理 `node.collapse` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点折叠状态操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeCollapse<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.collapse" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentNode = context.graphNodes.get(operation.nodeId);
  if (!currentNode) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const changed = context.mutationHost.setNodeCollapsed(
    operation.nodeId,
    operation.collapsed
  );
  if (changed) {
    context.notifyNodeStateChanged?.(operation.nodeId, "collapsed");
  }

  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: [],
    reason: changed ? undefined : "节点折叠状态没有变化",
    node: context.graphNodes.get(operation.nodeId)
  };
}

/**
 * 处理 `node.widget.value.set` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点 Widget 值写入操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeWidgetValueSet<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.widget.value.set" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentNode = context.graphNodes.get(operation.nodeId);
  if (!currentNode) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const widget = currentNode.widgets[operation.widgetIndex];
  if (!widget) {
    return rejectGraphOperation(
      operation,
      `节点 widget 不存在：${operation.nodeId}#${operation.widgetIndex}`
    );
  }

  const changed = context.mutationHost.setNodeWidgetValue(
    operation.nodeId,
    operation.widgetIndex,
    operation.value
  );
  if (changed) {
    context.notifyNodeStateChanged?.(operation.nodeId, "widget-value");
  }

  return {
    accepted: true,
    changed,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: [],
    reason: changed ? undefined : "节点 widget 值没有变化",
    node: context.graphNodes.get(operation.nodeId)
  };
}

/**
 * 处理 `node.remove` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点删除操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeRemove<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.remove" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const node = context.graphNodes.get(operation.nodeId);
  if (!node) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  const relatedLinks = context.mutationHost.findLinksByNode(node.id);
  const removed = context.mutationHost.removeNode(operation.nodeId);
  if (!removed) {
    return rejectGraphOperation(operation, `节点删除失败：${operation.nodeId}`);
  }

  context.notifyNodeStateChanged?.(operation.nodeId, "removed");
  return {
    accepted: true,
    changed: true,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: relatedLinks.map((link) => link.id)
  };
}

/**
 * 处理 `node.rename` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 节点重命名操作。
 * @returns 标准化的操作应用结果。
 */
function handleNodeRename<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "node.rename" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const current = context.graphNodes.get(operation.nodeId);
  if (!current) {
    return rejectGraphOperation(operation, `节点不存在：${operation.nodeId}`);
  }

  if (current.title === operation.title) {
    return {
      accepted: true,
      changed: false,
      operation,
      affectedNodeIds: [],
      affectedLinkIds: [],
      reason: "标题未发生变化"
    };
  }

  context.mutationHost.renameNode(operation.nodeId, operation.title);
  context.notifyNodeStateChanged?.(operation.nodeId, "updated");

  return {
    accepted: true,
    changed: true,
    operation,
    affectedNodeIds: [operation.nodeId],
    affectedLinkIds: [],
    node: context.graphNodes.get(operation.nodeId)
  };
}

/**
 * 处理 `link.create` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 连线创建操作。
 * @returns 标准化的操作应用结果。
 */
function handleLinkCreate<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "link.create" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const link = context.mutationHost.createLink(operation.input);

  return {
    accepted: true,
    changed: true,
    operation,
    affectedNodeIds: uniqueNodeIds([link.source.nodeId, link.target.nodeId]),
    affectedLinkIds: [link.id],
    link
  };
}

/**
 * 处理 `link.remove` 正式图操作。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 连线删除操作。
 * @returns 标准化的操作应用结果。
 */
function handleLinkRemove<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "link.remove" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentLink = context.mutationHost.getLink(operation.linkId);
  if (!currentLink) {
    return rejectGraphOperation(operation, `连线不存在：${operation.linkId}`);
  }

  const removed = context.mutationHost.removeLink(operation.linkId);
  if (!removed) {
    return rejectGraphOperation(operation, `连线删除失败：${operation.linkId}`);
  }

  return {
    accepted: true,
    changed: true,
    operation,
    affectedNodeIds: uniqueNodeIds([
      currentLink.source.nodeId,
      currentLink.target.nodeId
    ]),
    affectedLinkIds: [operation.linkId]
  };
}

/**
 * 处理 `link.reconnect` 正式图操作。
 *
 * @remarks
 * 这里仍保留“先删除旧连线，失败时尽量回滚”的现有语义，
 * 避免重连链路在拆分后改变错误恢复策略。
 *
 * @param context - 当前场景运行时上下文。
 * @param operation - 连线重连操作。
 * @returns 标准化的操作应用结果。
 */
function handleLinkReconnect<TNodeState extends NodeRuntimeState>(
  context: LeaferGraphSceneRuntimeDispatchContext<TNodeState>,
  operation: Extract<GraphOperation, { type: "link.reconnect" }>
): InternalGraphOperationApplyResult<TNodeState> {
  const currentLink = context.mutationHost.getLink(operation.linkId);
  if (!currentLink) {
    return rejectGraphOperation(operation, `连线不存在：${operation.linkId}`);
  }

  // 先解析目标端点，确保“无变化”的情况可以在正式删除前直接短路返回。
  const nextInput: LeaferGraphCreateLinkInput = {
    id: currentLink.id,
    source: operation.input.source ?? currentLink.source,
    target: operation.input.target ?? currentLink.target,
    label: currentLink.label,
    data: currentLink.data
  };
  if (isSameLinkEndpoint(currentLink, nextInput)) {
    return {
      accepted: true,
      changed: false,
      operation,
      affectedNodeIds: uniqueNodeIds([
        currentLink.source.nodeId,
        currentLink.target.nodeId
      ]),
      affectedLinkIds: [currentLink.id],
      reason: "连线端点没有变化",
      link: currentLink
    };
  }

  // 再执行删除 + 重建；若创建失败则尽量恢复旧连线，并把首个错误保留为真正根因。
  if (!context.mutationHost.removeLink(operation.linkId)) {
    return rejectGraphOperation(operation, `连线删除失败：${operation.linkId}`);
  }

  try {
    const link = context.mutationHost.createLink(nextInput);
    return {
      accepted: true,
      changed: true,
      operation,
      affectedNodeIds: uniqueNodeIds([
        currentLink.source.nodeId,
        currentLink.target.nodeId,
        link.source.nodeId,
        link.target.nodeId
      ]),
      affectedLinkIds: [link.id],
      link
    };
  } catch (error) {
    try {
      context.mutationHost.createLink(currentLink);
    } catch {
      // 当前阶段优先保留第一次失败作为真正根因。
    }

    return rejectGraphOperation(
      operation,
      error instanceof Error ? error.message : "连线重连失败"
    );
  }
}

const sceneRuntimeOperationHandlers = {
  "document.update": handleDocumentUpdate,
  "node.create": handleNodeCreate,
  "node.update": handleNodeUpdate,
  "node.move": handleNodeMove,
  "node.resize": handleNodeResize,
  "node.collapse": handleNodeCollapse,
  "node.widget.value.set": handleNodeWidgetValueSet,
  "node.rename": handleNodeRename,
  "node.remove": handleNodeRemove,
  "link.create": handleLinkCreate,
  "link.remove": handleLinkRemove,
  "link.reconnect": handleLinkReconnect
} satisfies SceneRuntimeOperationHandlerTable;

/**
 * 创建节点可比对快照。
 *
 * @param node - 待比较的节点状态。
 * @returns 可安全结构比较的节点快照。
 */
function createComparableNodeSnapshot<TNodeState extends NodeRuntimeState>(
  node: TNodeState
): unknown {
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

/**
 * 判断两个值在结构上是否等价。
 *
 * @param left - 左侧值。
 * @param right - 右侧值。
 * @returns 结构是否一致。
 */
function isStructurallyEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

/**
 * 对节点 ID 集合做去重和空值过滤。
 *
 * @param nodeIds - 节点 ID 列表。
 * @returns 去重后的节点 ID 列表。
 */
function uniqueNodeIds(nodeIds: readonly string[]): string[] {
  return [...new Set(nodeIds.filter(Boolean))];
}

/**
 * 判断文档根补丁是否真的包含正式字段变化。
 *
 * @param input - 文档根补丁输入。
 * @returns 是否至少包含一个有效字段。
 */
function hasDocumentRootPatch(input: LeaferGraphUpdateDocumentInput): boolean {
  return (
    input.appKind !== undefined ||
    input.meta !== undefined ||
    input.capabilityProfile !== undefined ||
    input.adapterBinding !== undefined
  );
}

/**
 * 将文档根补丁回写到当前正式文档。
 *
 * @param document - 当前正式文档根状态。
 * @param input - 待应用的补丁。
 * @returns 无返回值。
 */
function patchGraphDocumentRoot(
  document: GraphDocumentRootState,
  input: LeaferGraphUpdateDocumentInput
): void {
  if (input.appKind !== undefined) {
    document.appKind = input.appKind;
  }

  if (input.meta !== undefined) {
    document.meta = input.meta ? structuredClone(input.meta) : undefined;
  }

  if (input.capabilityProfile !== undefined) {
    document.capabilityProfile = input.capabilityProfile
      ? structuredClone(input.capabilityProfile)
      : undefined;
  }

  if (input.adapterBinding !== undefined) {
    document.adapterBinding = input.adapterBinding
      ? structuredClone(input.adapterBinding)
      : undefined;
  }
}

/**
 * 判断两条连线的端点是否完全一致。
 *
 * @param left - 左侧连线端点。
 * @param right - 右侧连线端点。
 * @returns 端点是否完全相同。
 */
function isSameLinkEndpoint(
  left: Pick<GraphLink, "source" | "target">,
  right: Pick<GraphLink, "source" | "target">
): boolean {
  return (
    left.source.nodeId === right.source.nodeId &&
    (left.source.slot ?? 0) === (right.source.slot ?? 0) &&
    left.target.nodeId === right.target.nodeId &&
    (left.target.slot ?? 0) === (right.target.slot ?? 0)
  );
}

/**
 * 构造一条拒绝的正式图操作应用结果。
 *
 * @param operation - 当前正式图操作。
 * @param reason - 拒绝原因。
 * @returns 标准化的拒绝结果。
 */
function rejectGraphOperation<TNodeState extends NodeRuntimeState>(
  operation: GraphOperation,
  reason: string
): InternalGraphOperationApplyResult<TNodeState> {
  return {
    accepted: false,
    changed: false,
    operation,
    affectedNodeIds: [],
    affectedLinkIds: [],
    reason
  };
}
