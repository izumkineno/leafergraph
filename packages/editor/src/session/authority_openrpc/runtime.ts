/**
 * 运行时模块。
 *
 * @remarks
 * 负责承接当前子系统的运行时状态、装配逻辑或反馈投影能力。
 */
import type {
  AuthorityMethodParams,
  AuthorityMethodResult,
  AuthorityNotificationParams
} from "./_generated/models";
import {
  AUTHORITY_OPENRPC_METHOD_DESCRIPTORS,
  AUTHORITY_OPENRPC_NOTIFICATION_DESCRIPTORS
} from "./_generated/descriptor";
import {
  AUTHORITY_OPENRPC_METHOD_NAMES,
  AUTHORITY_OPENRPC_METHODS,
  type AuthorityOpenRpcMethodName
} from "./_generated/methods";
import {
  AUTHORITY_OPENRPC_NOTIFICATIONS,
  AUTHORITY_OPENRPC_NOTIFICATION_NAMES,
  type AuthorityOpenRpcNotificationName
} from "./_generated/notifications";
import authorityOpenRpcDocument from "./_generated/openrpc_document";
import { AUTHORITY_OPENRPC_SCHEMAS } from "./_generated/schema_bundle";
import type {
  EditorRemoteAuthorityDocumentDiffTransportEvent,
  EditorRemoteAuthorityDocumentTransportEvent,
  EditorRemoteAuthorityFrontendBundlesSyncTransportEvent,
  EditorRemoteAuthorityRuntimeFeedbackTransportEvent,
  EditorRemoteAuthoritySubmitOperationRequest,
  EditorRemoteAuthorityReplaceDocumentRequest,
  EditorRemoteAuthorityControlRuntimeRequest,
  EditorRemoteAuthorityTransportEvent,
  EditorRemoteAuthorityTransportRequest,
  EditorRemoteAuthorityTransportResponse
} from "./_generated/transport_types";
import {
  EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
  type EditorRemoteAuthorityErrorObject,
  type EditorRemoteAuthorityEventEnvelope,
  type EditorRemoteAuthorityFailureEnvelope,
  type EditorRemoteAuthorityInboundEnvelope,
  type EditorRemoteAuthorityProtocolAdapter,
  type EditorRemoteAuthorityRequestInboundEnvelope,
  type EditorRemoteAuthoritySuccessEnvelope
} from "./types";

type JsonObject = Record<string, unknown>;
type JsonSchema = Record<string, unknown>;

/** editor 侧 authority 方法名常量。 */
export const EDITOR_REMOTE_AUTHORITY_METHODS = AUTHORITY_OPENRPC_METHODS;

/** editor 侧 authority notification 常量。 */
export const EDITOR_REMOTE_AUTHORITY_NOTIFICATIONS = AUTHORITY_OPENRPC_NOTIFICATIONS;

const METHOD_NAME_SET = new Set<string>(AUTHORITY_OPENRPC_METHOD_NAMES);
const NOTIFICATION_NAME_SET = new Set<string>(AUTHORITY_OPENRPC_NOTIFICATION_NAMES);
const AUTHORITY_OPENRPC_SCHEMA_LOOKUP =
  AUTHORITY_OPENRPC_SCHEMAS as unknown as Record<string, JsonSchema>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function isJsonRpcRequestId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function isPlainObject(value: unknown): value is JsonObject {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAuthorityMethodName(value: unknown): value is AuthorityOpenRpcMethodName {
  return typeof value === "string" && METHOD_NAME_SET.has(value);
}

function isAuthorityNotificationName(
  value: unknown
): value is AuthorityOpenRpcNotificationName {
  return typeof value === "string" && NOTIFICATION_NAME_SET.has(value);
}

function stripUndefinedDeep<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as TValue;
  }

  if (isPlainObject(value)) {
    const nextValue: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) {
        continue;
      }
      nextValue[key] = stripUndefinedDeep(item);
    }
    return nextValue as TValue;
  }

  return value;
}

function cloneValidatedValue<TValue>(value: TValue): TValue {
  if (value === undefined) {
    return value;
  }
  return structuredClone(stripUndefinedDeep(value));
}

