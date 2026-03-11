import { fileURLToPath, URL } from "node:url";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const leafergraphEntry = fileURLToPath(
  new URL("../leafergraph/src/index.ts", import.meta.url)
);

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      leafergraph: leafergraphEntry
    }
  },
  server: {
    port: 5501
  }
});
