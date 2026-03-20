import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

type BrowserBundleMode = "demo" | "demo-alt" | "node" | "widget";

const templateRoot = fileURLToPath(new URL("./", import.meta.url));

/** browser IIFE bundle 的固定输出配置。 */
const browserBundleEntries: Readonly<
  Record<
    BrowserBundleMode,
    {
      entry: string;
      fileName: string;
      name: string;
    }
  >
> = {
  demo: {
    entry: "src/browser/demo_bundle.ts",
    fileName: "demo.iife.js",
    name: "TemplateDemoBundle"
  },
  "demo-alt": {
    entry: "src/browser/demo_alt_bundle.ts",
    fileName: "demo-alt.iife.js",
    name: "TemplateAlternateDemoBundle"
  },
  node: {
    entry: "src/browser/node_bundle.ts",
    fileName: "node.iife.js",
    name: "TemplateNodeBundle"
  },
  widget: {
    entry: "src/browser/widget_bundle.ts",
    fileName: "widget.iife.js",
    name: "TemplateWidgetBundle"
  }
} as const;

/** 判断当前 mode 是否为合法 browser bundle。 */
function isBrowserBundleMode(value: string): value is BrowserBundleMode {
  return (
    value === "demo" ||
    value === "demo-alt" ||
    value === "node" ||
    value === "widget"
  );
}

export default defineConfig(({ mode }) => {
  if (!isBrowserBundleMode(mode)) {
    throw new Error(
      `未知的 browser bundle 模式：${mode}。请使用 demo、demo-alt、node 或 widget。`
    );
  }

  const bundle = browserBundleEntries[mode];

  return {
    root: templateRoot,
    build: {
      outDir: "dist/browser",
      emptyOutDir: mode === "demo",
      sourcemap: true,
      lib: {
        entry: bundle.entry,
        name: bundle.name,
        formats: ["iife"],
        fileName: () => bundle.fileName
      },
      rollupOptions: {
        external: ["leafergraph"],
        output: {
          globals: {
            leafergraph: "LeaferGraphRuntime"
          }
        }
      }
    }
  };
});
