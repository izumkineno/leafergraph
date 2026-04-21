/**
 * `@leafergraph/extensions/authoring` 的统一公共入口。
 *
 * 这个包只负责节点 / Widget 作者层体验，以及把作者代码收口成
 * `@leafergraph/core/node` 与 `leafergraph` 可消费的正式产物。
 * 它不承担 editor 适配、bundle 协议或历史兼容逻辑。
 */

/** 节点作者层：节点元信息、上下文、基类与模块 / 插件组装能力。 */
export type {
  CreateAuthoringModuleOptions,
  CreateAuthoringPluginOptions,
  DevNodeClass,
  DevNodeContext,
  DevNodeMeta
} from "./node_authoring.js";
/** 节点作者层：节点基类与定义收口入口。 */
export {
  BaseNode,
  createAuthoringModule,
  createAuthoringPlugin,
  defineAuthoringNode
} from "./node_authoring.js";
/** Widget 作者层：Widget 元信息、上下文与作者类类型。 */
export type {
  DevWidgetClass,
  DevWidgetContext,
  DevWidgetMeta
} from "./widget_authoring.js";
/** Widget 作者层：Widget 基类与定义收口入口。 */
export { BaseWidget, defineAuthoringWidget } from "./widget_authoring.js";
/** 共享作者层类型：节点输入、输出、属性与本地状态别名。 */
export type {
  NodeInputs,
  NodeOutputs,
  NodeProps,
  NodeState,
  WidgetState
} from "./shared.js";
