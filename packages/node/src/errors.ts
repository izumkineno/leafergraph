export class NodeRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeRegistryError";
  }
}

export class NodeDefinitionExistsError extends NodeRegistryError {
  constructor(type: string) {
    super(`节点类型已存在: ${type}`);
    this.name = "NodeDefinitionExistsError";
  }
}

export class WidgetDefinitionExistsError extends NodeRegistryError {
  constructor(type: string) {
    super(`Widget 类型已存在: ${type}`);
    this.name = "WidgetDefinitionExistsError";
  }
}

export class UnknownNodeTypeError extends NodeRegistryError {
  constructor(type: string) {
    super(`未注册的节点类型: ${type}`);
    this.name = "UnknownNodeTypeError";
  }
}

export class UnknownWidgetTypeError extends NodeRegistryError {
  constructor(type: string) {
    super(`未注册的 Widget 类型: ${type}`);
    this.name = "UnknownWidgetTypeError";
  }
}
