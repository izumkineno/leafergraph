import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: "dist/client",
    chunkSizeWarningLimit: 700
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
        find: /^@leafergraph\/contracts\/graph-document-diff$/,
        replacement: resolve(
          __dirname,
          "../../packages/contracts/src/graph_document_diff.ts"
        )
      },
      {
        find: /^@leafergraph\/diff$/,
        replacement: resolve(__dirname, "../../packages/diff/src/index.ts")
      },
      {
        find: /^@leafergraph\/runtime-bridge$/,
        replacement: resolve(__dirname, "../../packages/runtime-bridge/src/index.ts")
      },
      {
        find: /^@leafergraph\/runtime-bridge\/client$/,
        replacement: resolve(
          __dirname,
          "../../packages/runtime-bridge/src/client/index.ts"
        )
      },
      {
        find: /^@leafergraph\/runtime-bridge\/portable$/,
        replacement: resolve(
          __dirname,
          "../../packages/runtime-bridge/src/portable/index.ts"
        )
      },
      {
        find: /^@leafergraph\/runtime-bridge\/transport$/,
        replacement: resolve(
          __dirname,
          "../../packages/runtime-bridge/src/transport/index.ts"
        )
      },
      {
        find: /^leafergraph$/,
        replacement: resolve(__dirname, "../../packages/leafergraph/src/index.ts")
      }
    ]
  }
});
