import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, "../dist");
const browserDirectory = path.resolve(distDirectory, "browser");

/**
 * 构建前先整体清理 `dist/`，避免历史声明文件和旧 browser 产物残留。
 * 这样像 `demo-graph.d.ts`、`browser.js` 这类过时文件不会继续混进模板包。
 */
async function ensureBrowserDirectory() {
  await rm(distDirectory, { recursive: true, force: true });
  await mkdir(distDirectory, { recursive: true });
  await mkdir(browserDirectory, { recursive: true });
}

await ensureBrowserDirectory();
