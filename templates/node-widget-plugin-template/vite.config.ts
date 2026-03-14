import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const templateRoot = fileURLToPath(new URL("./", import.meta.url));

/**
 * 模板包的构建目标是“只输出自己”，不把宿主 SDK 一起打包进去。
 *
 * 这里显式 external 掉三类依赖：
 * 1. `leafergraph`
 *    宿主主包，运行时由真正的宿主项目提供
 * 2. `@leafergraph/node`
 *    节点定义和类型协议包，避免在外部插件里复制一份
 * 3. `leafer-ui`
 *    这里只在类型层使用；真正绘制仍应走宿主注入的 `ctx.ui`
 */
export default defineConfig({
  root: templateRoot,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index"
    },
    rollupOptions: {
      external: ["leafergraph", "@leafergraph/node", "leafer-ui"]
    }
  }
});
