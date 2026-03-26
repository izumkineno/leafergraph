/**
 * 类型定义模块。
 *
 * @remarks
 * 负责集中声明当前区域或当前子系统对外复用的 props、状态和辅助类型。
 */
import type { InspectorPaneProps } from "../../app/WorkspacePanels";

/** 检查器区域视图对外公开的 props。 */
export interface EditorInspectorViewProps extends InspectorPaneProps {}
