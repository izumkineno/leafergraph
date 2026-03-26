/**
 * editor 根公共导出入口。
 *
 * @remarks
 * 负责统一导出壳层组件、Provider 和控制器接口，供外部页面按包名直接消费。
 */
/** 导出 editor 应用壳层和上下文入口。 */
export {
  App,
  EditorProvider,
  EditorShell,
  useEditorContext,
  type AppProps,
  type EditorProviderProps,
  type EditorShellProps
} from "./shell/provider";
/** 导出顶层错误边界。 */
export {
  EditorErrorBoundary,
  type EditorErrorBoundaryProps
} from "./shell/error_boundary";
/** 导出 editor 控制器模型与状态类型。 */
export {
  createEditorController,
  type CreateEditorControllerOptions,
  type EditorController,
  type EditorControllerActions,
  type EditorControllerState,
  type RemoteAuthorityConnectionDisplayStatus,
  type RemoteAuthorityRuntimeStatus,
  type RunConsoleTab,
  type WorkspaceSettingsTab
} from "./shell/editor_controller";
