import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const githubPagesBase = process.env.GITHUB_PAGES_BASE;
const githubPagesOutDir = process.env.GITHUB_PAGES_OUT_DIR;

export default defineConfig({
  base: githubPagesBase ?? "/",
  plugins: [preact()],
  build: {
    outDir: githubPagesOutDir
      ? resolve(__dirname, "dist", githubPagesOutDir)
      : resolve(__dirname, "dist")
  },
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
        replacement: resolve(__dirname, "../../packages/context-menu/src/index.ts")
      },
      {
        find: /^@leafergraph\/context-menu-builtins$/,
        replacement: resolve(
          __dirname,
          "../../packages/context-menu-builtins/src/index.ts"
        )
      },
      {
        find: /^@leafergraph\/undo-redo$/,
        replacement: resolve(__dirname, "../../packages/undo-redo/src/index.ts")
      },
      {
        find: /^@leafergraph\/undo-redo\/graph$/,
        replacement: resolve(
          __dirname,
          "../../packages/undo-redo/src/graph/index.ts"
        )
      },
      {
        find: /^@leafergraph\/theme$/,
        replacement: resolve(__dirname, "../../packages/theme/src/index.ts")
      }
    ]
  }
});
