import type { WidgetDefinition } from "./definition";
import { UnknownWidgetTypeError, WidgetDefinitionExistsError } from "./errors";
import type { NodePropertySpec, NodeWidgetSpec } from "./types";
import { cloneWidgetSpec } from "./utils";

export const BUILTIN_WIDGET_TYPES = [
  "number",
  "string",
  "combo",
  "toggle",
  "slider",
  "custom"
] as const;

export interface RegisterWidgetOptions {
  overwrite?: boolean;
}

const BUILTIN_WIDGET_DEFINITIONS: WidgetDefinition[] = BUILTIN_WIDGET_TYPES.map((type) => ({
  type,
  title: type
}));

export class WidgetRegistry {
  private readonly definitions = new Map<string, WidgetDefinition>();

  constructor(definitions: WidgetDefinition[] = BUILTIN_WIDGET_DEFINITIONS) {
    for (const definition of definitions) {
      this.register(definition, { overwrite: true });
    }
  }

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

  unregister(type: string): void {
    this.definitions.delete(type);
  }

  get(type: string): WidgetDefinition | undefined {
    return this.definitions.get(type);
  }

  require(type: string): WidgetDefinition {
    const definition = this.get(type);

    if (!definition) {
      throw new UnknownWidgetTypeError(type);
    }

    return definition;
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  list(): WidgetDefinition[] {
    return [...this.definitions.values()];
  }

  validateSpec(spec: NodeWidgetSpec): void {
    this.require(spec.type);
  }

  validatePropertySpec(spec: NodePropertySpec): void {
    if (spec.widget) {
      this.validateSpec(spec.widget);
    }
  }
}

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

export function normalizeWidgetSpecs(
  widgetRegistry: WidgetRegistry,
  specs?: NodeWidgetSpec[]
): NodeWidgetSpec[] {
  return specs?.map((spec) => normalizeWidgetSpec(widgetRegistry, spec)) ?? [];
}

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

export function serializeWidgetSpecs(
  widgetRegistry: WidgetRegistry,
  specs?: NodeWidgetSpec[]
): NodeWidgetSpec[] {
  return specs?.map((spec) => serializeWidgetSpec(widgetRegistry, spec)) ?? [];
}
