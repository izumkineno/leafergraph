import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: root,
  build: {
    outDir: "dist/browser",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/browser/node_bundle.ts",
      name: "WebCrawlerNodesBundle",
      formats: ["iife"],
      fileName: () => "node.iife.js"
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
});