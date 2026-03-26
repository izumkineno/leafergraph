/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { useEditorContext } from "../../shell/provider";
import { EditorNodeLibraryView } from "./View";

/** 连接 `EditorProvider`，把节点库状态和交互动作转交给纯视图组件。 */
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
