export type WorkspaceAdaptiveMode =
  | "wide-desktop"
  | "compact-desktop"
  | "tablet"
  | "mobile";

export type WorkspacePanePresentation = "docked" | "drawer" | "fullscreen";
export type WorkspaceStageLayout =
  | "solo"
  | "left-docked"
  | "right-docked"
  | "dual-docked";

export interface ResolveWorkspaceStageLayoutOptions {
  adaptiveMode: WorkspaceAdaptiveMode;
  leftPanePresentation: WorkspacePanePresentation;
  rightPanePresentation: WorkspacePanePresentation;
  leftPaneOpen: boolean;
  rightPaneOpen: boolean;
}

export interface ResolvedWorkspaceStageLayout {
  stageLayout: WorkspaceStageLayout;
  hasVisibleDockedLeftPane: boolean;
  hasVisibleDockedRightPane: boolean;
}

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
