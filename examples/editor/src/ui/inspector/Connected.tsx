/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { useEditorContext } from "../../shell/provider";
import { EditorInspectorView } from "./View";

/** 连接 `EditorProvider`，把检查器运行态映射到纯视图组件。 */
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
