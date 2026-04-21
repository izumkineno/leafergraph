/**
 * `@leafergraph/authoring` 的共享工具与基础类型。
 *
 * 这里的职责很克制：
 * - 给作者层暴露统一的输入 / 输出 / 属性 / 状态别名
 * - 提供元信息与默认值处理时需要的深拷贝和基础断言
 *
 * 这些工具不会引入 editor 或宿主语义，只服务作者层自身的数据整理。
 */

import type {
  NodePropertySpec,
  NodeSlotSpec,
  NodeWidgetSpec
} from "@leafergraph/core/node";

/** 节点属性对象的作者层默认别名。 */
export type NodeProps = Record<string, unknown>;
/** 节点输入值集合的作者层默认别名。 */
export type NodeInputs = Record<string, unknown>;
/** 节点输出值集合的作者层默认别名。 */
export type NodeOutputs = Record<string, unknown>;
/** 节点私有运行时状态的作者层默认别名。 */
export type NodeState = Record<string, unknown>;
/** Widget 私有运行时状态的作者层默认别名。 */
export type WidgetState = Record<string, unknown>;

/**
 * 深拷贝作者层常用的 JSON 风格值。
 * 这样在规范化元信息或默认值时，可以隔离调用方后续对原对象的修改。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
export function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      next[key] = cloneValue(child);
    }
    return next as T;
  }

  return value;
}

/**
 * 深拷贝记录对象。
 * 未提供时保留 `undefined`，避免把“未声明”和“空对象”混成同一种语义。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
export function cloneRecord(
  value?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return value ? cloneValue(value) : undefined;
}

/**
 *  深拷贝单个槽位声明。
 *
 * @param spec - `spec`。
 * @returns 处理后的结果。
 */
export function cloneSlotSpec(spec: NodeSlotSpec): NodeSlotSpec {
  return {
    ...spec,
    data: cloneRecord(spec.data)
  };
}

/**
 *  深拷贝槽位声明数组。
 *
 * @param specs - `specs`。
 * @returns 处理后的结果。
 */
export function cloneSlotSpecs(specs?: NodeSlotSpec[]): NodeSlotSpec[] {
  return specs?.map((spec) => cloneSlotSpec(spec)) ?? [];
}

/**
 *  深拷贝单个 Widget 声明。
 *
 * @param spec - `spec`。
 * @returns 处理后的结果。
 */
export function cloneWidgetSpec(spec: NodeWidgetSpec): NodeWidgetSpec {
  return {
    ...spec,
    value: cloneValue(spec.value),
    options: cloneRecord(spec.options)
  };
}

/**
 *  深拷贝 Widget 声明数组。
 *
 * @param specs - `specs`。
 * @returns 处理后的结果。
 */
export function cloneWidgetSpecs(specs?: NodeWidgetSpec[]): NodeWidgetSpec[] {
  return specs?.map((spec) => cloneWidgetSpec(spec)) ?? [];
}

/**
 *  深拷贝单个属性声明。
 *
 * @param spec - `spec`。
 * @returns 处理后的结果。
 */
export function clonePropertySpec(spec: NodePropertySpec): NodePropertySpec {
  return {
    ...spec,
    default: cloneValue(spec.default),
    options: cloneRecord(spec.options),
    widget: spec.widget ? cloneWidgetSpec(spec.widget) : undefined
  };
}

/**
 *  深拷贝属性声明数组。
 *
 * @param specs - `specs`。
 * @returns 处理后的结果。
 */
export function clonePropertySpecs(specs?: NodePropertySpec[]): NodePropertySpec[] {
  return specs?.map((spec) => clonePropertySpec(spec)) ?? [];
}

/**
 *  复制字符串列表，保留原有顺序。
 *
 * @param list - `list`。
 * @returns 处理后的结果。
 */
export function cloneStringList(list?: string[]): string[] | undefined {
  return list ? [...list] : undefined;
}

/**
 * 断言文本字段非空，并返回裁剪后的安全值。
 * 这类校验主要用于节点类型、标题和插件名称等正式标识。
 *
 * @param value - 当前值。
 * @param label - 标签。
 * @returns 处理后的结果。
 */
export function assertNonEmptyText(value: string, label: string): string {
  const safeValue = value.trim();
  if (!safeValue) {
    throw new Error(`${label}不能为空`);
  }

  return safeValue;
}

/**
 * 断言一组具名项的 `name` 唯一。
 * 当前用于槽位、Widget 等声明性数组，避免宿主后续按名字查找时产生歧义。
 *
 * @param items - 项目。
 * @param label - 标签。
 * @returns 无返回值。
 */
export function assertUniqueNames(
  items: Array<{ name: string }>,
  label: string
): void {
  const seen = new Set<string>();

  for (const item of items) {
    const safeName = item.name.trim();
    if (!safeName) {
      throw new Error(`${label}名称不能为空`);
    }

    if (seen.has(safeName)) {
      throw new Error(`${label}名称重复: ${safeName}`);
    }

    seen.add(safeName);
  }
}
