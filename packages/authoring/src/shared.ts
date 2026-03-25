import type {
  NodePropertySpec,
  NodeSlotSpec,
  NodeWidgetSpec
} from "@leafergraph/node";

export type NodeProps = Record<string, unknown>;
export type NodeInputs = Record<string, unknown>;
export type NodeOutputs = Record<string, unknown>;
export type NodeState = Record<string, unknown>;
export type WidgetState = Record<string, unknown>;

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

export function cloneRecord(
  value?: Record<string, unknown>
): Record<string, unknown> | undefined {
  return value ? cloneValue(value) : undefined;
}

export function cloneSlotSpec(spec: NodeSlotSpec): NodeSlotSpec {
  return {
    ...spec,
    data: cloneRecord(spec.data)
  };
}

export function cloneSlotSpecs(specs?: NodeSlotSpec[]): NodeSlotSpec[] {
  return specs?.map((spec) => cloneSlotSpec(spec)) ?? [];
}

export function cloneWidgetSpec(spec: NodeWidgetSpec): NodeWidgetSpec {
  return {
    ...spec,
    value: cloneValue(spec.value),
    options: cloneRecord(spec.options)
  };
}

export function cloneWidgetSpecs(specs?: NodeWidgetSpec[]): NodeWidgetSpec[] {
  return specs?.map((spec) => cloneWidgetSpec(spec)) ?? [];
}

export function clonePropertySpec(spec: NodePropertySpec): NodePropertySpec {
  return {
    ...spec,
    default: cloneValue(spec.default),
    options: cloneRecord(spec.options),
    widget: spec.widget ? cloneWidgetSpec(spec.widget) : undefined
  };
}

export function clonePropertySpecs(specs?: NodePropertySpec[]): NodePropertySpec[] {
  return specs?.map((spec) => clonePropertySpec(spec)) ?? [];
}

export function cloneStringList(list?: string[]): string[] | undefined {
  return list ? [...list] : undefined;
}

export function assertNonEmptyText(value: string, label: string): string {
  const safeValue = value.trim();
  if (!safeValue) {
    throw new Error(`${label}不能为空`);
  }

  return safeValue;
}

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
