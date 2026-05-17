import { afterEach, describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";
import {
  resolveDefaultContextMenuTheme,
  resolveDefaultGraphTheme,
  resolveDefaultWidgetTheme,
  registerThemePreset,
  unregisterThemePreset
} from "@leafergraph/core/theme";

import { createTestHarness } from "./test_harness";

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "link-theme-doc",
    revision: 1,
    appKind: "link-theme-test",
    nodes: [],
    links: []
  };
}

afterEach(() => {
  unregisterThemePreset("link-theme-runtime-test");
});

describe("link_theme_runtime_integration", () => {
  test("切换 theme mode 后应刷新连线与流动画高亮颜色", () => {
    const harness = createTestHarness({
      document: createEmptyDocument(),
      themeMode: "light"
    });
    const lightGraphTheme = {
      ...resolveDefaultGraphTheme("light"),
      linkStroke: "#ff4d4f"
    };
    const darkGraphTheme = {
      ...resolveDefaultGraphTheme("dark"),
      linkStroke: "#22c55e"
    };

    registerThemePreset(
      {
        id: "link-theme-runtime-test",
        label: "Link Theme Runtime Test",
        modes: {
          light: {
            widget: resolveDefaultWidgetTheme("light"),
            graph: lightGraphTheme,
            contextMenu: resolveDefaultContextMenuTheme("light")
          },
          dark: {
            widget: resolveDefaultWidgetTheme("dark"),
            graph: darkGraphTheme,
            contextMenu: resolveDefaultContextMenuTheme("dark")
          }
        }
      },
      { overwrite: true }
    );

    try {
      harness.runtime.themeHost.setThemeMode("light");
      harness.host.createNode({ id: "source-node", type: "test/source", x: 0, y: 0 });
      harness.host.createNode({ id: "target-node", type: "test/target", x: 320, y: 0 });
      const link = harness.host.createLink({
        source: { nodeId: "source-node", slot: 0 },
        target: { nodeId: "target-node", slot: 0 }
      });

      const linkView = harness.state.linkViews.find((item) => item.linkId === link.id)?.view;
      expect(linkView?.stroke).toBe("#ff4d4f");

      harness.runtime.themeHost.setThemeMode("dark");

      expect(linkView?.stroke).toBe("#22c55e");

      const overlayGroup = harness.state.linkLayerChildren.find(
        (child) => child.name === "graph-link-data-flow-overlay"
      );
      const resolvePulseStroke = () =>
        overlayGroup?.children?.find((child) =>
          child.name?.startsWith("graph-link-data-flow-pulse-")
        )?.stroke;

      const lightPulseStroke = resolvePulseStroke();
      expect(lightPulseStroke).toBe("#22c55e");
      expect(lightPulseStroke).not.toBe("#ff4d4f");

      harness.runtime.themeHost.setThemeMode("light");
      expect(linkView?.stroke).toBe("#ff4d4f");
      expect(resolvePulseStroke()).toBe("#ff4d4f");
      expect(resolvePulseStroke()).not.toBe(lightPulseStroke);
    } finally {
      void harness;
    }
  });
});
