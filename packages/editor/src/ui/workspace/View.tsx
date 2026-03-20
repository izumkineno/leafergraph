import { EditorWorkspace } from "../../shell/provider";
import type { EditorWorkspaceViewProps } from "./types";

/**
 * 过渡期 View：当前复用官方连接态 Workspace。
 */
export function EditorWorkspaceView(_: EditorWorkspaceViewProps) {
  return <EditorWorkspace />;
}
