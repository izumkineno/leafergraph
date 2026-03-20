import { EditorWorkspaceSettingsDialog } from "../../shell/provider";
import type { EditorWorkspaceSettingsViewProps } from "./types";

/**
 * 过渡期 View：当前复用官方连接态 Workspace Settings。
 */
export function EditorWorkspaceSettingsView(_: EditorWorkspaceSettingsViewProps) {
  return <EditorWorkspaceSettingsDialog />;
}
