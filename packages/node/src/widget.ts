/**
 * Widget 定义读取、校验与值转换工具。
 *
 * 当前模型层不维护可写 Widget 注册表，只依赖“按类型读取定义”的能力，
 * 这样既能保持包边界干净，也方便宿主把 Widget 真源放在更高层。
 */

import type { WidgetDefinition } from "./definition.js";
import { UnknownWidgetTypeError } from "./errors.js";
import type { NodePropertySpec, NodeWidgetSpec } from "./types.js";
import { cloneWidgetSpec } from "./utils.js";

/**
 * 当前内建 Widget 类型列表。
 * 宿主可以基于这份列表提供默认 renderer 或编辑器面板能力。
 */
export const BUILTIN_WIDGET_TYPES = [
  "number",
  "string",
  "toggle",
  "slider",
  "input",
  "textarea",
  "select",
  "button",
  "checkbox",
  "radio",
  "custom"
] as const;

/**
 * 注册 Widget 定义时的控制项。
 */
export interface RegisterWidgetOptions {
  /** 是否允许覆写已存在的 Widget 类型。 */
  overwrite?: boolean;
}

/**
 * Widget 定义读取接口。
 * SDK 只依赖“按 type 读取定义”这一条能力，不再持有可写注册表。
 */
export interface WidgetDefinitionReader {
  /** 按类型读取 Widget 定义；未命中时返回 `undefined`。 */
  get(type: string): WidgetDefinition | undefined;
}

/** 获取 Widget 定义；未命中时抛错。 */
export function requireWidgetDefinition(
  definitions: WidgetDefinitionReader,
  type: string
): WidgetDefinition {
  const definition = definitions.get(type);

  if (!definition) {
    throw new UnknownWidgetTypeError(type);
  }

  return definition;
}

/** 判断 Widget 类型是否存在。 */
export function hasWidgetDefinition(
  definitions: WidgetDefinitionReader,
  type: string
): boolean {
  return Boolean(definitions.get(type));
}

/** 校验单个 Widget 声明是否合法。 */
export function validateWidgetSpec(
  definitions: WidgetDefinitionReader,
  spec: NodeWidgetSpec
): void {
  requireWidgetDefinition(definitions, spec.type);
}

/** 校验属性声明中的内嵌 Widget 是否合法。 */
export function validateWidgetPropertySpec(
  definitions: WidgetDefinitionReader,
  spec: NodePropertySpec
): void {
  if (spec.widget) {
    validateWidgetSpec(definitions, spec.widget);
  }
}

/**
 * 按 Widget 定义执行值归一化。
 * 归一化发生在实例创建、节点配置或运行时新增 Widget 时。
 */
export function normalizeWidgetSpec(
  definitions: WidgetDefinitionReader,
  spec: NodeWidgetSpec
): NodeWidgetSpec {
  const next = cloneWidgetSpec(spec);
  const definition = definitions.get(spec.type);

  if (!definition) {
    return next;
  }

  if (definition.normalize) {
    next.value = definition.normalize(next.value, next);
  }

  return next;
}

/** 批量归一化 Widget 声明。 */
export function normalizeWidgetSpecs(
  definitions: WidgetDefinitionReader,
  specs?: NodeWidgetSpec[]
): NodeWidgetSpec[] {
  return specs?.map((spec) => normalizeWidgetSpec(definitions, spec)) ?? [];
}

/**
 * 按 Widget 定义执行序列化转换。
 * 它允许 Widget 在持久化前把运行时值投影成稳定的输出格式。
 */
export function serializeWidgetSpec(
  definitions: WidgetDefinitionReader,
  spec: NodeWidgetSpec
): NodeWidgetSpec {
  const next = cloneWidgetSpec(spec);
  const definition = definitions.get(spec.type);

  if (!definition) {
    return next;
  }

  if (definition.serialize) {
    next.value = definition.serialize(next.value, next);
  }

  return next;
}

/** 批量序列化 Widget 声明。 */
export function serializeWidgetSpecs(
  definitions: WidgetDefinitionReader,
  specs?: NodeWidgetSpec[]
): NodeWidgetSpec[] {
  return specs?.map((spec) => serializeWidgetSpec(definitions, spec)) ?? [];
}
