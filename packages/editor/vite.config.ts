import { resolve } from "node:path";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      leafergraph: resolve(__dirname, "../leafergraph/src/index.ts")
    }
  },
  server: {
    port: 5501
  }
});
