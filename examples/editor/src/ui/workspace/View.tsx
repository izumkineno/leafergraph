/**
 * 视图组件模块。
 *
 * @remarks
 * 负责承接当前区域的纯展示结构与交互回调，尽量把运行时编排留在 Connected 组件或 shell 层处理。
 */
import { EditorWorkspace } from "../../shell/provider";
import type { EditorWorkspaceViewProps } from "./types";

/**
 * 过渡期 View：当前复用官方连接态 Workspace。
 */
export function EditorWorkspaceView(_: EditorWorkspaceViewProps) {
  return <EditorWorkspace />;
}
