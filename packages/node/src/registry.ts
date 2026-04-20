/**
 * 节点定义注册表。
 *
 * 这个模块只负责节点定义的存取与结构性校验，
 * 不承担图实例管理、执行调度或 Widget 真正的注册持久化。
 */

import type { NodeDefinition } from "./definition.js";
import { NodeDefinitionExistsError, UnknownNodeTypeError } from "./errors.js";
import { cloneDefinition } from "./utils.js";
import {
  type WidgetDefinitionReader,
  validateWidgetPropertySpec,
  validateWidgetSpec
} from "./widget.js";

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
  /** 只读 Widget 定义读取器，用于节点声明校验。 */
  readonly widgetDefinitions: WidgetDefinitionReader;

  /**
   * 初始化 NodeRegistry 实例。
   *
   * @param widgetDefinitions - Widget 定义。
   * @param definitions - 定义。
   */
  constructor(
    widgetDefinitions: WidgetDefinitionReader,
    definitions: NodeDefinition[] = []
  ) {
    this.widgetDefinitions = widgetDefinitions;

    for (const definition of definitions) {
      this.register(definition, { overwrite: true });
    }
  }

  /**
   * 注册一个节点定义。
   * 注册表内部始终保存副本，避免外部继续修改原对象影响宿主状态。
   *
   * @param definition - 定义。
   * @param options - 可选配置项。
   * @returns 无返回值。
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

  /**
   *  `register` 的语义化别名。
   *
   * @param definition - 定义。
   * @param options - 可选配置项。
   * @returns 无返回值。
   */
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.register(definition, options);
  }

  /**
   *  从注册表移除节点定义。
   *
   * @param type - 类型。
   * @returns 无返回值。
   */
  unregister(type: string): void {
    this.definitions.delete(type);
  }

  /**
   *  `unregister` 的语义化别名。
   *
   * @param type - 类型。
   * @returns 无返回值。
   */
  unregisterNode(type: string): void {
    this.unregister(type);
  }

  /**
   *  获取节点定义；未命中时返回 `undefined`。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  get(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   *  `get` 的语义化别名。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  getNode(type: string): NodeDefinition | undefined {
    return this.get(type);
  }

  /**
   *  获取节点定义；未命中时抛出错误。
   *
   * @param type - 类型。
   * @returns 处理后的结果。
   */
  require(type: string): NodeDefinition {
    const definition = this.get(type);

    if (!definition) {
      throw new UnknownNodeTypeError(type);
    }

    return definition;
  }

  /**
   *  判断节点类型是否已经注册。
   *
   * @param type - 类型。
   * @returns 对应的判断结果。
   */
  has(type: string): boolean {
    return this.definitions.has(type);
  }

  /**
   *  `has` 的语义化别名。
   *
   * @param type - 类型。
   * @returns 对应的判断结果。
   */
  hasNode(type: string): boolean {
    return this.has(type);
  }

  /**
   *  以数组形式返回当前全部节点定义。
   *
   * @returns 收集到的结果列表。
   */
  list(): NodeDefinition[] {
    return [...this.definitions.values()];
  }

  /**
   *  `list` 的语义化别名。
   *
   * @returns 收集到的结果列表。
   */
  listNodes(): NodeDefinition[] {
    return this.list();
  }

  /**
   * 在注册节点前做结构性校验。
   * 当前重点校验节点声明中引用的 Widget 是否已存在。
   *
   * @param definition - 定义。
   * @param validateWidgets - `validate` Widget。
   * @returns 无返回值。
   */
  private validateDefinition(
    definition: NodeDefinition,
    validateWidgets: boolean
  ): void {
    if (!validateWidgets) {
      return;
    }

    for (const widget of definition.widgets ?? []) {
      validateWidgetSpec(this.widgetDefinitions, widget);
    }

    for (const property of definition.properties ?? []) {
      validateWidgetPropertySpec(this.widgetDefinitions, property);
    }
  }
}
