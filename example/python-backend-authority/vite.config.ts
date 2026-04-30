import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const githubPagesBase = process.env.GITHUB_PAGES_BASE;

function normalizeBase(base: string | undefined): string {
  if (!base || base === "/") {
    return "/";
  }

  let normalized = base
    .replace(/^\/[A-Z]:[\/\\]/, "/")
    .replace(/^\/Program Files\/Git/, "")
    .replace(/\\/g, "/");

  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  if (!normalized.endsWith("/")) {
    normalized = normalized + "/";
  }

  return normalized;
}

export default defineConfig({
  base: normalizeBase(githubPagesBase),
  plugins: [preact()],
  resolve: {
    alias: [
      {
        find: /^@leafergraph\/core\/basic-kit$/,
        replacement: resolve(__dirname, "../../packages/core/basic-kit/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/config$/,
        replacement: resolve(__dirname, "../../packages/core/config/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/contracts$/,
        replacement: resolve(__dirname, "../../packages/core/contracts/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/execution$/,
        replacement: resolve(__dirname, "../../packages/core/execution/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/node$/,
        replacement: resolve(__dirname, "../../packages/core/node/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/theme$/,
        replacement: resolve(__dirname, "../../packages/core/theme/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/widget-runtime$/,
        replacement: resolve(__dirname, "../../packages/core/widget-runtime/src/index.ts")
      },
      {
        find: /^leafergraph$/,
        replacement: resolve(__dirname, "../../packages/leafergraph/src/index.ts")
      }
    ]
  }
});
