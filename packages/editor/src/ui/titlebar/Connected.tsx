import { EditorTitlebarView } from "./View";
import type { EditorTitlebarViewProps } from "./types";

export interface EditorTitlebarConnectedProps extends EditorTitlebarViewProps {}

export function EditorTitlebarConnected(props: EditorTitlebarConnectedProps) {
  return <EditorTitlebarView {...props} />;
}
