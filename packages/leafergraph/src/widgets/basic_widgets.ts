/**
 * 基础 Widget 的兼容出口。
 * 真实实现已经拆到 `widgets/basic/` 目录中，这里保留旧路径，
 * 避免主包与外部调用方在本轮重构后立即受到路径变更影响。
 */
export {
  BasicWidgetLibrary,
  BasicWidgetRendererLibrary,
  resolveBasicWidgetTheme
} from "./basic";
export type {
  BasicWidgetEntry,
  BasicWidgetLifecycle,
  BasicWidgetLifecycleState,
  BasicWidgetTheme
} from "./basic";
