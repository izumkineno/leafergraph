import { resolve } from "node:path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

const githubPagesBase = process.env.GITHUB_PAGES_BASE;

// 规范化 base 路径，防止 Git Bash 路径转换问题
function normalizeBase(base: string | undefined): string {
  if (!base || base === "/") {
    console.log("[vite] Using default base: /");
    return "/";
  }

  // 移除可能的 Windows 路径前缀（防御性编程）
  let normalized = base
    .replace(/^\/[A-Z]:[\/\\]/, "/")  // 移除 /C:/ 等
    .replace(/^\/Program Files\/Git/, "")  // 移除 Git Bash 前缀
    .replace(/\\/g, "/");  // 统一使用正斜杠

  // 确保以 / 开头和结尾
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  if (!normalized.endsWith("/")) {
    normalized = normalized + "/";
  }

  console.log(`[vite] Base path: ${normalized}`);

  // 验证路径格式
  if (!/^\/[\w\-\/]+\/$/.test(normalized)) {
    console.warn(`[vite] Warning: Base path format may be incorrect: ${normalized}`);
  }

  return normalized;
}

export default defineConfig({
  base: normalizeBase(githubPagesBase),
  plugins: [preact()],
  resolve: {
    alias: [
      {
        find: /^@leafergraph\/basic-kit$/,
        replacement: resolve(__dirname, "../../packages/core/basic-kit/src/index.ts")
      },
      {
        find: /^@leafergraph\/core\/contracts$/,
        replacement: resolve(__dirname, "../../packages/core/contracts/src/index.ts")
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
        replacement: resolve(__dirname, "../../packages/core/theme/src/index.ts")
      }
    ]
  }
});
