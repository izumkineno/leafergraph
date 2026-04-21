import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  collectDeclaredWorkspaceDeps,
  collectPackageInfos,
  collectWorkspacePackages,
  extractWorkspaceSpecifiers,
  getPackageRule
} from "./workspace_boundaries.shared.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const rootPackageJson = readJson(path.join(repoRoot, "package.json"));
const errors = [];
const requiredWorkspaceGlobs = ["packages/core/*", "packages/extensions/*"];

const formalPackages = collectPackageInfos(path.join(repoRoot, "packages"), repoRoot);
const workspacePackages = collectWorkspacePackages(repoRoot, rootPackageJson.workspaces ?? []);

checkRequiredWorkspaceGlobs(rootPackageJson.workspaces ?? []);

for (const packageInfo of formalPackages.values()) {
  checkPackageRule(packageInfo, workspacePackages);
  checkSourceImports(packageInfo, workspacePackages);
}

checkRootScripts(workspacePackages);

if (errors.length) {
  console.error(
    ["workspace 边界检查失败：", ...errors.map((error) => `- ${error}`)].join("\n")
  );
  process.exit(1);
}

console.log("workspace 边界检查通过");

function checkPackageRule(packageInfo, workspacePackageInfos) {
  const rule = getPackageRule(packageInfo.name);
  if (!rule) {
    errors.push(`缺少正式包边界规则: ${packageInfo.name}`);
    return;
  }

  const declaredWorkspaceDeps = collectDeclaredWorkspaceDeps(packageInfo.packageJson).filter(
    (dependencyName) => workspacePackageInfos.has(dependencyName)
  );
  const invalidDeps = declaredWorkspaceDeps.filter(
    (dependencyName) => !rule.allowedWorkspaceDeps.includes(dependencyName)
  );

  if (invalidDeps.length) {
    errors.push(
      `${packageInfo.relativePath} 声明了未允许的 workspace 依赖: ${invalidDeps.join(", ")}`
    );
  }
}

function checkSourceImports(packageInfo, workspacePackageInfos) {
  const rule = getPackageRule(packageInfo.name);
  if (!rule) {
    return;
  }

  const srcPath = path.join(packageInfo.directoryPath, "src");
  if (!existsSync(srcPath)) {
    return;
  }

  const allowedImports = new Set(rule.allowedSourceImports);

  for (const filePath of walkFiles(srcPath)) {
    if (!/\.(?:[cm]?[jt]sx?)$/i.test(filePath)) {
      continue;
    }

    const source = readFileSync(filePath, "utf8");
    for (const specifier of extractWorkspaceSpecifiers(source)) {
      if (!workspacePackageInfos.has(specifier)) {
        continue;
      }

      if (!allowedImports.has(specifier)) {
        const relativeFilePath = path.relative(repoRoot, filePath).replaceAll("\\", "/");
        errors.push(`${relativeFilePath} 导入了未允许的 workspace 包: ${specifier}`);
      }
    }
  }
}

function checkRequiredWorkspaceGlobs(workspaces) {
  const missingWorkspaces = requiredWorkspaceGlobs.filter(
    (workspace) => !workspaces.includes(workspace)
  );

  for (const workspace of missingWorkspaces) {
    errors.push(`package.json 缺少 package split 必需 workspace: ${workspace}`);
  }
}

function checkRootScripts(workspacePackageInfos) {
  const rootScripts = rootPackageJson.scripts ?? {};
  const filterPattern = /bun\s+run\s+--filter\s+([^\s]+)\s+([A-Za-z0-9:_-]+)/g;

  for (const [scriptName, command] of Object.entries(rootScripts)) {
    for (const match of command.matchAll(filterPattern)) {
      const packageName = match[1];
      const targetScriptName = match[2];
      const workspacePackage = workspacePackageInfos.get(packageName);

      if (!workspacePackage) {
        errors.push(
          `root script ${scriptName} 指向了不存在的 workspace 包: ${packageName}`
        );
        continue;
      }

      if (!workspacePackage.scripts[targetScriptName]) {
        errors.push(
          `root script ${scriptName} 调用了 ${packageName} 中不存在的脚本: ${targetScriptName}`
        );
      }
    }
  }
}

function walkFiles(directoryPath) {
  const filePaths = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...walkFiles(absolutePath));
      continue;
    }

    if (entry.isFile()) {
      filePaths.push(absolutePath);
    }
  }

  return filePaths;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
