import type { WidgetDefinition } from "./definition";
import { UnknownWidgetTypeError, WidgetDefinitionExistsError } from "./errors";
import type { NodePropertySpec, NodeWidgetSpec } from "./types";
import { cloneWidgetSpec } from "./utils";

/**
 * 当前内建 Widget 类型列表。
 * 宿主可以基于这份列表提供默认 renderer 或编辑器面板能力。
 */
export const BUILTIN_WIDGET_TYPES = [
  "number",
  "string",
  "combo",
  "toggle",
  "slider",
  "custom"
] as const;

/**
 * 注册 Widget 定义时的控制项。
 */
export interface RegisterWidgetOptions {
  overwrite?: boolean;
}

const BUILTIN_WIDGET_DEFINITIONS: WidgetDefinition[] = BUILTIN_WIDGET_TYPES.map((type) => ({
  type,
  title: type
}));

/**
 * Widget 定义注册表。
 * 它既服务节点定义校验，也服务运行时的 normalize / serialize 处理。
 */
export class WidgetRegistry {
  private readonly definitions = new Map<string, WidgetDefinition>();

  constructor(definitions: WidgetDefinition[] = BUILTIN_WIDGET_DEFINITIONS) {
    for (const definition of definitions) {
      this.register(definition, { overwrite: true });
    }
  }

  /** 注册一个 Widget 定义。 */
  register(definition: WidgetDefinition, options: RegisterWidgetOptions = {}): void {
    const type = definition.type.trim();

    if (!type) {
      throw new Error("Widget 类型不能为空");
    }

    if (!options.overwrite && this.definitions.has(type)) {
      throw new WidgetDefinitionExistsError(type);
    }

    this.definitions.set(type, {
      ...definition,
      type
    });
  }

  /** 从注册表中移除 Widget 定义。 */
  unregister(type: string): void {
    this.definitions.delete(type);
  }

  /** 获取 Widget 定义；未命中时返回 `undefined`。 */
  get(type: string): WidgetDefinition | undefined {
    return this.definitions.get(type);
  }

  /** 获取 Widget 定义；未命中时抛错。 */
  require(type: string): WidgetDefinition {
    const definition = this.get(type);

    if (!definition) {
      throw new UnknownWidgetTypeError(type);
    }

    return definition;
  }

  /** 判断 Widget 类型是否存在。 */
  has(type: string): boolean {
    return this.definitions.has(type);
  }

  /** 以数组形式返回全部 Widget 定义。 */
  list(): WidgetDefinition[] {
    return [...this.definitions.values()];
  }

  /** 校验单个 Widget 声明是否合法。 */
  validateSpec(spec: NodeWidgetSpec): void {
    this.require(spec.type);
  }

  /** 校验属性声明中的内嵌 Widget 是否合法。 */
  validatePropertySpec(spec: NodePropertySpec): void {
    if (spec.widget) {
      this.validateSpec(spec.widget);
    }
  }
}

/**
 * 按 Widget 定义执行值归一化。
 * 归一化发生在实例创建、节点配置或运行时新增 Widget 时。
 */
export function normalizeWidgetSpec(
  widgetRegistry: WidgetRegistry,
  spec: NodeWidgetSpec
): NodeWidgetSpec {
  const definition = widgetRegistry.require(spec.type);
  const next = cloneWidgetSpec(spec);

  if (definition.normalize) {
    next.value = definition.normalize(next.value, next);
  }

  return next;
}

/** 批量归一化 Widget 声明。 */
export function normalizeWidgetSpecs(
  widgetRegistry: WidgetRegistry,
  specs?: NodeWidgetSpec[]
): NodeWidgetSpec[] {
  return specs?.map((spec) => normalizeWidgetSpec(widgetRegistry, spec)) ?? [];
}

/**
 * 按 Widget 定义执行序列化转换。
 * 它允许 Widget 在持久化前把运行时值投影成稳定的输出格式。
 */
export function serializeWidgetSpec(
  widgetRegistry: WidgetRegistry,
  spec: NodeWidgetSpec
): NodeWidgetSpec {
  const definition = widgetRegistry.require(spec.type);
  const next = cloneWidgetSpec(spec);

  if (definition.serialize) {
    next.value = definition.serialize(next.value, next);
  }

  return next;
}

/** 批量序列化 Widget 声明。 */
export function serializeWidgetSpecs(
  widgetRegistry: WidgetRegistry,
  specs?: NodeWidgetSpec[]
): NodeWidgetSpec[] {
  return specs?.map((spec) => serializeWidgetSpec(widgetRegistry, spec)) ?? [];
}
