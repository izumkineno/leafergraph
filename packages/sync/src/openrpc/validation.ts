/**
 * OpenRPC 子出口校验模块。
 *
 * @remarks
 * 负责校验当前 authority method / notification 的最小结构，保证 decode 错误能稳定上抛。
 */
import {
  cloneValue,
  isGraphDocument,
  isGraphDocumentDiff,
  isGraphExecutionState,
  isGraphOperation,
  isRecord,
  isRuntimeFeedbackEvent,
  isSyncRuntimeControlRequest
} from "../core";
import type {
  DocumentSnapshot,
  SyncOutletError
} from "../core";
import type {
  JsonRpcErrorEnvelope,
  JsonRpcNotificationEnvelope,
  JsonRpcRequestEnvelope,
  JsonRpcResponseEnvelope,
  JsonRpcSuccessEnvelope,
  OpenRpcFrontendBundlesSyncEvent,
  OpenRpcMethodParams,
  OpenRpcRuntimeControlResult,
  OpenRpcSubmitOperationResult
} from "./types";
import { OPENRPC_METHODS } from "./types";

type UnknownRecord = Record<string, unknown>;

/** 创建 decode 错误对象。 */
export function createDecodeError(message: string, cause?: unknown): SyncOutletError {
  return { kind: "decode", message, cause };
}

/** 创建 protocol 错误对象。 */
export function createProtocolError(message: string, cause?: unknown): SyncOutletError {
  return { kind: "protocol", message, cause };
}

/** 创建 transport 错误对象。 */
export function createTransportError(message: string, cause?: unknown): SyncOutletError {
  return { kind: "transport", message, cause };
}

/** 判断值是否为 JSON-RPC request envelope。 */
export function isJsonRpcRequestEnvelope(value: unknown): value is JsonRpcRequestEnvelope {
  return (
    isRecord(value) &&
    value.jsonrpc === "2.0" &&
    typeof value.id === "string" &&
    typeof value.method === "string"
  );
}

/** 判断值是否为 JSON-RPC notification envelope。 */
export function isJsonRpcNotificationEnvelope(
  value: unknown
): value is JsonRpcNotificationEnvelope {
  return (
    isRecord(value) &&
    value.jsonrpc === "2.0" &&
    typeof value.method === "string" &&
    !("id" in value)
  );
}

/** 判断值是否为 JSON-RPC error envelope。 */
export function isJsonRpcErrorEnvelope(value: unknown): value is JsonRpcErrorEnvelope {
  return (
    isRecord(value) &&
    value.jsonrpc === "2.0" &&
    ("id" in value) &&
    (typeof value.id === "string" ||
      typeof value.id === "number" ||
      value.id === null) &&
    isRecord(value.error) &&
    typeof value.error.code === "number" &&
    typeof value.error.message === "string"
  );
}

/** 判断值是否为 JSON-RPC success envelope。 */
export function isJsonRpcSuccessEnvelope(
  value: unknown
): value is JsonRpcSuccessEnvelope {
  return (
    isRecord(value) &&
    value.jsonrpc === "2.0" &&
    ("id" in value) &&
    (typeof value.id === "string" ||
      typeof value.id === "number" ||
      value.id === null) &&
    "result" in value
  );
}

/** 判断值是否为 JSON-RPC response envelope。 */
export function isJsonRpcResponseEnvelope(value: unknown): value is JsonRpcResponseEnvelope {
  return isJsonRpcSuccessEnvelope(value) || isJsonRpcErrorEnvelope(value);
}

/**
 * 校验当前 authority method params。
 *
 * @remarks
 * 这里同时承担“清洗调用方 params”职责，确保发出的 request envelope 已满足当前协议合同。
 */
export function validateMethodParams(
  method: string,
  params: unknown
): OpenRpcMethodParams {
  switch (method) {
    case OPENRPC_METHODS.getDocument:
      if (params === undefined || isEmptyRecord(params)) {
        return undefined;
      }
      throw new Error(`${method} 不接受额外 params`);
    case OPENRPC_METHODS.submitOperation:
      if (
        isRecord(params) &&
        isGraphOperation(params.operation) &&
        isRecord(params.context) &&
        isGraphDocument(params.context.currentDocument) &&
        Array.isArray(params.context.pendingOperationIds) &&
        params.context.pendingOperationIds.every((item) => typeof item === "string")
      ) {
        return cloneValue(params as unknown as OpenRpcMethodParams);
      }
      throw new Error(`${method} params 非法`);
    case OPENRPC_METHODS.replaceDocument:
      if (
        isRecord(params) &&
        isGraphDocument(params.document) &&
        isRecord(params.context) &&
        isGraphDocument(params.context.currentDocument)
      ) {
        return cloneValue(params as unknown as OpenRpcMethodParams);
      }
      throw new Error(`${method} params 非法`);
    case OPENRPC_METHODS.controlRuntime:
      if (isRecord(params) && isSyncRuntimeControlRequest(params.request)) {
        return cloneValue(params as unknown as OpenRpcMethodParams);
      }
      throw new Error(`${method} params 非法`);
    default:
      throw new Error(`当前 OpenRPC 子出口不支持 method: ${method}`);
  }
}

