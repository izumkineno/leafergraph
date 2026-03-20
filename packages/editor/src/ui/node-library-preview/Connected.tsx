import { useEditorContext } from "../../shell/provider";
import { NodeLibraryHoverPreviewOverlay } from "./View";

export function EditorNodeLibraryPreviewConnected() {
  const { state, runtimeSetup, nodeLibraryHoverPreviewEnabled } = useEditorContext();

  if (
    !nodeLibraryHoverPreviewEnabled ||
    !state.leftPaneOpen ||
    !state.nodeLibraryPreviewRequest
  ) {
    return null;
  }

  return (
    <NodeLibraryHoverPreviewOverlay
      request={state.nodeLibraryPreviewRequest}
      theme={state.theme}
      plugins={runtimeSetup.plugins}
    />
  );
}
