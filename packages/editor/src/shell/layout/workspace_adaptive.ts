/**
 * 工作区自适应布局模块。
 *
 * @remarks
 * 负责根据窗口尺寸、面板开关和 workspace 偏好计算 editor 的断点模式与 stage 布局。
 */
/** editor 当前支持的响应式工作区模式。 */
export type WorkspaceAdaptiveMode =
  | "wide-desktop"
  | "compact-desktop"
  | "tablet"
  | "mobile";

/** 单侧面板在当前断点下的展示形态。 */
export type WorkspacePanePresentation = "docked" | "drawer" | "fullscreen";
/** 主工作台在当前断点下的整体布局形态。 */
export type WorkspaceStageLayout =
  | "solo"
  | "left-docked"
  | "right-docked"
  | "dual-docked";

/** 计算主工作台布局时需要考虑的最小输入。 */
export interface ResolveWorkspaceStageLayoutOptions {
  adaptiveMode: WorkspaceAdaptiveMode;
  leftPanePresentation: WorkspacePanePresentation;
  rightPanePresentation: WorkspacePanePresentation;
  leftPaneOpen: boolean;
  rightPaneOpen: boolean;
}

/** 当前布局计算产出的最终结果。 */
export interface ResolvedWorkspaceStageLayout {
  stageLayout: WorkspaceStageLayout;
  hasVisibleDockedLeftPane: boolean;
  hasVisibleDockedRightPane: boolean;
}

/** 根据可视宽度推导 editor 当前应采用的响应式模式。 */
export function resolveWorkspaceAdaptiveMode(
  viewportWidth: number | undefined
): WorkspaceAdaptiveMode {
  const width =
    typeof viewportWidth === "number" && Number.isFinite(viewportWidth)
      ? viewportWidth
      : 1440;

  if (width < 768) {
    return "mobile";
  }

  if (width < 1100) {
    return "tablet";
  }

  if (width < 1360) {
    return "compact-desktop";
  }

  return "wide-desktop";
}

/** 根据响应式模式和面板方向，决定面板应以停靠、抽屉还是全屏展示。 */
export function resolveWorkspacePanePresentation(
  mode: WorkspaceAdaptiveMode,
  pane: "left" | "right"
): WorkspacePanePresentation {
  if (mode === "mobile") {
    return "fullscreen";
  }

  if (mode === "tablet") {
    return "drawer";
  }

  if (mode === "compact-desktop") {
    return pane === "right" ? "docked" : "drawer";
  }

  return "docked";
}

/** 综合断点和面板开闭状态，计算主工作台当前的舞台布局。 */
export function resolveWorkspaceStageLayout(
  options: ResolveWorkspaceStageLayoutOptions
): ResolvedWorkspaceStageLayout {
  const hasVisibleDockedLeftPane =
    options.leftPanePresentation === "docked" && options.leftPaneOpen;
  const hasVisibleDockedRightPane =
    options.rightPanePresentation === "docked" && options.rightPaneOpen;

  if (options.adaptiveMode === "tablet" || options.adaptiveMode === "mobile") {
    return {
      stageLayout: "solo",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: false
    };
  }

  if (hasVisibleDockedLeftPane && hasVisibleDockedRightPane) {
    return {
      stageLayout: "dual-docked",
      hasVisibleDockedLeftPane,
      hasVisibleDockedRightPane
    };
  }

  if (hasVisibleDockedLeftPane) {
    return {
      stageLayout: "left-docked",
      hasVisibleDockedLeftPane,
      hasVisibleDockedRightPane
    };
  }

  if (hasVisibleDockedRightPane) {
    return {
      stageLayout: "right-docked",
      hasVisibleDockedLeftPane,
      hasVisibleDockedRightPane
    };
  }

  return {
    stageLayout: "solo",
    hasVisibleDockedLeftPane,
    hasVisibleDockedRightPane
  };
}
