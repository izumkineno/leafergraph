import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "LeaferGraph",
      fileName: "index",
      formats: ["es"]
    },
    rollupOptions: {
      external: ["leafer-ui"]
    },
    sourcemap: true
  }
});
