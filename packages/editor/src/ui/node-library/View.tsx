import { NodeLibraryPane } from "../../app/WorkspacePanels";
import type { EditorNodeLibraryViewProps } from "./types";

export function EditorNodeLibraryView(props: EditorNodeLibraryViewProps) {
  return <NodeLibraryPane {...props} />;
}