/** 校验 authority.getDocument 的结果。 */
export function validateGetDocumentResult(value: unknown): DocumentSnapshot {
  if (!isGraphDocument(value)) {
    throw new Error("authority.getDocument result 非法");
  }
  return cloneValue(value);
}

/** 校验 authority.submitOperation 的结果。 */
export function validateSubmitOperationResult(
  value: unknown
): OpenRpcSubmitOperationResult {
  if (
    !isRecord(value) ||
    typeof value.accepted !== "boolean" ||
    typeof value.changed !== "boolean" ||
    (typeof value.revision !== "string" && typeof value.revision !== "number") ||
    (value.reason !== undefined && typeof value.reason !== "string") ||
    (value.document !== undefined && !isGraphDocument(value.document))
  ) {
    throw new Error("authority.submitOperation result 非法");
  }
  return cloneValue(value as unknown as OpenRpcSubmitOperationResult);
}

/** 校验 authority.replaceDocument 的结果。 */
export function validateReplaceDocumentResult(
  value: unknown
): DocumentSnapshot | null {
  if (value === null) {
    return null;
  }
  if (!isGraphDocument(value)) {
    throw new Error("authority.replaceDocument result 非法");
  }
  return cloneValue(value);
}

/** 校验 authority.controlRuntime 的结果。 */
export function validateControlRuntimeResult(
  value: unknown
): OpenRpcRuntimeControlResult {
  if (
    !isRecord(value) ||
    typeof value.accepted !== "boolean" ||
    typeof value.changed !== "boolean" ||
    (value.reason !== undefined && typeof value.reason !== "string") ||
    (value.state !== undefined && !isGraphExecutionState(value.state))
  ) {
    throw new Error("authority.controlRuntime result 非法");
  }
  return cloneValue(value as unknown as OpenRpcRuntimeControlResult);
}

/** 校验 authority.document notification params。 */
export function validateDocumentNotification(value: unknown): DocumentSnapshot {
  if (!isGraphDocument(value)) {
    throw new Error("authority.document params 非法");
  }
  return cloneValue(value);
}

/** 校验 authority.documentDiff notification params。 */
export function validateDocumentDiffNotification(value: unknown) {
  if (!isGraphDocumentDiff(value)) {
    throw new Error("authority.documentDiff params 非法");
  }
  return cloneValue(value);
}

/** 校验 authority.runtimeFeedback notification params。 */
export function validateRuntimeFeedbackNotification(value: unknown) {
  if (!isRuntimeFeedbackEvent(value)) {
    throw new Error("authority.runtimeFeedback params 非法");
  }
  return cloneValue(value);
}

/**
 * 校验 authority.frontendBundlesSync notification params。
 *
 * @remarks
 * sync 根层不会消费这类事件，但协议层仍然会校验它，避免坏数据被静默吞掉。
 */
export function validateFrontendBundlesNotification(
  value: unknown
): OpenRpcFrontendBundlesSyncEvent {
  if (
    !isRecord(value) ||
    value.type !== "frontendBundles.sync" ||
    (value.mode !== "full" &&
      value.mode !== "upsert" &&
      value.mode !== "remove") ||
    typeof value.emittedAt !== "number" ||
    (value.removedPackageIds !== undefined &&
      (!Array.isArray(value.removedPackageIds) ||
        !value.removedPackageIds.every((item) => typeof item === "string"))) ||
    (value.packages !== undefined &&
      (!Array.isArray(value.packages) ||
        !value.packages.every((item) => isFrontendBundlePackage(item))))
  ) {
    throw new Error("authority.frontendBundlesSync params 非法");
  }

  return cloneValue(value as unknown as OpenRpcFrontendBundlesSyncEvent);
}

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function isFrontendBundlePackage(value: unknown): value is UnknownRecord {
  return (
    isRecord(value) &&
    typeof value.packageId === "string" &&
    typeof value.version === "string" &&
    Array.isArray(value.nodeTypes) &&
    value.nodeTypes.every((item) => typeof item === "string") &&
    Array.isArray(value.bundles)
  );
}
