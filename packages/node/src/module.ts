/**
 * 节点模块解析与安装工具。
 *
 * 这里负责把模块级命名空间 / 分组规则应用到节点定义上，
 * 并提供“解析但不安装”和“直接安装到注册表”两条入口。
 */

import type { NodeDefinition, NodeModule, NodeModuleScope } from "./definition.js";
import type { NodeRegistry, RegisterNodeOptions } from "./registry.js";
import { cloneDefinition } from "./utils.js";

/**
 * 安装节点模块时的控制项。
 * 它继承节点注册选项，并额外允许传入一次性的作用域覆写。
 */
export interface InstallNodeModuleOptions extends RegisterNodeOptions {
  /** 安装时额外覆写的作用域。 */
  scope?: NodeModuleScope;
}

/**
 * 模块解析后的标准结构。
 * 宿主拿到它之后就可以明确知道最终生效的 scope 和 nodes。
 */
export interface ResolvedNodeModule {
  /** 解析后最终生效的作用域。 */
  scope: NodeModuleScope;
  /** 已应用作用域规则后的节点定义数组。 */
  nodes: NodeDefinition[];
}

/**
 * 将一个模块安装到节点注册表中。
 * 安装前会先解析并标准化模块作用域，再批量注册节点定义。
 *
 * @param registry - 注册表。
 * @param module - 模块。
 * @param options - 可选配置项。
 * @returns 安装节点模块的结果。
 */
export function installNodeModule(
  registry: NodeRegistry,
  module: NodeModule,
  options: InstallNodeModuleOptions = {}
): ResolvedNodeModule {
  const resolved = resolveNodeModule(module, options);

  for (const node of resolved.nodes) {
    registry.register(node, options);
  }

  return resolved;
}

/**
 * 解析模块，得到最终可安装结构，但不直接写入注册表。
 * 这个函数适合宿主在真正安装前先做日志、校验或调试展示。
 *
 * @param module - 模块。
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
export function resolveNodeModule(
  module: NodeModule,
  options: InstallNodeModuleOptions = {}
): ResolvedNodeModule {
  const scope = resolveNodeModuleScope(module.scope, options.scope);

  return {
    scope,
    nodes: module.nodes?.map((definition) => applyNodeModuleScope(definition, scope)) ?? []
  };
}

/**
 * 合并模块自身作用域与安装时覆写作用域。
 * 安装参数优先级高于模块内默认值。
 *
 * @param baseScope - `base` 作用域。
 * @param overrideScope - `override` 作用域。
 * @returns 处理后的结果。
 */
export function resolveNodeModuleScope(
  baseScope?: NodeModuleScope,
  overrideScope?: NodeModuleScope
): NodeModuleScope {
  const namespace = normalizeNamespace(overrideScope?.namespace ?? baseScope?.namespace);
  const group = normalizeGroup(overrideScope?.group ?? baseScope?.group);

  return {
    namespace,
    group
  };
}

/**
 * 将模块作用域应用到单个节点定义上。
 * 它会补全最终 `type`，并在缺少 `category` 时继承模块默认分组。
 *
 * @param definition - 定义。
 * @param scope - 作用域。
 * @returns 应用节点模块作用域的结果。
 */
export function applyNodeModuleScope(
  definition: NodeDefinition,
  scope: NodeModuleScope
): NodeDefinition {
  const next = cloneDefinition(definition);
  const type = next.type.trim();

  next.type = resolveScopedNodeType(type, scope.namespace);

  if (!next.category) {
    next.category = scope.group;
  }

  return next;
}

/**
 * 计算节点最终类型。
 * 如果节点本身已经显式带命名空间，则不会重复拼接模块前缀。
 *
 * @param type - 类型。
 * @param namespace - `namespace`。
 * @returns 处理后的结果。
 */
export function resolveScopedNodeType(type: string, namespace?: string): string {
  const safeType = type.trim();
  const safeNamespace = normalizeNamespace(namespace);

  if (!safeNamespace || isScopedNodeType(safeType)) {
    return safeType;
  }

  return `${safeNamespace}/${safeType}`;
}

/**
 * 判断节点类型是否已经带作用域前缀。
 * 当前把 `/` 和 `:` 都视为已作用域化的分隔符。
 *
 * @param type - 类型。
 * @returns 对应的判断结果。
 */
export function isScopedNodeType(type: string): boolean {
  return /[/:]/.test(type);
}

/**
 * 标准化命名空间文本。
 * 它会统一路径分隔符，并裁掉首尾多余斜杠。
 *
 * @param namespace - `namespace`。
 * @returns 处理后的结果。
 */
function normalizeNamespace(namespace?: string): string | undefined {
  const value = namespace?.trim().replace(/[/\\]+/g, "/").replace(/^\/+|\/+$/g, "");
  return value || undefined;
}

/**
 * 标准化模块默认分组名称。
 *
 * @param group - 分组。
 * @returns 处理后的结果。
 */
function normalizeGroup(group?: string): string | undefined {
  const value = group?.trim();
  return value || undefined;
}
