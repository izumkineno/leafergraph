/**
 * `@leafergraph/node` 的统一公共入口。
 * 这里导出节点定义、注册表、序列化工具和模块安装能力，供主包与外部插件共用。
 */
/** 基础类型模型：槽位、属性、Widget、运行时状态与初始化输入。 */
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
/** 生命周期与节点运行时可操作 API。 */
export type { NodeApi, NodeLifecycle } from "./lifecycle.js";
/** 正式定义层：节点定义、Widget 定义、模块与模块作用域。 */
export type {
  NodeDefinition,
  NodeModule,
  NodeModuleScope,
  NodeResizeConfig,
  WidgetDefinition
} from "./definition.js";
/** 节点注册表控制项。 */
export type { RegisterNodeOptions } from "./registry.js";
/** Widget 读取与校验相关类型。 */
export type { RegisterWidgetOptions, WidgetDefinitionReader } from "./widget.js";
/** 模块安装与解析相关类型。 */
export type { InstallNodeModuleOptions, ResolvedNodeModule } from "./module.js";
/** 节点重配置输入。 */
export type { NodeConfigureInput } from "./configure.js";
/** 图文档与跨应用绑定模型。 */
export type {
  AdapterBinding,
  CapabilityProfile,
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint
} from "./graph.js";

/** 节点定义注册表。 */
export { NodeRegistry } from "./registry.js";
/** Widget 校验、归一化与序列化工具。 */
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
/** 共享的深拷贝工具。 */
export {
  clonePropertySpec,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpec,
  cloneSlotSpecs,
  cloneValue,
  cloneWidgetSpec,
  cloneWidgetSpecs
} from "./utils.js";
/** 节点运行时 API 工厂。 */
export { createNodeApi } from "./api.js";
/** 节点实例工厂。 */
export { createNodeState } from "./factory.js";
/** 节点实例重配置入口。 */
export { configureNode } from "./configure.js";
/** 节点序列化入口。 */
export { serializeNode } from "./serialize.js";
/** 模块解析、作用域应用与安装工具。 */
export {
  applyNodeModuleScope,
  installNodeModule,
  isScopedNodeType,
  resolveNodeModule,
  resolveNodeModuleScope,
  resolveScopedNodeType
} from "./module.js";