function mergeObjectSchemas(baseSchema: JsonSchema, branchSchema: JsonSchema): JsonSchema {
  const merged: JsonSchema = Object.fromEntries(
    Object.entries(baseSchema).filter(([key]) => key !== "allOf")
  );

  if (branchSchema.type === "object" || "properties" in branchSchema) {
    merged.type = "object";
  }
  if (isRecord(branchSchema.properties)) {
    merged.properties = {
      ...(isRecord(merged.properties) ? merged.properties : {}),
      ...branchSchema.properties
    };
  }
  if (Array.isArray(branchSchema.required)) {
    const required = Array.isArray(merged.required)
      ? [...merged.required]
      : [];
    for (const item of branchSchema.required) {
      if (!required.includes(item)) {
        required.push(item);
      }
    }
    merged.required = required;
  }
  if ("additionalProperties" in branchSchema) {
    merged.additionalProperties = branchSchema.additionalProperties;
  }
  if (Array.isArray(branchSchema.oneOf)) {
    merged.oneOf = branchSchema.oneOf;
  }
  if (Array.isArray(branchSchema.anyOf)) {
    merged.anyOf = branchSchema.anyOf;
  }
  return merged;
}

function normalizeSchema(schema: JsonSchema): JsonSchema {
  if (!Array.isArray(schema.allOf)) {
    return schema;
  }

  const baseSchema: JsonSchema = Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== "allOf")
  );
  const allOf = schema.allOf.filter(isRecord);
  if (
    allOf.length === 1 &&
    Array.isArray(allOf[0].oneOf)
  ) {
    return {
      oneOf: allOf[0].oneOf.map((branch) =>
        isRecord(branch) ? mergeObjectSchemas(baseSchema, branch) : branch
      )
    };
  }

  let merged = { ...baseSchema };
  for (const branch of allOf) {
    merged = mergeObjectSchemas(merged, branch);
  }
  return merged;
}

function getSchemaByRef(ref: string): JsonSchema {
  const schema = AUTHORITY_OPENRPC_SCHEMA_LOOKUP[ref];
  if (!schema) {
    throw new Error(`authority OpenRPC schema 引用不存在: ${ref}`);
  }
  return normalizeSchema(schema);
}

