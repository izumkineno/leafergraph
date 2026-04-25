import { resolve } from "node:path";

import { defineConfig } from "vite";

import { createLeafergraphAliases } from "../../vite.config.base";

const githubPagesBase = process.env.GITHUB_PAGES_BASE;

function normalizeBase(base: string | undefined): string {
  if (!base || base === "/") {
    return "/";
  }

  let normalized = base.replace(/^\/[A-Z]:[\/\\]/, "/").replace(/\\/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }
  return normalized;
}

export default defineConfig({
  base: normalizeBase(githubPagesBase),
  resolve: {
    alias: [
      {
        find: /^@mini-graph-diagnostic$/,
        replacement: resolve(__dirname, "../mini-graph/src/graph/diagnostic_controller.ts")
      },
      ...createLeafergraphAliases(resolve(__dirname, "../.."))
    ]
  }
});
