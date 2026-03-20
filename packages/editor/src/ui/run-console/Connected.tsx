import { EditorRunConsoleView } from "./View";
import type { EditorRunConsoleViewProps } from "./types";

export interface EditorRunConsoleConnectedProps extends EditorRunConsoleViewProps {}

export function EditorRunConsoleConnected(props: EditorRunConsoleConnectedProps) {
  return <EditorRunConsoleView {...props} />;
}
