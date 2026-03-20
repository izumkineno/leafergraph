import { InspectorPane } from "../../app/WorkspacePanels";
import type { EditorInspectorViewProps } from "./types";

export function EditorInspectorView(props: EditorInspectorViewProps) {
  return <InspectorPane {...props} />;
}
