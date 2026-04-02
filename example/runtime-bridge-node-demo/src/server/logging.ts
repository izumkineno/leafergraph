import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphHistoryEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/runtime-bridge/portable";
import type {
  RuntimeBridgeControlCommand,
  RuntimeBridgeInboundEvent
} from "@leafergraph/runtime-bridge/transport";
import type {
  DemoBridgeClientMessage,
  DemoBridgeServerMessage
} from "../shared/protocol";

/**
 * 输出 demo 服务端日志。
 *
 * @param scope - 日志来源范围。
 * @param action - 当前动作名称。
 * @param detail - 可选详情。
 * @returns 无返回值。
 */
export function logRuntimeBridgeServer(
  scope: string,
  action: string,
  detail?: string
): void {
  const timestamp = new Date().toISOString();
  if (detail) {
    console.log(`[runtime-bridge-node-demo][${timestamp}][${scope}] ${action} ${detail}`);
    return;
  }

  console.log(`[runtime-bridge-node-demo][${timestamp}][${scope}] ${action}`);
}

/**
 * 输出 demo 服务端错误日志。
 *
 * @param scope - 日志来源范围。
 * @param action - 当前动作名称。
 * @param detail - 可选详情。
 * @returns 无返回值。
 */
export function logRuntimeBridgeServerError(
  scope: string,
  action: string,
  detail?: string
): void {
  const timestamp = new Date().toISOString();
  if (detail) {
    console.error(
      `[runtime-bridge-node-demo][${timestamp}][${scope}] ${action} ${detail}`
    );
    return;
  }

  console.error(`[runtime-bridge-node-demo][${timestamp}][${scope}] ${action}`);
}

/**
 * 格式化文档摘要。
 *
 * @param document - 图文档。
 * @returns 摘要文本。
 */
export function formatDocumentSummary(document: {
  documentId: string;
  revision: string | number;
  nodes: readonly unknown[];
  links: readonly unknown[];
}): string {
  return `document=${document.documentId} revision=${String(document.revision)} nodes=${document.nodes.length} links=${document.links.length}`;
}

/**
 * 格式化单条图操作，便于直接打印行为日志。
 *
 * @param operation - 图操作。
 * @returns 可读行为文本。
 */
export function formatGraphOperationBehavior(operation: GraphOperation): string {
  switch (operation.type) {
    case "node.create":
      return `创建节点 type=${operation.input.type} id=${operation.input.id ?? "auto"} at=(${Number(operation.input.x ?? 0)}, ${Number(operation.input.y ?? 0)})`;
    case "node.update":
      return `更新节点 node=${operation.nodeId} fields=${formatObjectKeys(operation.input)}`;
    case "node.move":
      return `移动节点 node=${operation.nodeId} -> (${operation.input.x}, ${operation.input.y})`;
    case "node.resize":
      return `调整节点尺寸 node=${operation.nodeId} -> ${operation.input.width}x${operation.input.height}`;
    case "node.collapse":
      return `${operation.collapsed ? "折叠" : "展开"}节点 node=${operation.nodeId}`;
    case "node.widget.value.set":
      return `写入控件值 node=${operation.nodeId} widget=${operation.widgetIndex} value=${formatUnknownValue(operation.value)}`;
    case "node.remove":
      return `删除节点 node=${operation.nodeId}`;
    case "document.update":
      return `更新文档 fields=${formatObjectKeys(operation.input)}`;
    case "link.create":
      return `创建连线 ${operation.input.source.nodeId}:${String(operation.input.source.slot ?? "")} -> ${operation.input.target.nodeId}:${String(operation.input.target.slot ?? "")}`;
    case "link.remove":
      return `删除连线 link=${operation.linkId}`;
    case "link.reconnect":
      return `重连连线 link=${operation.linkId} patch=${formatUnknownValue(operation.input)}`;
  }

  return "unknown-operation";
}

/**
 * 格式化操作应用结果。
 *
 * @param result - 应用结果。
 * @returns 可读结果文本。
 */
export function formatGraphOperationResult(
  result: GraphOperationApplyResult
): string {
  return [
    result.accepted ? "accepted" : "rejected",
    result.changed ? "changed" : "unchanged",
    formatGraphOperationBehavior(result.operation),
    result.affectedNodeIds.length
      ? `affectedNodes=${result.affectedNodeIds.join(",")}`
      : "",
    result.affectedLinkIds.length
      ? `affectedLinks=${result.affectedLinkIds.join(",")}`
      : "",
    result.reason ? `reason=${result.reason}` : ""
  ]
    .filter((part) => part)
    .join(" | ");
}

/**
 * 格式化控制命令。
 *
 * @param command - 控制命令。
 * @returns 命令摘要。
 */
export function formatControlCommandBehavior(
  command: RuntimeBridgeControlCommand
): string {
  switch (command.type) {
    case "play":
      return "运行整图";
    case "step":
      return "单步执行";
    case "stop":
      return "停止执行";
    case "play-from-node":
      return `从指定节点执行 node=${command.nodeId}`;
  }

  return "unknown-control-command";
}

