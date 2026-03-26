/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { EditorWorkspaceView } from "./View";
import type { EditorWorkspaceViewProps } from "./types";

/** 主工作区 Connected 组件当前透传纯视图 props。 */
export interface EditorWorkspaceConnectedProps extends EditorWorkspaceViewProps {}

/** 作为主工作区区域的 Connected 包装，保留统一接线命名。 */
export function EditorWorkspaceConnected(props: EditorWorkspaceConnectedProps) {
  return <EditorWorkspaceView {...props} />;
}
