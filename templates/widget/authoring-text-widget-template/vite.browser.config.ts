import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const templateRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: templateRoot,
  build: {
    outDir: "dist/browser",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/browser/widget_bundle.ts",
      name: "AuthoringTextWidgetTemplateBundle",
      formats: ["iife"],
      fileName: () => "widget.iife.js"
    },
    rollupOptions: {
      external: ["@leafergraph/extensions/authoring", "leafergraph"],
      output: {
        globals: {
          "@leafergraph/extensions/authoring": "LeaferGraphAuthoring",
          leafergraph: "LeaferGraphRuntime"
        }
      }
    }
  }
});
