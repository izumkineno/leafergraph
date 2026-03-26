/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { EditorWorkspaceSettingsView } from "./View";
import type { EditorWorkspaceSettingsViewProps } from "./types";

/** 工作区设置 Connected 组件当前透传纯视图 props。 */
export interface EditorWorkspaceSettingsConnectedProps
  extends EditorWorkspaceSettingsViewProps {}

/** 作为工作区设置区域的 Connected 包装，保留统一接线命名。 */
export function EditorWorkspaceSettingsConnected(
  props: EditorWorkspaceSettingsConnectedProps
) {
  return <EditorWorkspaceSettingsView {...props} />;
}
