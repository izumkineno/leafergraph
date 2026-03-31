/**
 * public façade 的注册与扩展方法组。
 */

import type {
  InstallNodeModuleOptions,
  NodeDefinition,
  NodeModule,
  RegisterNodeOptions,
  RegisterWidgetOptions
} from "@leafergraph/node";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphWidgetEntry
} from "@leafergraph/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的注册与扩展 façade。
 */
export interface LeaferGraphRegistryFacade {
  use(plugin: LeaferGraphNodePlugin): Promise<void>;
  installModule(module: NodeModule, options?: InstallNodeModuleOptions): void;
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void;
  registerWidget(
    entry: LeaferGraphWidgetEntry,
    options?: RegisterWidgetOptions
  ): void;
  getWidget(type: string): LeaferGraphWidgetEntry | undefined;
  listWidgets(): LeaferGraphWidgetEntry[];
  listNodes(): NodeDefinition[];
}

/**
 * 安装一个外部节点插件。
 *
 * @param this - 当前图实例。
 * @param plugin - 需要安装的节点插件。
 * @returns 插件安装完成后的异步结果。
 */
function useLeaferGraphPlugin(
  this: LeaferGraph,
  plugin: LeaferGraphNodePlugin
): Promise<void> {
  return getLeaferGraphApiHost(this).use(plugin);
}

/**
 * 安装一个静态节点模块。
 *
 * @param this - 当前图实例。
 * @param module - 需要安装的节点模块。
 * @param options - 模块安装选项。
 * @returns 无返回值。
 */
function installLeaferGraphModule(
  this: LeaferGraph,
  module: NodeModule,
  options?: InstallNodeModuleOptions
): void {
  getLeaferGraphApiHost(this).installModule(module, options);
}

/**
 * 注册单个节点定义。
 *
 * @param this - 当前图实例。
 * @param definition - 节点定义。
 * @param options - 注册选项。
 * @returns 无返回值。
 */
function registerLeaferGraphNode(
  this: LeaferGraph,
  definition: NodeDefinition,
  options?: RegisterNodeOptions
): void {
  getLeaferGraphApiHost(this).registerNode(definition, options);
}

/**
 * 注册单个完整 Widget 条目。
 *
 * @param this - 当前图实例。
 * @param entry - Widget 条目。
 * @param options - 注册选项。
 * @returns 无返回值。
 */
function registerLeaferGraphWidget(
  this: LeaferGraph,
  entry: LeaferGraphWidgetEntry,
  options?: RegisterWidgetOptions
): void {
  getLeaferGraphApiHost(this).registerWidget(entry, options);
}

/**
 * 读取单个 Widget 条目。
 *
 * @param this - 当前图实例。
 * @param type - Widget 类型。
 * @returns 匹配到的 Widget 条目。
 */
function getLeaferGraphWidget(
  this: LeaferGraph,
  type: string
): LeaferGraphWidgetEntry | undefined {
  return getLeaferGraphApiHost(this).getWidget(type);
}

/**
 * 列出当前已注册 Widget。
 *
 * @param this - 当前图实例。
 * @returns 已注册 Widget 列表。
 */
function listLeaferGraphWidgets(this: LeaferGraph): LeaferGraphWidgetEntry[] {
  return getLeaferGraphApiHost(this).listWidgets();
}

/**
 * 列出当前已注册节点。
 *
 * @param this - 当前图实例。
 * @returns 已注册节点定义列表。
 */
function listLeaferGraphNodes(this: LeaferGraph): NodeDefinition[] {
  return getLeaferGraphApiHost(this).listNodes();
}

export const leaferGraphRegistryFacadeMethods: LeaferGraphRegistryFacade = {
  use: useLeaferGraphPlugin,
  installModule: installLeaferGraphModule,
  registerNode: registerLeaferGraphNode,
  registerWidget: registerLeaferGraphWidget,
  getWidget: getLeaferGraphWidget,
  listWidgets: listLeaferGraphWidgets,
  listNodes: listLeaferGraphNodes
};
