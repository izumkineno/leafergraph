import { EditorStatusbarView } from "./View";
import type { EditorStatusbarViewProps } from "./types";

export interface EditorStatusbarConnectedProps extends EditorStatusbarViewProps {}

export function EditorStatusbarConnected(props: EditorStatusbarConnectedProps) {
  return <EditorStatusbarView {...props} />;
}
