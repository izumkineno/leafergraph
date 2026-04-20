import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: packageRoot,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index"
    },
    rollupOptions: {
      external: [
        "@leafergraph/authoring",
        "@leafergraph/execution",
        "@leafergraph/node",
        "leafergraph"
      ]
    }
  }
});
