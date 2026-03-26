/**
 * 类型定义模块。
 *
 * @remarks
 * 负责集中声明当前区域或当前子系统对外复用的 props、状态和辅助类型。
 */
/** 复用画布执行面公开出来的 bridge、状态与控制类型。 */
export type {
  GraphViewportHostBridge,
  GraphViewportProps,
  GraphViewportRuntimeControlsState,
  GraphViewportRuntimeInspectorState,
  GraphViewportToolbarActionGroup,
  GraphViewportToolbarActionId,
  GraphViewportToolbarActionState,
  GraphViewportToolbarControlsState,
  GraphViewportWorkspaceState
} from "./View";
