import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptDirectory, "../dist");
const browserDirectory = path.resolve(distDirectory, "browser");

async function ensureBrowserDirectory() {
  await rm(distDirectory, { recursive: true, force: true });
  await mkdir(distDirectory, { recursive: true });
  await mkdir(browserDirectory, { recursive: true });
}

await ensureBrowserDirectory();