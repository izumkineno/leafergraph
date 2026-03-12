import type { NodeDefinition, WidgetDefinition } from "./definition";
import { NodeDefinitionExistsError, UnknownNodeTypeError } from "./errors";
import { cloneDefinition } from "./utils";
import { type RegisterWidgetOptions, WidgetRegistry } from "./widget";

/**
 * 注册节点定义时的控制项。
 */
export interface RegisterNodeOptions {
  /** 是否允许覆写已存在的节点类型。 */
  overwrite?: boolean;
  /** 注册前是否校验节点引用的 Widget 类型。 */
  validateWidgets?: boolean;
}

/**
 * 节点定义注册表。
 * 主包与外部插件最终都会把节点定义注册到这里。
 */
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

  /**
   * 注册一个节点定义。
   * 注册表内部始终保存副本，避免外部继续修改原对象影响宿主状态。
   */
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

  /** `register` 的语义化别名。 */
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.register(definition, options);
  }

  /** 从注册表移除节点定义。 */
  unregister(type: string): void {
    this.definitions.delete(type);
  }

  /** `unregister` 的语义化别名。 */
  unregisterNode(type: string): void {
    this.unregister(type);
  }

  /** 获取节点定义；未命中时返回 `undefined`。 */
  get(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  /** `get` 的语义化别名。 */
  getNode(type: string): NodeDefinition | undefined {
    return this.get(type);
  }

  /** 获取节点定义；未命中时抛出错误。 */
  require(type: string): NodeDefinition {
    const definition = this.get(type);

    if (!definition) {
      throw new UnknownNodeTypeError(type);
    }

    return definition;
  }

  /** 判断节点类型是否已经注册。 */
  has(type: string): boolean {
    return this.definitions.has(type);
  }

  /** `has` 的语义化别名。 */
  hasNode(type: string): boolean {
    return this.has(type);
  }

  /** 以数组形式返回当前全部节点定义。 */
  list(): NodeDefinition[] {
    return [...this.definitions.values()];
  }

  /** `list` 的语义化别名。 */
  listNodes(): NodeDefinition[] {
    return this.list();
  }

  /** 代理注册 Widget 定义。 */
  registerWidget(definition: WidgetDefinition, options?: RegisterWidgetOptions): void {
    this.widgetRegistry.register(definition, options);
  }

  /** 代理卸载 Widget 定义。 */
  unregisterWidget(type: string): void {
    this.widgetRegistry.unregister(type);
  }

  /** 代理读取 Widget 定义。 */
  getWidget(type: string): WidgetDefinition | undefined {
    return this.widgetRegistry.get(type);
  }

  /** 代理列出全部 Widget 定义。 */
  listWidgets(): WidgetDefinition[] {
    return this.widgetRegistry.list();
  }

  /**
   * 在注册节点前做结构性校验。
   * 当前重点校验节点声明中引用的 Widget 是否已存在。
   */
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
