/**
 * Connected 接线组件模块。
 *
 * @remarks
 * 负责从 EditorProvider 或上层 props 读取当前区域所需状态，再转交给对应的 View 组件。
 */
import { useEditorContext } from "../../shell/provider";
import { GraphViewport } from "./View";

/** 连接 `EditorProvider`，把当前有效文档、运行时和工具栏回调接入画布执行面。 */
export function EditorViewportConnected() {
  const {
    state,
    actions,
    runtimeSetup,
    effectiveDocument,
    effectiveCreateDocumentSessionBinding,
    effectiveRuntimeFeedbackInlet,
    remoteAuthorityRuntime,
    handleViewportHostBridgeChange,
    setEditorToolbarControls,
    setGraphRuntimeControls,
    setRemoteRuntimeControlNotice,
    setWorkspaceState
  } = useEditorContext();

  if (state.isRemoteAuthorityEnabled && state.remoteAuthorityStatus !== "ready") {
    return (
      <div class="workspace-stage__empty">
        <div class="workspace-stage__empty-card">
          <p class="workspace-pane__eyebrow">Remote Authority</p>
          <h2>
            {state.remoteAuthorityStatus === "error"
              ? "Authority 连接失败"
              : "正在装配远端文档"}
          </h2>
          <p>
            {state.remoteAuthorityStatus === "error"
              ? state.remoteAuthorityError ??
                "当前 authority 未能返回可用文档，请重试或切回本地模式。"
              : "Editor 正在等待 authority client、正式 GraphDocument 和 runtime feedback 通道就绪。"}
          </p>
          <div class="workspace-stage__empty-actions">
            <button
              type="button"
              class="workspace-primary-button"
              disabled={state.remoteAuthorityStatus === "loading"}
              onClick={() => {
                actions.reloadRemoteAuthority();
              }}
            >
              {state.remoteAuthorityStatus === "loading" ? "连接中" : "重试连接"}
            </button>
            <button
              type="button"
              class="workspace-secondary-button"
              onClick={() => {
                actions.openWorkspaceSettings("authority");
              }}
            >
              打开 Authority 设置
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="workspace-stage__stack">
      <GraphViewport
        document={effectiveDocument}
        plugins={runtimeSetup.plugins}
        debugSettings={state.leaferDebugSettings}
        createDocumentSessionBinding={effectiveCreateDocumentSessionBinding}
        runtimeFeedbackInlet={effectiveRuntimeFeedbackInlet}
        runtimeController={remoteAuthorityRuntime?.runtimeController}
        runtimeControlMode={remoteAuthorityRuntime ? "remote" : "local"}
        onHostBridgeChange={handleViewportHostBridgeChange}
        quickCreateNodeType={runtimeSetup.quickCreateNodeType}
        theme={state.theme}
        onEditorToolbarControlsChange={setEditorToolbarControls}
        onGraphRuntimeControlsChange={setGraphRuntimeControls}
        onRemoteRuntimeControlNoticeChange={setRemoteRuntimeControlNotice}
        onWorkspaceStateChange={setWorkspaceState}
      />
      {state.defaultEntryOnboardingState.showStageOnboarding ? (
        <div class="workspace-stage__overlay">
          <div class="workspace-stage__onboarding-card">
            <p class="workspace-pane__eyebrow">Clean Entry</p>
            <h2>当前打开的是干净编辑器入口</h2>
            <p>
              这里不会自动预加载 node/widget bundle，也不会直接切到 demo authority，所以你现在看到的是本地 loopback + 空工作区。
            </p>
            <p>
              如果想马上看到完整节点库和示例链路，可以直接进入预载好的 Python Authority Demo；如果想保持当前入口干净，也可以先去 Extensions 手动加载本地 bundle。
            </p>
            <div class="workspace-stage__empty-actions">
              <button
                type="button"
                class="workspace-primary-button"
                onClick={actions.openPythonAuthorityDemo}
              >
                打开 Python Authority Demo
              </button>
              <button
                type="button"
                class="workspace-secondary-button"
                onClick={() => {
                  actions.openWorkspaceSettings("extensions");
                }}
              >
                打开 Extensions
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
