import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

type BrowserBundleMode = "demo" | "node" | "widget";

const templateRoot = fileURLToPath(new URL("./", import.meta.url));

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
    name: "AuthoringBrowserTemplateDemoBundle"
  },
  node: {
    entry: "src/browser/node_bundle.ts",
    fileName: "node.iife.js",
    name: "AuthoringBrowserTemplateNodeBundle"
  },
  widget: {
    entry: "src/browser/widget_bundle.ts",
    fileName: "widget.iife.js",
    name: "AuthoringBrowserTemplateWidgetBundle"
  }
} as const;

function isBrowserBundleMode(value: string): value is BrowserBundleMode {
  return value === "demo" || value === "node" || value === "widget";
}

export default defineConfig(({ mode }) => {
  if (!isBrowserBundleMode(mode)) {
    throw new Error(
      `未知的 browser bundle 模式：${mode}。请使用 demo、node 或 widget。`
    );
  }

  const bundle = browserBundleEntries[mode];

  return {
    root: templateRoot,
    build: {
      outDir: "dist/browser",
      emptyOutDir: mode === "widget",
      sourcemap: true,
      lib: {
        entry: bundle.entry,
        name: bundle.name,
        formats: ["iife"],
        fileName: () => bundle.fileName
      },
      rollupOptions: {
        external: ["@leafergraph/authoring", "leafergraph"],
        output: {
          globals: {
            "@leafergraph/authoring": "LeaferGraphAuthoring",
            leafergraph: "LeaferGraphRuntime"
          }
        }
      }
    }
  };
});
