import { describe, expect, test } from "bun:test";

import { resolveDefaultNodeShellRenderTheme, NODE_SHELL_LAYOUT_METRICS } from "@leafergraph/theme/graph";
import { createNodeShell } from "../src/node/shell/view";
import { resolveNodeCategoryBadgeLayout } from "../src/node/shell/layout";
import type { NodeShellLayout } from "../src/node/shell/layout";

function createShellLayout(width: number, height: number): NodeShellLayout {
  return {
    width,
    height,
    collapsed: false,
    slotCount: 0,
    slotStartY: 0,
    slotsHeight: 0,
    widgetTop: NODE_SHELL_LAYOUT_METRICS.headerHeight,
    widgetSectionHeight: 0,
    hasWidgets: false,
    widgetBounds: {
      x: NODE_SHELL_LAYOUT_METRICS.sectionPaddingX,
      y: NODE_SHELL_LAYOUT_METRICS.headerHeight,
      width: width - NODE_SHELL_LAYOUT_METRICS.sectionPaddingX * 2,
      height: Math.max(0, height - NODE_SHELL_LAYOUT_METRICS.headerHeight)
    },
    widgetGap: NODE_SHELL_LAYOUT_METRICS.widgetGap,
    widgetPaddingY: NODE_SHELL_LAYOUT_METRICS.widgetPaddingY,
    inputs: [],
    outputs: [],
    ports: [],
    widgets: []
  };
}

describe("createNodeShell", () => {
  test("节点标题会在分类徽标前按宽度省略", () => {
    const theme = resolveDefaultNodeShellRenderTheme("light");
    const shellLayout = createShellLayout(288, 184);
    const categoryLayout = resolveNodeCategoryBadgeLayout(
      "source",
      shellLayout.width,
      NODE_SHELL_LAYOUT_METRICS
    );

    const shell = createNodeShell({
      nodeId: "node-1",
      x: 0,
      y: 0,
      title: "A very long node title that should be truncated",
      signalColor: "#f59e0b",
      selectedStroke: "#2563eb",
      shellLayout,
      categoryLayout,
      theme
    });

    expect(shell.titleLabel.width).toBe(categoryLayout.x - theme.titleX - 12);
    expect(shell.titleLabel.textWrap).toBe("none");
    expect(shell.titleLabel.textOverflow).toBe("...");
  });

  test("长任务进度环会在选中环外侧展开，并按进度显示 dash", () => {
    const theme = resolveDefaultNodeShellRenderTheme("light");
    const shellLayout = createShellLayout(288, 184);
    const categoryLayout = resolveNodeCategoryBadgeLayout(
      "source",
      shellLayout.width,
      NODE_SHELL_LAYOUT_METRICS
    );

    const shell = createNodeShell({
      nodeId: "node-2",
      x: 0,
      y: 0,
      title: "Long task",
      signalColor: "#f59e0b",
      selectedStroke: "#2563eb",
      progressRingState: {
        visible: true,
        mode: "determinate",
        progress: 0.4
      },
      shellLayout,
      categoryLayout,
      theme
    });

    expect(shell.progressTrack.visible).toBe(true);
    expect(shell.progressRing.visible).toBe(true);
    expect(shell.progressRing.x).toBeLessThan(shell.selectedRing.x);
    expect(shell.progressRing.width).toBeGreaterThan(shell.selectedRing.width);
    expect(shell.progressRing.dashPattern).toEqual(
      expect.arrayContaining([expect.any(Number), expect.any(Number)])
    );
  });
});
