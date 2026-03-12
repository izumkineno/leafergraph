/**
 * 节点注册与解析相关错误的统一基类。
 */
export class NodeRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeRegistryError";
  }
}

/**
 * 节点类型重复注册时报错。
 */
export class NodeDefinitionExistsError extends NodeRegistryError {
  constructor(type: string) {
    super(`节点类型已存在: ${type}`);
    this.name = "NodeDefinitionExistsError";
  }
}

/**
 * Widget 类型重复注册时报错。
 */
export class WidgetDefinitionExistsError extends NodeRegistryError {
  constructor(type: string) {
    super(`Widget 类型已存在: ${type}`);
    this.name = "WidgetDefinitionExistsError";
  }
}

/**
 * 读取未注册节点类型时报错。
 */
export class UnknownNodeTypeError extends NodeRegistryError {
  constructor(type: string) {
    super(`未注册的节点类型: ${type}`);
    this.name = "UnknownNodeTypeError";
  }
}

/**
 * 读取未注册 Widget 类型时报错。
 */
export class UnknownWidgetTypeError extends NodeRegistryError {
  constructor(type: string) {
    super(`未注册的 Widget 类型: ${type}`);
    this.name = "UnknownWidgetTypeError";
  }
}
