import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const errors = [];

const compatibilityFiles = [
  "packages/leafergraph/src/api/plugin.ts",
  "packages/leafergraph/src/api/graph_api_types.ts",
  "packages/leafergraph/src/api/graph_document_diff.ts",
  "packages/leafergraph/src/graph_document_diff.ts"
];

for (const relativePath of compatibilityFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (existsSync(absolutePath)) {
    errors.push(`仍存在兼容壳文件: ${relativePath}`);
  }
}

const leaferGraphPackageJsonPath = path.join(
  repoRoot,
  "packages/leafergraph/package.json"
);
const leaferGraphPackageJson = JSON.parse(
  readFileSync(leaferGraphPackageJsonPath, "utf8")
);
if (leaferGraphPackageJson.exports?.["./graph-document-diff"]) {
  errors.push("packages/leafergraph/package.json 仍导出 ./graph-document-diff");
}

const apiDir = path.join(repoRoot, "packages/leafergraph/src/api");
if (existsSync(apiDir)) {
  const apiEntries = readdirSync(apiDir).filter((entry) => entry.endsWith(".ts"));
  if (apiEntries.length !== 1 || apiEntries[0] !== "graph_api_host.ts") {
    errors.push(
      `packages/leafergraph/src/api 只应保留 graph_api_host.ts，当前为: ${apiEntries.join(
        ", "
      )}`
    );
  }
}

const leaferGraphIndexPath = path.join(repoRoot, "packages/leafergraph/src/index.ts");
const leaferGraphIndexSource = readFileSync(leaferGraphIndexPath, "utf8");
const rootReexportPattern =
  /^\s*export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+["'](?:@leafergraph\/|leafer-ui)/gm;
if (rootReexportPattern.test(leaferGraphIndexSource)) {
  errors.push("packages/leafergraph/src/index.ts 仍存在真源包聚合 re-export");
}

const allowedRootImports = new Set(["createLeaferGraph", "LeaferGraph"]);
const scanRoots = ["example", "templates", "packages"];
const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".md"
]);
const ignoredDirectories = new Set(["dist", "node_modules", ".git"]);
const importPattern = /import\s+([^;]+?)\s+from\s+["']leafergraph["'];/gm;

for (const scanRoot of scanRoots) {
  scanDirectory(path.join(repoRoot, scanRoot));
}

if (errors.length) {
  console.error(
    [
      "runtime-only root 边界检查失败：",
      ...errors.map((error) => `- ${error}`)
    ].join("\n")
  );
  process.exit(1);
}

console.log("runtime-only root 边界检查通过");

function scanDirectory(directoryPath) {
  if (!existsSync(directoryPath)) {
    return;
  }

  for (const entry of readdirSync(directoryPath)) {
    const absolutePath = path.join(directoryPath, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        scanDirectory(absolutePath);
      }
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry))) {
      continue;
    }

    scanFile(absolutePath);
  }
}

function scanFile(absolutePath) {
  const relativePath = path.relative(repoRoot, absolutePath).replaceAll("\\", "/");
  const source = readFileSync(absolutePath, "utf8");

  if (source.includes("leafergraph/graph-document-diff")) {
    errors.push(`${relativePath} 仍引用 leafergraph/graph-document-diff`);
  }

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    const normalizedSpecifier = specifier.replace(/\s+/g, " ").trim();

    if (!normalizedSpecifier.includes("{") || !normalizedSpecifier.includes("}")) {
      errors.push(`${relativePath} 使用了不受支持的 leafergraph 导入形式: ${normalizedSpecifier}`);
      continue;
    }

    const namedImportBlock = normalizedSpecifier.slice(
      normalizedSpecifier.indexOf("{") + 1,
      normalizedSpecifier.lastIndexOf("}")
    );
    const importedNames = namedImportBlock
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim());

    const invalidImports = importedNames.filter(
      (importName) => !allowedRootImports.has(importName)
    );
    if (invalidImports.length) {
      errors.push(
        `${relativePath} 从 leafergraph 导入了非 runtime 真源: ${invalidImports.join(", ")}`
      );
    }
  }
}
