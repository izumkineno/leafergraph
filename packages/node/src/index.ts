/**
 * `@leafergraph/node` 的统一公共入口。
 * 这里导出节点定义、注册表、序列化工具和模块安装能力，供主包与外部插件共用。
 */
export type {
  NodeBaseWidgetOptions,
  NodeButtonWidgetOptions,
  NodeCheckboxWidgetOptions,
  NodeFlags,
  NodeInit,
  NodeLayout,
  NodeOptionWidgetOptions,
  NodePropertySpec,
  NodePropertyType,
  NodeRuntimeState,
  NodeSerializeResult,
  NodeSliderWidgetOptions,
  NodeSlotShape,
  NodeSlotSpec,
  NodeState,
  NodeTextWidgetOptions,
  NodeTextareaWidgetOptions,
  NodeToggleWidgetOptions,
  NodeWidgetOptionItem,
  NodeWidgetSpec,
  NodeWidgetType,
  SlotDirection,
  SlotType
} from "./types.js";
export type { NodeApi, NodeLifecycle } from "./lifecycle.js";
export type {
  NodeDefinition,
  NodeModule,
  NodeModuleScope,
  NodeResizeConfig,
  WidgetDefinition
} from "./definition.js";
export type { RegisterNodeOptions } from "./registry.js";
export type { RegisterWidgetOptions, WidgetDefinitionReader } from "./widget.js";
export type { InstallNodeModuleOptions, ResolvedNodeModule } from "./module.js";
export type { NodeConfigureInput } from "./configure.js";
export type {
  AdapterBinding,
  CapabilityProfile,
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint
} from "./graph.js";

export { NodeRegistry } from "./registry.js";
export {
  BUILTIN_WIDGET_TYPES,
  hasWidgetDefinition,
  normalizeWidgetSpec,
  normalizeWidgetSpecs,
  requireWidgetDefinition,
  serializeWidgetSpec,
  serializeWidgetSpecs,
  validateWidgetPropertySpec,
  validateWidgetSpec
} from "./widget.js";
export { createNodeApi } from "./api.js";
export { createNodeState } from "./factory.js";
export { configureNode } from "./configure.js";
export { serializeNode } from "./serialize.js";
export {
  applyNodeModuleScope,
  installNodeModule,
  isScopedNodeType,
  resolveNodeModule,
  resolveNodeModuleScope,
  resolveScopedNodeType
} from "./module.js";
