import { useEditorContext } from "../../shell/provider";
import { EditorInspectorView } from "./View";

export function EditorInspectorConnected() {
  const { state, authoritySummary, actions } = useEditorContext();

  return (
    <EditorInspectorView
      presentation={state.rightPanePresentation}
      workspaceState={state.workspaceState}
      authoritySummary={authoritySummary}
      onOpenRunConsole={() => {
        actions.openRunConsole("overview");
      }}
    />
  );
}
