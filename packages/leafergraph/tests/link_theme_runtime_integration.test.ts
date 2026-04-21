import { afterEach, describe, expect, test } from "bun:test";

import type { GraphDocument } from "@leafergraph/core/node";
import {
  registerThemePreset,
  unregisterThemePreset
} from "@leafergraph/theme";
import { resolveDefaultContextMenuTheme } from "@leafergraph/theme/context-menu";
import { resolveDefaultGraphTheme } from "@leafergraph/theme/graph";
import { resolveDefaultWidgetTheme } from "@leafergraph/theme/widget";
import { createLeaferGraph } from "../src";

function createEmptyDocument(): GraphDocument {
  return {
    documentId: "link-theme-doc",
    revision: 1,
    appKind: "link-theme-test",
    nodes: [],
    links: []
  };
}

function createContainer(): HTMLDivElement {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", {
    configurable: true,
    value: 1200
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: 800
  });
  container.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      width: 1200,
      height: 800,
      toJSON() {
        return this;
      }
    }) as DOMRect;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  unregisterThemePreset("link-theme-runtime-test");
});

describe("link_theme_runtime_integration", () => {
  test("切换 theme mode 后应刷新连线与流动画高亮颜色", async () => {
    const container = createContainer();
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

    const graph = createLeaferGraph(container, {
      document: createEmptyDocument(),
      themePreset: "link-theme-runtime-test",
      themeMode: "light"
    });

    await graph.ready;

    graph.registerNode(
      {
        type: "test/source",
        title: "Source",
        outputs: [{ name: "out" }],
        onExecute(_node, _context, api) {
          api?.setOutputData(0, "payload");
        }
      },
      { overwrite: true }
    );
    graph.registerNode(
      {
        type: "test/target",
        title: "Target",
        inputs: [{ name: "in" }]
      },
      { overwrite: true }
    );

    graph.createNode({ id: "source-node", type: "test/source", x: 0, y: 0 });
    graph.createNode({ id: "target-node", type: "test/target", x: 320, y: 0 });
    const link = graph.createLink({
      source: { nodeId: "source-node", slot: 0 },
      target: { nodeId: "target-node", slot: 0 }
    });

    const linkView = graph.getLinkView(link.id) as { stroke?: string } | undefined;
    expect(linkView?.stroke).toBe("#ff4d4f");

    graph.playFromNode("source-node");

    const overlayGroup = graph.linkLayer.children?.find(
      (child) => child.name === "graph-link-data-flow-overlay"
    ) as { children?: Array<{ name?: string; stroke?: string }> } | undefined;
    const resolvePulseStroke = () =>
      overlayGroup?.children?.find((child) =>
        child.name?.startsWith("graph-link-data-flow-pulse-")
      )?.stroke;

    const lightPulseStroke = resolvePulseStroke();
    expect(lightPulseStroke).toBeDefined();
    expect(lightPulseStroke).not.toBe("#ff4d4f");

    graph.setThemeMode("dark");

    expect(linkView?.stroke).toBe("#22c55e");

    graph.playFromNode("source-node");
    const darkPulseStroke = resolvePulseStroke();
    expect(darkPulseStroke).toBeDefined();
    expect(darkPulseStroke).not.toBe("#22c55e");
    expect(darkPulseStroke).not.toBe(lightPulseStroke);

    graph.destroy();
    container.remove();
  });
});
