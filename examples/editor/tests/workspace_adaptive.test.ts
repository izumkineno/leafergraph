import { describe, expect, test } from "bun:test";

import {
  resolveWorkspaceAdaptiveMode,
  resolveWorkspacePanePresentation,
  resolveWorkspaceStageLayout
} from "../src/shell/layout/workspace_adaptive";

describe("workspace adaptive helpers", () => {
  test("应按断点返回稳定的自适应模式", () => {
    expect(resolveWorkspaceAdaptiveMode(390)).toBe("mobile");
    expect(resolveWorkspaceAdaptiveMode(900)).toBe("tablet");
    expect(resolveWorkspaceAdaptiveMode(1200)).toBe("compact-desktop");
    expect(resolveWorkspaceAdaptiveMode(1440)).toBe("wide-desktop");
  });

  test("应为左右侧栏返回预期的展示形态", () => {
    expect(resolveWorkspacePanePresentation("wide-desktop", "left")).toBe(
      "docked"
    );
    expect(resolveWorkspacePanePresentation("wide-desktop", "right")).toBe(
      "docked"
    );
    expect(resolveWorkspacePanePresentation("compact-desktop", "left")).toBe(
      "drawer"
    );
    expect(resolveWorkspacePanePresentation("compact-desktop", "right")).toBe(
      "docked"
    );
    expect(resolveWorkspacePanePresentation("tablet", "left")).toBe("drawer");
    expect(resolveWorkspacePanePresentation("tablet", "right")).toBe("drawer");
    expect(resolveWorkspacePanePresentation("mobile", "left")).toBe(
      "fullscreen"
    );
    expect(resolveWorkspacePanePresentation("mobile", "right")).toBe(
      "fullscreen"
    );
  });

  test("应只让 docked 且打开的侧栏参与主布局", () => {
    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "wide-desktop",
        leftPanePresentation: "docked",
        rightPanePresentation: "docked",
        leftPaneOpen: true,
        rightPaneOpen: true
      })
    ).toEqual({
      stageLayout: "dual-docked",
      hasVisibleDockedLeftPane: true,
      hasVisibleDockedRightPane: true
    });

    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "wide-desktop",
        leftPanePresentation: "docked",
        rightPanePresentation: "docked",
        leftPaneOpen: false,
        rightPaneOpen: false
      })
    ).toEqual({
      stageLayout: "solo",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: false
    });

    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "wide-desktop",
        leftPanePresentation: "docked",
        rightPanePresentation: "docked",
        leftPaneOpen: false,
        rightPaneOpen: true
      })
    ).toEqual({
      stageLayout: "right-docked",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: true
    });

    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "wide-desktop",
        leftPanePresentation: "docked",
        rightPanePresentation: "docked",
        leftPaneOpen: true,
        rightPaneOpen: false
      })
    ).toEqual({
      stageLayout: "left-docked",
      hasVisibleDockedLeftPane: true,
      hasVisibleDockedRightPane: false
    });
  });

  test("应让 compact-desktop 只按右侧 docked 状态分配主列", () => {
    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "compact-desktop",
        leftPanePresentation: "drawer",
        rightPanePresentation: "docked",
        leftPaneOpen: true,
        rightPaneOpen: true
      })
    ).toEqual({
      stageLayout: "right-docked",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: true
    });

    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "compact-desktop",
        leftPanePresentation: "drawer",
        rightPanePresentation: "docked",
        leftPaneOpen: true,
        rightPaneOpen: false
      })
    ).toEqual({
      stageLayout: "solo",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: false
    });
  });

  test("应忽略 tablet 和 mobile 下的 drawer/fullscreen 侧栏列宽", () => {
    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "tablet",
        leftPanePresentation: "drawer",
        rightPanePresentation: "drawer",
        leftPaneOpen: true,
        rightPaneOpen: true
      })
    ).toEqual({
      stageLayout: "solo",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: false
    });

    expect(
      resolveWorkspaceStageLayout({
        adaptiveMode: "mobile",
        leftPanePresentation: "fullscreen",
        rightPanePresentation: "fullscreen",
        leftPaneOpen: true,
        rightPaneOpen: true
      })
    ).toEqual({
      stageLayout: "solo",
      hasVisibleDockedLeftPane: false,
      hasVisibleDockedRightPane: false
    });
  });
});
