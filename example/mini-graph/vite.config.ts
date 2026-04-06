import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: [
      {
        find: /^@leafergraph\/basic-kit$/,
        replacement: resolve(__dirname, "../../packages/basic-kit/src/index.ts")
      },
      {
        find: /^@leafergraph\/contracts$/,
        replacement: resolve(__dirname, "../../packages/contracts/src/index.ts")
      },
      {
        find: /^@leafergraph\/context-menu$/,
        replacement: resolve(__dirname, "../../extensions/context-menu/src/index.ts")
      },
      {
        find: /^@leafergraph\/context-menu-builtins$/,
        replacement: resolve(
          __dirname,
          "../../extensions/context-menu-builtins/src/index.ts"
        )
      },
      {
        find: /^@leafergraph\/context-menu-builtins\/editing$/,
        replacement: resolve(
          __dirname,
          "../../extensions/context-menu-builtins/src/editing.ts"
        )
      },
      {
        find: /^@leafergraph\/undo-redo$/,
        replacement: resolve(__dirname, "../../extensions/undo-redo/src/index.ts")
      },
      {
        find: /^@leafergraph\/undo-redo\/graph$/,
        replacement: resolve(
          __dirname,
          "../../extensions/undo-redo/src/graph/index.ts"
        )
      },
      {
        find: /^@leafergraph\/theme$/,
        replacement: resolve(__dirname, "../../packages/theme/src/index.ts")
      }
    ]
  }
});