function validateAgainstSchema(
  schema: JsonSchema,
  value: unknown,
  path: string
): void {
  const normalized = normalizeSchema(schema);
  if (typeof normalized.$ref === "string") {
    validateAgainstSchema(getSchemaByRef(normalized.$ref), value, path);
    return;
  }

  if ("const" in normalized) {
    if (!Object.is(value, normalized.const)) {
      throw new Error(`${path} 必须等于 ${JSON.stringify(normalized.const)}`);
    }
    return;
  }

  if (Array.isArray(normalized.enum)) {
    if (!normalized.enum.some((candidate) => Object.is(candidate, value))) {
      throw new Error(`${path} 不在允许的枚举值中`);
    }
    return;
  }

  if (Array.isArray(normalized.type)) {
    const errors: string[] = [];
    for (const item of normalized.type) {
      try {
        validateAgainstSchema({ type: item }, value, path);
        return;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(errors[0] ?? `${path} 类型不匹配`);
  }

  if (Array.isArray(normalized.oneOf) || Array.isArray(normalized.anyOf)) {
    const keyword = Array.isArray(normalized.oneOf) ? "oneOf" : "anyOf";
    const branches = (normalized[keyword] as unknown[]).filter(isRecord);
    let matches = 0;
    let lastError: Error | null = null;
    for (const branch of branches) {
      try {
        validateAgainstSchema(branch, value, path);
        matches += 1;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (keyword === "oneOf" && matches === 1) {
      return;
    }
    if (keyword === "anyOf" && matches >= 1) {
      return;
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error(`${path} 未满足 ${keyword} 条件`);
  }

  switch (normalized.type) {
    case undefined: {
      if (
        isRecord(normalized.properties) ||
        Array.isArray(normalized.required) ||
        "additionalProperties" in normalized
      ) {
        validateObjectSchema(normalized, value, path);
      }
      return;
    }
    case "string": {
      if (typeof value !== "string") {
        throw new Error(`${path} 必须是字符串`);
      }
      if (
        typeof normalized.minLength === "number" &&
        value.length < normalized.minLength
      ) {
        throw new Error(`${path} 长度不能小于 ${normalized.minLength}`);
      }
      if (
        typeof normalized.maxLength === "number" &&
        value.length > normalized.maxLength
      ) {
        throw new Error(`${path} 长度不能大于 ${normalized.maxLength}`);
      }
      return;
    }
    case "integer": {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new Error(`${path} 必须是整数`);
      }
      validateNumberBounds(normalized, value, path);
      return;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${path} 必须是数字`);
      }
      validateNumberBounds(normalized, value, path);
      return;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        throw new Error(`${path} 必须是布尔值`);
      }
      return;
    }
    case "null": {
      if (value !== null) {
        throw new Error(`${path} 必须是 null`);
      }
      return;
    }
    case "array": {
      if (!Array.isArray(value)) {
        throw new Error(`${path} 必须是数组`);
      }
      if (
        typeof normalized.minItems === "number" &&
        value.length < normalized.minItems
      ) {
        throw new Error(`${path} 项数不能小于 ${normalized.minItems}`);
      }
      if (
        typeof normalized.maxItems === "number" &&
        value.length > normalized.maxItems
      ) {
        throw new Error(`${path} 项数不能大于 ${normalized.maxItems}`);
      }
      if (isRecord(normalized.items)) {
        value.forEach((item, index) => {
          validateAgainstSchema(normalized.items as JsonSchema, item, `${path}[${index}]`);
        });
      }
      return;
    }
    case "object": {
      validateObjectSchema(normalized, value, path);
      return;
    }
    default:
      return;
  }
}

function validateNumberBounds(schema: JsonSchema, value: number, path: string): void {
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    throw new Error(`${path} 不能小于 ${schema.minimum}`);
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    throw new Error(`${path} 不能大于 ${schema.maximum}`);
  }
}

function validateObjectSchema(schema: JsonSchema, value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    throw new Error(`${path} 必须是对象`);
  }

  const properties = isRecord(schema.properties)
    ? (schema.properties as Record<string, JsonSchema>)
    : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];

  for (const propertyName of required) {
    if (!(propertyName in value)) {
      throw new Error(`${path}.${propertyName} 为必填字段`);
    }
  }

  for (const [propertyName, propertyValue] of Object.entries(value)) {
    const propertySchema = properties[propertyName];
    if (propertySchema) {
      validateAgainstSchema(propertySchema, propertyValue, `${path}.${propertyName}`);
      continue;
    }

    if (schema.additionalProperties === false) {
      throw new Error(`${path}.${propertyName} 不是允许的字段`);
    }
    if (isRecord(schema.additionalProperties)) {
      validateAgainstSchema(
        schema.additionalProperties as JsonSchema,
        propertyValue,
        `${path}.${propertyName}`
      );
    }
  }
}

function validateWithOptionalSchema<TValue>(
  schema: JsonSchema | null,
  value: unknown,
  path: string
): TValue {
  const normalizedValue = stripUndefinedDeep(value);

  if (schema === null) {
    if (
      normalizedValue === undefined ||
      (isPlainObject(normalizedValue) && Object.keys(normalizedValue).length === 0)
    ) {
      return undefined as TValue;
    }
    throw new Error(`${path} 不接受额外参数`);
  }

  validateAgainstSchema(schema, normalizedValue, path);
  return cloneValidatedValue(normalizedValue) as TValue;
}

function toRequestFromValidatedParams(
  method: AuthorityOpenRpcMethodName,
  params: unknown
): EditorRemoteAuthorityTransportRequest {
  switch (method) {
    case AUTHORITY_OPENRPC_METHODS.discover:
      return { method };
    case AUTHORITY_OPENRPC_METHODS.getDocument:
      return { method };
    case AUTHORITY_OPENRPC_METHODS.submitOperation:
      return {
        method,
        params: params as EditorRemoteAuthoritySubmitOperationRequest["params"]
      };
    case AUTHORITY_OPENRPC_METHODS.replaceDocument:
      return {
        method,
        params: params as EditorRemoteAuthorityReplaceDocumentRequest["params"]
      };
    case AUTHORITY_OPENRPC_METHODS.controlRuntime:
      return {
        method,
        params: params as EditorRemoteAuthorityControlRuntimeRequest["params"]
      };
  }
}

function toNotificationMethod(
  event: EditorRemoteAuthorityTransportEvent
): AuthorityOpenRpcNotificationName {
  switch (event.type) {
    case "document":
      return AUTHORITY_OPENRPC_NOTIFICATIONS.document;
    case "documentDiff":
      return AUTHORITY_OPENRPC_NOTIFICATIONS.documentDiff;
    case "runtimeFeedback":
      return AUTHORITY_OPENRPC_NOTIFICATIONS.runtimeFeedback;
    case "frontendBundles.sync":
      return AUTHORITY_OPENRPC_NOTIFICATIONS.frontendBundlesSync;
  }
}

function toNotificationParams(
  event: EditorRemoteAuthorityTransportEvent
): unknown {
  switch (event.type) {
    case "document":
      return event.document;
    case "documentDiff":
      return event.diff;
    case "runtimeFeedback":
      return event.event;
    case "frontendBundles.sync":
      return event.event;
  }
}

function toTransportEvent(
  method: AuthorityOpenRpcNotificationName,
  params: unknown
): EditorRemoteAuthorityTransportEvent {
  switch (method) {
    case AUTHORITY_OPENRPC_NOTIFICATIONS.document:
      return {
        type: "document",
        document: params as EditorRemoteAuthorityDocumentTransportEvent["document"]
      };
    case AUTHORITY_OPENRPC_NOTIFICATIONS.documentDiff:
      return {
        type: "documentDiff",
        diff: params as EditorRemoteAuthorityDocumentDiffTransportEvent["diff"]
      };
    case AUTHORITY_OPENRPC_NOTIFICATIONS.runtimeFeedback:
      return {
        type: "runtimeFeedback",
        event: params as EditorRemoteAuthorityRuntimeFeedbackTransportEvent["event"]
      };
    case AUTHORITY_OPENRPC_NOTIFICATIONS.frontendBundlesSync:
      return {
        type: "frontendBundles.sync",
        event: params as EditorRemoteAuthorityFrontendBundlesSyncTransportEvent["event"]
      };
  }
}

export function validateMethodParams<TMethod extends AuthorityOpenRpcMethodName>(
  method: TMethod,
  value: unknown
): AuthorityMethodParams<TMethod> {
  const descriptor = AUTHORITY_OPENRPC_METHOD_DESCRIPTORS[method];
  return validateWithOptionalSchema<AuthorityMethodParams<TMethod>>(
    descriptor.paramsSchema,
    value,
    `authority method ${method} params`
  );
}

export function validateMethodResult<TMethod extends AuthorityOpenRpcMethodName>(
  method: TMethod,
  value: unknown
): AuthorityMethodResult<TMethod> {
  const descriptor = AUTHORITY_OPENRPC_METHOD_DESCRIPTORS[method];
  const normalizedValue = stripUndefinedDeep(value);
  validateAgainstSchema(
    descriptor.resultSchema,
    normalizedValue,
    `authority method ${method} result`
  );
  return cloneValidatedValue(normalizedValue) as AuthorityMethodResult<TMethod>;
}

export function validateNotificationParams<
  TNotification extends AuthorityOpenRpcNotificationName
>(
  method: TNotification,
  value: unknown
): AuthorityNotificationParams<TNotification> {
  const descriptor = AUTHORITY_OPENRPC_NOTIFICATION_DESCRIPTORS[method];
  const normalizedValue = stripUndefinedDeep(value);
  validateAgainstSchema(
    descriptor.paramsSchema,
    normalizedValue,
    `authority notification ${method} params`
  );
  return cloneValidatedValue(
    normalizedValue
  ) as AuthorityNotificationParams<TNotification>;
}

function isErrorObject(value: unknown): value is EditorRemoteAuthorityErrorObject {
  return (
    isRecord(value) &&
    typeof value.code === "number" &&
    typeof value.message === "string"
  );
}

/** 当前默认 authority JSON-RPC 协议适配器。 */
export function createDefaultEditorRemoteAuthorityProtocolAdapter(): EditorRemoteAuthorityProtocolAdapter {
  return {
    createRequestEnvelope(requestId, request) {
      const params =
        "params" in request
          ? validateMethodParams(
              request.method as AuthorityOpenRpcMethodName,
              request.params
            )
          : undefined;

      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: requestId,
        method: request.method,
        params
      };
    },

    createSuccessEnvelope(requestId, response) {
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: requestId,
        result: cloneValidatedValue(response)
      };
    },

    createErrorEnvelope(requestId, code, message, data) {
      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: requestId,
        error: {
          code,
          message,
          data: cloneValidatedValue(data)
        }
      };
    },

    createNotificationEnvelope(event) {
      const method = toNotificationMethod(event);
      const params = validateNotificationParams(method, toNotificationParams(event));

      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        method,
        params
      };
    },

    parseRequestEnvelope(value) {
      if (
        !isRecord(value) ||
        value.jsonrpc !== EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION ||
        !isJsonRpcRequestId(value.id) ||
        !isAuthorityMethodName(value.method)
      ) {
        return null;
      }

      try {
        const request = toRequestFromValidatedParams(
          value.method,
          validateMethodParams(value.method, value.params)
        );
        return {
          jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
          id: value.id,
          method: value.method,
          request
        } satisfies EditorRemoteAuthorityRequestInboundEnvelope;
      } catch {
        return null;
      }
    },

    parseInboundEnvelope(value) {
      if (
        !isRecord(value) ||
        value.jsonrpc !== EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION
      ) {
        return null;
      }

      if ("method" in value) {
        if (!isAuthorityNotificationName(value.method)) {
          return null;
        }

        try {
          const params = validateNotificationParams(value.method, value.params);
          return {
            jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
            method: value.method,
            event: toTransportEvent(value.method, params)
          } satisfies EditorRemoteAuthorityEventEnvelope;
        } catch {
          return null;
        }
      }

      if (
        !("id" in value) ||
        !(value.id === null || isJsonRpcRequestId(value.id))
      ) {
        return null;
      }

      if ("error" in value) {
        if (!isErrorObject(value.error)) {
          return null;
        }
        return {
          jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
          id: value.id,
          ok: false,
          error: cloneValidatedValue(value.error)
        } satisfies EditorRemoteAuthorityFailureEnvelope;
      }

      if (!("result" in value)) {
        return null;
      }

      return {
        jsonrpc: EDITOR_REMOTE_AUTHORITY_JSON_RPC_VERSION,
        id: value.id,
        ok: true,
        result: cloneValidatedValue(
          value.result
        ) as EditorRemoteAuthorityTransportResponse
      } satisfies EditorRemoteAuthoritySuccessEnvelope;
    }
  };
}

/** editor 当前默认复用的 authority 协议适配器实例。 */
export const DEFAULT_EDITOR_REMOTE_AUTHORITY_PROTOCOL_ADAPTER =
  createDefaultEditorRemoteAuthorityProtocolAdapter();

export { authorityOpenRpcDocument };
export type {
  AuthorityMethodParams,
  AuthorityMethodResult,
  AuthorityNotificationParams,
  AuthorityOpenRpcMethodName,
  AuthorityOpenRpcNotificationName,
  EditorRemoteAuthorityInboundEnvelope,
  EditorRemoteAuthorityProtocolAdapter,
  EditorRemoteAuthorityRequestInboundEnvelope
};
export {
  AUTHORITY_OPENRPC_METHODS,
  AUTHORITY_OPENRPC_METHOD_NAMES,
  AUTHORITY_OPENRPC_NOTIFICATIONS,
  AUTHORITY_OPENRPC_NOTIFICATION_NAMES
};
