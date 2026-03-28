import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@leafergraph/context-menu": resolve(
        __dirname,
        "../../packages/context-menu/src/index.ts"
      )
    }
  }
});
