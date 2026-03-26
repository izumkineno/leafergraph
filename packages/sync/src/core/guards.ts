/**
 * 同步包运行时校验工具模块。
 *
 * @remarks
 * 负责提供最小结构校验与 clone 工具，避免不同层各自散落一套判定逻辑。
 */
import type {
  GraphDocument,
  GraphDocumentDiff,
  GraphLink,
  GraphOperation,
  LeaferGraphGraphExecutionState,
  RuntimeFeedbackEvent
} from "leafergraph";
import type {
  DocumentRevision,
  SyncRuntimeControlRequest,
  SyncStoredState
} from "./types";

type UnknownRecord = Record<string, unknown>;

/** 深拷贝同步包公开载荷，避免外部直接持有内部引用。 */
export function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

/** 判断值是否为普通对象。 */
export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

/** 判断值是否为字符串或数字 revision。 */
export function isDocumentRevision(value: unknown): value is DocumentRevision {
  return typeof value === "string" || typeof value === "number";
}

/** 判断值是否为最小 GraphLink 结构。 */
export function isGraphLink(value: unknown): value is GraphLink {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isRecord(value.source) &&
    typeof value.source.nodeId === "string" &&
    (value.source.slot === undefined || typeof value.source.slot === "number") &&
    isRecord(value.target) &&
    typeof value.target.nodeId === "string" &&
    (value.target.slot === undefined || typeof value.target.slot === "number")
  );
}

/** 判断值是否为最小可交换 GraphDocument。 */
export function isGraphDocument(value: unknown): value is GraphDocument {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.documentId === "string" &&
    isDocumentRevision(value.revision) &&
    typeof value.appKind === "string" &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.links) &&
    value.links.every((item) => isGraphLink(item))
  );
}

/** 判断值是否为最小可接受 GraphOperation。 */
export function isGraphOperation(value: unknown): value is GraphOperation {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.operationId === "string" &&
    typeof value.timestamp === "number" &&
    typeof value.source === "string"
  );
}

/** 判断值是否为最小可接受 GraphDocumentDiff。 */
export function isGraphDocumentDiff(value: unknown): value is GraphDocumentDiff {
  return (
    isRecord(value) &&
    typeof value.documentId === "string" &&
    isDocumentRevision(value.baseRevision) &&
    isDocumentRevision(value.revision) &&
    typeof value.emittedAt === "number" &&
    Array.isArray(value.operations) &&
    value.operations.every((item) => isGraphOperation(item)) &&
    Array.isArray(value.fieldChanges) &&
    value.fieldChanges.every(
      (item) => isRecord(item) && typeof item.type === "string" && typeof item.nodeId === "string"
    )
  );
}

/** 判断值是否为最小 runtime feedback 结构。 */
export function isRuntimeFeedbackEvent(
  value: unknown
): value is RuntimeFeedbackEvent {
  return (
    isRecord(value) &&
    (value.type === "node.execution" ||
      value.type === "graph.execution" ||
      value.type === "node.state" ||
      value.type === "link.propagation") &&
    "event" in value &&
    isRecord(value.event)
  );
}

/** 判断值是否为最小图级执行状态。 */
export function isGraphExecutionState(
  value: unknown
): value is LeaferGraphGraphExecutionState {
  return (
    isRecord(value) &&
    (value.status === "idle" ||
      value.status === "running" ||
      value.status === "stepping") &&
    typeof value.queueSize === "number" &&
    typeof value.stepCount === "number" &&
    (value.runId === undefined || typeof value.runId === "string") &&
    (value.startedAt === undefined || typeof value.startedAt === "number") &&
    (value.stoppedAt === undefined || typeof value.stoppedAt === "number") &&
    (value.lastSource === undefined ||
      value.lastSource === "graph-play" ||
      value.lastSource === "graph-step")
  );
}

/** 判断值是否为最小 runtime 控制请求。 */
export function isSyncRuntimeControlRequest(
  value: unknown
): value is SyncRuntimeControlRequest {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "node.play":
      return typeof value.nodeId === "string";
    case "graph.play":
    case "graph.step":
    case "graph.stop":
      return true;
    default:
      return false;
  }
}

/** 判断值是否为最小可恢复 storage 记录。 */
export function isSyncStoredState(value: unknown): value is SyncStoredState {
  return (
    isRecord(value) &&
    (value.snapshot === undefined || isGraphDocument(value.snapshot)) &&
    (value.recoveryMeta === undefined ||
      (isRecord(value.recoveryMeta) &&
        (value.recoveryMeta.revision === undefined ||
          isDocumentRevision(value.recoveryMeta.revision)) &&
        (value.recoveryMeta.savedAt === undefined ||
          typeof value.recoveryMeta.savedAt === "number")))
  );
}
