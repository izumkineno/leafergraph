import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: root,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index"
    },
    rollupOptions: {
      external: [
        "@leafergraph/authoring",
        "@leafergraph/node",
        "leafer-ui",
        "leafergraph"
      ]
    }
  }
});