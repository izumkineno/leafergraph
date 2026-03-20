import { useEditorContext } from "../../shell/provider";
import { EditorNodeLibraryView } from "./View";

export function EditorNodeLibraryConnected() {
  const { state, actions, runtimeSetup, nodeLibraryHoverPreviewEnabled, viewportHostBridge } =
    useEditorContext();

  return (
    <EditorNodeLibraryView
      definitions={state.availableNodeDefinitions}
      searchQuery={state.nodeLibrarySearchQuery}
      activeNodeType={state.activeLibraryNodeType}
      presentation={state.leftPanePresentation}
      quickCreateNodeType={runtimeSetup.quickCreateNodeType}
      disabled={!viewportHostBridge}
      hoverPreviewEnabled={nodeLibraryHoverPreviewEnabled}
      focusSearchOnOpen={
        state.leftPaneOpen && state.leftPanePresentation !== "docked"
      }
      cleanEntryHint={
        state.defaultEntryOnboardingState.showNodeLibraryHint
          ? {
              onOpenExtensions: () => {
                actions.openWorkspaceSettings("extensions");
              },
              onOpenNodeAuthorityDemo: actions.openNodeAuthorityDemo,
              onOpenPythonAuthorityDemo: actions.openPythonAuthorityDemo
            }
          : undefined
      }
      onSearchQueryChange={actions.setNodeLibrarySearchQuery}
      onActiveNodeTypeChange={(nodeType) => {
        actions.setActiveLibraryNodeType(nodeType);
      }}
      onCreateNode={actions.createNodeFromWorkspace}
      onPreviewRequestChange={actions.setNodeLibraryPreviewRequest}
    />
  );
}
