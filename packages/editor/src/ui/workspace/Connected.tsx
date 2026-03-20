import { EditorWorkspaceView } from "./View";
import type { EditorWorkspaceViewProps } from "./types";

export interface EditorWorkspaceConnectedProps extends EditorWorkspaceViewProps {}

export function EditorWorkspaceConnected(props: EditorWorkspaceConnectedProps) {
  return <EditorWorkspaceView {...props} />;
}
