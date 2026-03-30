import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@leafergraph/basic-kit": resolve(
        __dirname,
        "../../packages/basic-kit/src/index.ts"
      ),
      "@leafergraph/context-menu": resolve(
        __dirname,
        "../../packages/context-menu/src/index.ts"
      )
    }
  }
});
