import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeLeaferContextMenuConfig,
  normalizeLeaferGraphConfig,
  resolveDefaultLeaferContextMenuConfig,
  resolveDefaultLeaferGraphConfig
} from "../src";

function listFilesRecursively(rootPath: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

describe("@leafergraph/core/config", () => {
  test("默认主包配置应返回完整可消费结构", () => {
    expect(resolveDefaultLeaferGraphConfig()).toEqual({
      graph: {
        fill: undefined,
        view: {
          defaultFitPadding: 64
        },
        runtime: {
          linkPropagationAnimation: "performance",
          respectReducedMotion: true
        },
        history: {
          maxEntries: 100,
          resetOnDocumentSync: true
        }
      },
      widget: {
        editing: {
          enabled: true,
          useOfficialTextEditor: true,
          allowOptionsMenu: true
        }
      },
      leafer: {
        app: {
          pixelSnap: true,
          usePartRender: true,
          usePartLayout: true
        },
        tree: {},
        viewport: {
          zoom: {
            min: 0.2,
            max: 4
          },
          move: {
            holdSpaceKey: true,
            holdMiddleKey: true,
            scroll: true
          }
        },
        view: {
          fitPadding: 64
        },
        editor: {},
        textEditor: {
          useOfficialTextEditor: true
        }
      }
    });
  });

  test("normalizeLeaferGraphConfig 会把 nested config 补齐并同步桥接字段", () => {
    const config = normalizeLeaferGraphConfig({
      graph: {
        fill: "#101828",
        view: {
          defaultFitPadding: 96
        },
        runtime: {
          linkPropagationAnimation: false,
          respectReducedMotion: false
        },
        history: {
          maxEntries: 24,
          resetOnDocumentSync: false
        }
      },
      widget: {
        editing: {
          enabled: true,
          allowOptionsMenu: false
        }
      },
      leafer: {
        app: {
          pixelSnap: false
        },
        viewport: {
          zoom: {
            min: 0.5
          },
          move: {
            scroll: "x"
          }
        }
      }
    });

    expect(config.graph.fill).toBe("#101828");
    expect(config.graph.view.defaultFitPadding).toBe(96);
    expect(config.graph.runtime.linkPropagationAnimation).toBe(false);
    expect(config.graph.runtime.respectReducedMotion).toBe(false);
    expect(config.graph.history.maxEntries).toBe(24);
    expect(config.graph.history.resetOnDocumentSync).toBe(false);
    expect(config.widget.editing.enabled).toBe(true);
    expect(config.widget.editing.allowOptionsMenu).toBe(false);
    expect(config.widget.editing.useOfficialTextEditor).toBe(true);
    expect(config.leafer.app.pixelSnap).toBe(false);
    expect(config.leafer.viewport.zoom.min).toBe(0.5);
    expect(config.leafer.viewport.zoom.max).toBe(4);
    expect(config.leafer.viewport.move.scroll).toBe("x");
    expect(config.leafer.view.fitPadding).toBe(96);
    expect(config.leafer.textEditor.useOfficialTextEditor).toBe(true);
  });

  test("history 默认值应做最小归一化", () => {
    expect(
      normalizeLeaferGraphConfig({
        graph: {
          history: {
            maxEntries: -4
          }
        }
      }).graph.history
    ).toEqual({
      maxEntries: 0,
      resetOnDocumentSync: true
    });
  });

  test("默认右键菜单配置应保持既有行为", () => {
    expect(resolveDefaultLeaferContextMenuConfig()).toEqual({
      submenu: {
        triggerMode: "hover+click",
        openDelay: 0,
        closeDelay: 100
      }
    });
  });

  test("normalizeLeaferContextMenuConfig 会补齐 submenu 默认值", () => {
    expect(
      normalizeLeaferContextMenuConfig({
        submenu: {
          triggerMode: "hover"
        }
      })
    ).toEqual({
      submenu: {
        triggerMode: "hover",
        openDelay: 0,
        closeDelay: 100
      }
    });
  });

  test("widget README 声明的 editing.enabled 默认值应与实现一致", () => {
    const readme = readFileSync(
      new URL("../src/widget/README.md", import.meta.url),
      "utf8"
    );
    const config = resolveDefaultLeaferGraphConfig();

    expect(readme).toContain("`editing.enabled` 被设置为 `false`");
    expect(config.widget.editing.enabled).toBe(false);
  });

  test("不应声明任何 workspace 本地包依赖", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {})
    ];

    expect(
      dependencyNames.filter((name) => name.startsWith("@leafergraph/"))
    ).toEqual([]);
  });

  test("源码不应 import 任何 workspace 本地包", () => {
    const srcRootPath = fileURLToPath(new URL("../src/", import.meta.url));
    const sourceFiles = listFilesRecursively(srcRootPath).filter((filePath) =>
      filePath.endsWith(".ts")
    );

    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, "utf8");
      expect(content).not.toMatch(/from\s+["']@leafergraph\//);
    }
  });
});
