import type { NodeDefinition, WidgetDefinition } from "./definition";
import { NodeDefinitionExistsError, UnknownNodeTypeError } from "./errors";
import { cloneDefinition } from "./utils";
import { type RegisterWidgetOptions, WidgetRegistry } from "./widget";

export interface RegisterNodeOptions {
  overwrite?: boolean;
  validateWidgets?: boolean;
}

export class NodeRegistry {
  private readonly definitions = new Map<string, NodeDefinition>();
  readonly widgetRegistry: WidgetRegistry;

  constructor(
    widgetRegistry: WidgetRegistry = new WidgetRegistry(),
    definitions: NodeDefinition[] = []
  ) {
    this.widgetRegistry = widgetRegistry;

    for (const definition of definitions) {
      this.register(definition, { overwrite: true });
    }
  }

  register(definition: NodeDefinition, options: RegisterNodeOptions = {}): void {
    const type = definition.type.trim();

    if (!type) {
      throw new Error("节点类型不能为空");
    }

    if (!options.overwrite && this.definitions.has(type)) {
      throw new NodeDefinitionExistsError(type);
    }

    this.validateDefinition(definition, options.validateWidgets ?? true);

    this.definitions.set(
      type,
      cloneDefinition({
        ...definition,
        type
      })
    );
  }

  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.register(definition, options);
  }

  unregister(type: string): void {
    this.definitions.delete(type);
  }

  unregisterNode(type: string): void {
    this.unregister(type);
  }

  get(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  getNode(type: string): NodeDefinition | undefined {
    return this.get(type);
  }

  require(type: string): NodeDefinition {
    const definition = this.get(type);

    if (!definition) {
      throw new UnknownNodeTypeError(type);
    }

    return definition;
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  hasNode(type: string): boolean {
    return this.has(type);
  }

  list(): NodeDefinition[] {
    return [...this.definitions.values()];
  }

  listNodes(): NodeDefinition[] {
    return this.list();
  }

  registerWidget(definition: WidgetDefinition, options?: RegisterWidgetOptions): void {
    this.widgetRegistry.register(definition, options);
  }

  unregisterWidget(type: string): void {
    this.widgetRegistry.unregister(type);
  }

  getWidget(type: string): WidgetDefinition | undefined {
    return this.widgetRegistry.get(type);
  }

  listWidgets(): WidgetDefinition[] {
    return this.widgetRegistry.list();
  }

  private validateDefinition(
    definition: NodeDefinition,
    validateWidgets: boolean
  ): void {
    if (!validateWidgets) {
      return;
    }

    for (const widget of definition.widgets ?? []) {
      this.widgetRegistry.validateSpec(widget);
    }

    for (const property of definition.properties ?? []) {
      this.widgetRegistry.validatePropertySpec(property);
    }
  }
}
