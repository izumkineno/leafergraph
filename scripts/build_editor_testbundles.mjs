import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const scriptsDir = dirname(currentFile);
const workspaceRoot = resolve(scriptsDir, "..");
const templateDir = resolve(
  workspaceRoot,
  "templates",
  "misc",
  "browser-node-widget-plugin-template"
);
const templateBrowserDistDir = resolve(templateDir, "dist", "browser");
const editorTestBundleDir = resolve(
  workspaceRoot,
  "examples",
  "editor",
  "public",
  "__testbundles"
);

const filesToSync = [
  "demo.iife.js",
  "demo.iife.js.map",
  "demo-alt.iife.js",
  "demo-alt.iife.js.map",
  "node.iife.js",
  "node.iife.js.map",
  "widget.iife.js",
  "widget.iife.js.map"
];

function resolveBunCommand() {
  return process.env.BUN_EXE || "bun";
}

function runTemplateBrowserBuild() {
  const result = spawnSync(resolveBunCommand(), ["run", "build:browser"], {
    cwd: templateDir,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function syncEditorTestBundles() {
  mkdirSync(editorTestBundleDir, { recursive: true });

  for (const fileName of filesToSync) {
    const sourcePath = resolve(templateBrowserDistDir, fileName);
    const targetPath = resolve(editorTestBundleDir, fileName);

    if (!existsSync(sourcePath)) {
      throw new Error(`缺少模板浏览器产物：${sourcePath}`);
    }

    copyFileSync(sourcePath, targetPath);
    console.info(`[build:testbundles] 已同步 ${fileName}`);
  }
}

runTemplateBrowserBuild();
syncEditorTestBundles();
