import { EditorWorkspaceSettingsView } from "./View";
import type { EditorWorkspaceSettingsViewProps } from "./types";

export interface EditorWorkspaceSettingsConnectedProps
  extends EditorWorkspaceSettingsViewProps {}

export function EditorWorkspaceSettingsConnected(
  props: EditorWorkspaceSettingsConnectedProps
) {
  return <EditorWorkspaceSettingsView {...props} />;
}