/**
 * 格式化 bridge 入站事件。
 *
 * @param event - bridge 事件。
 * @returns 可读文本。
 */
export function formatInboundEventBehavior(
  event: RuntimeBridgeInboundEvent
): string {
  switch (event.type) {
    case "document.snapshot":
      return `整图快照 ${formatDocumentSummary(event.document)}`;
    case "document.diff":
      return `文档增量 base=${String(event.diff.baseRevision)} -> revision=${String(event.diff.revision)} ops=${event.diff.operations.length}${formatOperationPreview(event.diff.operations)}`;
    case "runtime.feedback":
      return formatRuntimeFeedbackBehavior(event.feedback);
    case "history.event":
      return formatHistoryEventBehavior(event.event);
  }

  return "unknown-inbound-event";
}

/**
 * 格式化客户端消息。
 *
 * @param message - 客户端消息。
 * @returns 摘要文本。
 */
export function formatClientMessageBehavior(
  message: DemoBridgeClientMessage
): string {
  switch (message.type) {
    case "snapshot.request":
      return `requestId=${message.requestId} 拉取整图快照`;
    case "operations.submit":
      return `requestId=${message.requestId} 提交操作 ${message.operations.length} 条${formatOperationPreview(message.operations)}`;
    case "control.send":
      return `requestId=${message.requestId} 控制命令 ${formatControlCommandBehavior(message.command)}`;
  }

  return "unknown-client-message";
}

/**
 * 格式化服务端消息。
 *
 * @param message - 服务端消息。
 * @returns 摘要文本。
 */
export function formatServerMessageBehavior(
  message: DemoBridgeServerMessage
): string {
  switch (message.type) {
    case "snapshot.response":
      return `requestId=${message.requestId} 返回快照 ${formatDocumentSummary(message.document)}`;
    case "operations.response":
      return `requestId=${message.requestId} 返回操作结果 ${message.results.length} 条`;
    case "control.response":
      return `requestId=${message.requestId} 控制命令已确认`;
    case "bridge.event":
      return formatInboundEventBehavior(message.event);
    case "bridge.error":
      return `requestId=${message.requestId ?? "none"} error=${message.message}`;
  }

  return "unknown-server-message";
}

/**
 * 格式化运行反馈行为。
 *
 * @param feedback - 运行反馈。
 * @returns 可读文本。
 */
export function formatRuntimeFeedbackBehavior(
  feedback: RuntimeFeedbackEvent
): string {
  switch (feedback.type) {
    case "graph.execution":
      return `图执行事件 type=${feedback.event.type} status=${feedback.event.state.status} queue=${feedback.event.state.queueSize} step=${feedback.event.state.stepCount}`;
    case "node.execution":
      return `节点执行 node=${feedback.event.nodeTitle || feedback.event.nodeId}(${feedback.event.nodeId}) trigger=${feedback.event.trigger} sequence=${feedback.event.sequence} depth=${feedback.event.depth}`;
    case "link.propagation":
      return `连线传播 ${feedback.event.sourceNodeId}:${feedback.event.sourceSlot} -> ${feedback.event.targetNodeId}:${feedback.event.targetSlot} payload=${formatUnknownValue(feedback.event.payload)}`;
    case "node.state":
      return `节点状态 node=${feedback.event.nodeId} reason=${feedback.event.reason} exists=${feedback.event.exists}`;
  }

  return "unknown-runtime-feedback";
}

/**
 * 格式化历史事件行为。
 *
 * @param event - 历史事件。
 * @returns 可读文本。
 */
export function formatHistoryEventBehavior(
  event: LeaferGraphHistoryEvent
): string {
  switch (event.type) {
    case "history.reset":
      return `历史重置 reason=${event.reason}`;
    case "history.record":
      if (event.record.kind === "operation") {
        return `历史记录 kind=operation label=${event.record.label ?? "none"} redo=${event.record.redoOperations.length}${formatOperationPreview(event.record.redoOperations)}`;
      }

      return `历史记录 kind=snapshot label=${event.record.label ?? "none"} before=${String(event.record.beforeDocument.revision)} after=${String(event.record.afterDocument.revision)}`;
  }

  return "unknown-history-event";
}

function formatOperationPreview(operations: readonly GraphOperation[]): string {
  if (!operations.length) {
    return "";
  }

  return ` [${operations
    .slice(0, 3)
    .map((operation) => formatGraphOperationBehavior(operation))
    .join(" ; ")}${operations.length > 3 ? " ; ..." : ""}]`;
}

function formatObjectKeys(value: object): string {
  const keys = Object.keys(value);
  return keys.length ? keys.join(",") : "none";
}

function formatUnknownValue(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return String(value);
    }

    return serialized.length > 140
      ? `${serialized.slice(0, 137)}...`
      : serialized;
  } catch {
    return String(value);
  }
}
