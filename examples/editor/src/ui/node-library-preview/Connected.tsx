/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { useEditorContext } from "../../shell/provider";
import { NodeLibraryHoverPreviewOverlay } from "./View";

/** 连接 `EditorProvider`，把节点库 hover 预览请求映射到浮层视图。 */
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
      debugSettings={state.leaferDebugSettings}
    />
  );
}
