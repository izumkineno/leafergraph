/**
 * 最小图示例 Vite 配置。
 *
 * @remarks
 * 当前使用 Preact 驱动页面层，
 * 但仍保持示例工程本身的最小 dev/build/preview 入口。
 */
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 4175
  },
  preview: {
    port: 4176
  }
});
