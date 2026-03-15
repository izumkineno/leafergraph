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
} from "./types";
export type { NodeApi, NodeLifecycle } from "./lifecycle";
export type {
  NodeDefinition,
  NodeModule,
  NodeModuleScope,
  NodeResizeConfig,
  WidgetDefinition
} from "./definition";
export type { RegisterNodeOptions } from "./registry";
export type { RegisterWidgetOptions, WidgetDefinitionReader } from "./widget";
export type { InstallNodeModuleOptions, ResolvedNodeModule } from "./module";
export type { NodeConfigureInput } from "./configure";
export type {
  LeaferGraphData,
  LeaferGraphLinkData,
  LeaferGraphLinkEndpoint
} from "./graph";

export { NodeRegistry } from "./registry";
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
} from "./widget";
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
