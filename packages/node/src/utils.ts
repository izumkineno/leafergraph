import type { NodeDefinition } from "./definition";
import type {
  NodeFlags,
  NodeLayout,
  NodePropertySpec,
  NodeSlotSpec,
  NodeWidgetSpec
} from "./types";

let nodeIdSeed = 1;

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

export function cloneFlags(flags?: NodeFlags): NodeFlags {
  return flags ? cloneValue(flags) : {};
}

export function cloneLayout(layout?: Partial<NodeLayout>): NodeLayout {
  return {
    x: layout?.x ?? 0,
    y: layout?.y ?? 0,
    width: layout?.width,
    height: layout?.height
  };
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

export function cloneDefinition(definition: NodeDefinition): NodeDefinition {
  return {
    ...definition,
    keywords: definition.keywords ? [...definition.keywords] : undefined,
    inputs: cloneSlotSpecs(definition.inputs),
    outputs: cloneSlotSpecs(definition.outputs),
    properties: clonePropertySpecs(definition.properties),
    widgets: cloneWidgetSpecs(definition.widgets),
    size: definition.size ? [definition.size[0], definition.size[1]] : undefined
  };
}

export function createDefaultTitle(type: string): string {
  const tail = type.split(/[/:]/).pop() ?? type;
  return tail
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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

export function resizeRuntimeValues(values: unknown[], size: number): unknown[] {
  const next = values.slice(0, size);

  while (next.length < size) {
    next.push(undefined);
  }

  return next;
}
