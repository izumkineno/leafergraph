import { mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, "../dist");
const browserDirectory = path.resolve(distDirectory, "browser");

/**
 * 旧构建里曾经把 `dist/browser` 产成单个文件。
 * 新方案需要把它固定成目录，因此构建前先做一次幂等清理。
 */
async function ensureBrowserDirectory() {
  await mkdir(distDirectory, { recursive: true });

  try {
    const current = await stat(browserDirectory);
    if (!current.isDirectory()) {
      await rm(browserDirectory, { force: true });
    }
  } catch {
    // 目录不存在时直接创建即可。
  }

  await mkdir(browserDirectory, { recursive: true });
}

await ensureBrowserDirectory();
