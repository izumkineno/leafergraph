import type { NodeDefinition } from "./definition.js";
import type {
  NodeFlags,
  NodeLayout,
  NodePropertySpec,
  NodeSlotSpec,
  NodeWidgetSpec
} from "./types.js";

let nodeIdSeed = 1;

/**
 * 深拷贝任意简单 JSON 风格值。
 * 当前节点 SDK 的大部分结构都通过这套规则保持“输入不可变、内部可变”。
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

/** 深拷贝记录对象。 */
export function cloneRecord(
  value?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return value ? cloneValue(value) : undefined;
}

/** 深拷贝节点标志位。 */
export function cloneFlags(flags?: NodeFlags): NodeFlags {
  return flags ? cloneValue(flags) : {};
}

/** 将布局输入标准化为完整的 `NodeLayout`。 */
export function cloneLayout(layout?: Partial<NodeLayout>): NodeLayout {
  return {
    x: layout?.x ?? 0,
    y: layout?.y ?? 0,
    width: layout?.width,
    height: layout?.height
  };
}

/** 深拷贝单个槽位声明。 */
export function cloneSlotSpec(spec: NodeSlotSpec): NodeSlotSpec {
  return {
    ...spec,
    data: cloneRecord(spec.data)
  };
}

/** 深拷贝槽位声明数组。 */
export function cloneSlotSpecs(specs?: NodeSlotSpec[]): NodeSlotSpec[] {
  return specs?.map((spec) => cloneSlotSpec(spec)) ?? [];
}

/** 深拷贝单个 Widget 声明。 */
export function cloneWidgetSpec(spec: NodeWidgetSpec): NodeWidgetSpec {
  return {
    ...spec,
    value: cloneValue(spec.value),
    options: cloneRecord(spec.options)
  };
}

/** 深拷贝 Widget 声明数组。 */
export function cloneWidgetSpecs(specs?: NodeWidgetSpec[]): NodeWidgetSpec[] {
  return specs?.map((spec) => cloneWidgetSpec(spec)) ?? [];
}

/** 深拷贝单个属性声明。 */
export function clonePropertySpec(spec: NodePropertySpec): NodePropertySpec {
  return {
    ...spec,
    default: cloneValue(spec.default),
    options: cloneRecord(spec.options),
    widget: spec.widget ? cloneWidgetSpec(spec.widget) : undefined
  };
}

/** 深拷贝属性声明数组。 */
export function clonePropertySpecs(specs?: NodePropertySpec[]): NodePropertySpec[] {
  return specs?.map((spec) => clonePropertySpec(spec)) ?? [];
}

/**
 * 深拷贝节点定义。
 * 注册表会保存这份副本，以隔离调用方后续对原定义对象的修改。
 */
export function cloneDefinition(definition: NodeDefinition): NodeDefinition {
  return {
    ...definition,
    keywords: definition.keywords ? [...definition.keywords] : undefined,
    inputs: cloneSlotSpecs(definition.inputs),
    outputs: cloneSlotSpecs(definition.outputs),
    properties: clonePropertySpecs(definition.properties),
    widgets: cloneWidgetSpecs(definition.widgets),
    size: definition.size ? [definition.size[0], definition.size[1]] : undefined,
    resize: definition.resize ? { ...definition.resize } : undefined
  };
}

/**
 * 为未注册的节点类型生成一个最小占位定义。
 * 这让宿主在读取旧图数据或插件缺失时，仍然可以保留原始节点结构并继续渲染占位态。
 */
export function createMissingNodeDefinition(type: string): NodeDefinition {
  return {
    type,
    title: createDefaultTitle(type),
    description: `缺失的节点类型: ${type}`
  };
}

/**
 * 由类型名推导默认标题。
 * 例如 `math/add` 会回退成 `Add`。
 */
export function createDefaultTitle(type: string): string {
  const tail = type.split(/[/:]/).pop() ?? type;
  return tail
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * 生成节点默认实例 ID。
 * 这里使用简单自增种子，足够满足当前内存态 demo 与开发期用途。
 */
export function createNodeId(type: string): string {
  const safeType = type
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const prefix = safeType || "node";
  const id = `${prefix}-${nodeIdSeed}`;
  nodeIdSeed += 1;
  return id;
}

/**
 * 根据属性声明和覆写值创建实例属性对象。
 * 先铺默认值，再覆盖调用方传入值。
 */
export function createPropertyValues(
  specs: NodePropertySpec[],
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  for (const spec of specs) {
    if (spec.default !== undefined) {
      next[spec.name] = cloneValue(spec.default);
    }
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      next[key] = cloneValue(value);
    }
  }

  return next;
}

/**
 * 按节点定义、覆写布局和当前布局合并出最终布局。
 * 当前规则保持简单，优先级为：显式输入 > 当前值 > 定义默认尺寸。
 */
export function resolveNodeLayout(
  definition: Pick<NodeDefinition, "size">,
  nextLayout?: Partial<NodeLayout>,
  currentLayout?: NodeLayout
): NodeLayout {
  return {
    x: nextLayout?.x ?? currentLayout?.x ?? 0,
    y: nextLayout?.y ?? currentLayout?.y ?? 0,
    width: nextLayout?.width ?? currentLayout?.width ?? definition.size?.[0],
    height: nextLayout?.height ?? currentLayout?.height ?? definition.size?.[1]
  };
}

/**
 * 调整运行时输入输出缓存长度。
 * 该函数会保留已有值，并在需要时补齐 `undefined` 占位。
 */
export function resizeRuntimeValues(values: unknown[], size: number): unknown[] {
  const next = values.slice(0, size);

  while (next.length < size) {
    next.push(undefined);
  }

  return next;
}
