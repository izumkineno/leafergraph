/**
 * `@leafergraph/node` 的统一公共入口。
 * 这里导出节点定义、注册表、序列化工具和模块安装能力，供主包与外部插件共用。
 */
export type {
  NodeFlags,
  NodeInit,
  NodeLayout,
  NodePropertySpec,
  NodePropertyType,
  NodeRuntimeState,
  NodeSerializeResult,
  NodeSlotShape,
  NodeSlotSpec,
  NodeState,
  NodeWidgetSpec,
  NodeWidgetType,
  SlotDirection,
  SlotType
} from "./types";
export type { NodeApi, NodeLifecycle } from "./lifecycle";
export type { NodeDefinition, NodeModule, NodeModuleScope, WidgetDefinition } from "./definition";
export type { RegisterNodeOptions } from "./registry";
export type { RegisterWidgetOptions } from "./widget";
export type { InstallNodeModuleOptions, ResolvedNodeModule } from "./module";
export type { NodeConfigureInput } from "./configure";
export type { LeaferGraphNodeData, LeaferGraphOptions } from "./demo";

export { NodeRegistry } from "./registry";
export { WidgetRegistry, BUILTIN_WIDGET_TYPES } from "./widget";
export { createNodeApi } from "./api";
export { createNodeState } from "./factory";
export { configureNode } from "./configure";
export { serializeNode } from "./serialize";
export {
  applyNodeModuleScope,
  installNodeModule,
  isScopedNodeType,
  resolveNodeModule,
  resolveNodeModuleScope,
  resolveScopedNodeType
} from "./module";
