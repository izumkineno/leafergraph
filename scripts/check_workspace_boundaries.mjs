import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const rootPackageJson = readJson(path.join(repoRoot, "package.json"));
const errors = [];

const packageRules = {
  "@leafergraph/node": {
    allowedWorkspaceDeps: [],
    allowedSourceImports: []
  },
  "@leafergraph/theme": {
    allowedWorkspaceDeps: [],
    allowedSourceImports: []
  },
  "@leafergraph/config": {
    allowedWorkspaceDeps: [],
    allowedSourceImports: []
  },
  "@leafergraph/execution": {
    allowedWorkspaceDeps: ["@leafergraph/node"],
    allowedSourceImports: ["@leafergraph/node"]
  },
  "@leafergraph/contracts": {
    allowedWorkspaceDeps: [
      "@leafergraph/config",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme"
    ],
    allowedSourceImports: [
      "@leafergraph/config",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme"
    ]
  },
  "@leafergraph/widget-runtime": {
    allowedWorkspaceDeps: [
      "@leafergraph/config",
      "@leafergraph/contracts",
      "@leafergraph/node",
      "@leafergraph/theme"
    ],
    allowedSourceImports: [
      "@leafergraph/config",
      "@leafergraph/contracts",
      "@leafergraph/node",
      "@leafergraph/theme"
    ]
  },
  "@leafergraph/basic-kit": {
    allowedWorkspaceDeps: [
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme",
      "@leafergraph/widget-runtime"
    ],
    allowedSourceImports: [
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme",
      "@leafergraph/widget-runtime"
    ]
  },
  "@leafergraph/context-menu": {
    allowedWorkspaceDeps: ["@leafergraph/config", "@leafergraph/theme"],
    allowedSourceImports: ["@leafergraph/config", "@leafergraph/theme"]
  },
  "@leafergraph/context-menu-builtins": {
    allowedWorkspaceDeps: [
      "@leafergraph/context-menu",
      "@leafergraph/contracts",
      "@leafergraph/node"
    ],
    allowedSourceImports: [
      "@leafergraph/context-menu",
      "@leafergraph/contracts",
      "@leafergraph/node"
    ]
  },
  "@leafergraph/authoring": {
    allowedWorkspaceDeps: [
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme",
      "leafergraph"
    ],
    allowedSourceImports: [
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme"
    ]
  },
  leafergraph: {
    allowedWorkspaceDeps: [
      "@leafergraph/config",
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme",
      "@leafergraph/widget-runtime"
    ],
    allowedSourceImports: [
      "@leafergraph/config",
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "@leafergraph/theme",
      "@leafergraph/widget-runtime"
    ]
  }
};

const formalPackages = collectPackageInfos(path.join(repoRoot, "packages"));
for (const packageInfo of formalPackages.values()) {
  checkPackageRule(packageInfo, formalPackages);
  checkSourceImports(packageInfo, formalPackages);
}

checkRootScripts(collectWorkspacePackages(rootPackageJson.workspaces ?? []));

if (errors.length) {
  console.error(
    ["workspace 边界检查失败：", ...errors.map((error) => `- ${error}`)].join("\n")
  );
  process.exit(1);
}

console.log("workspace 边界检查通过");

function checkPackageRule(packageInfo, workspacePackages) {
  const rule = packageRules[packageInfo.name];
  if (!rule) {
    errors.push(`缺少正式包边界规则: ${packageInfo.name}`);
    return;
  }

  const declaredWorkspaceDeps = collectDeclaredWorkspaceDeps(packageInfo.packageJson).filter(
    (dependencyName) => workspacePackages.has(dependencyName)
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

function checkSourceImports(packageInfo, workspacePackages) {
  const rule = packageRules[packageInfo.name];
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
      if (!workspacePackages.has(specifier)) {
        continue;
      }

      if (!allowedImports.has(specifier)) {
        const relativeFilePath = path
          .relative(repoRoot, filePath)
          .replaceAll("\\", "/");
        errors.push(`${relativeFilePath} 导入了未允许的 workspace 包: ${specifier}`);
      }
    }
  }
}

function checkRootScripts(workspacePackages) {
  const rootScripts = rootPackageJson.scripts ?? {};
  const filterPattern = /bun\s+run\s+--filter\s+([^\s]+)\s+([A-Za-z0-9:_-]+)/g;

  for (const [scriptName, command] of Object.entries(rootScripts)) {
    for (const match of command.matchAll(filterPattern)) {
      const packageName = match[1];
      const targetScriptName = match[2];
      const workspacePackage = workspacePackages.get(packageName);

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

function collectPackageInfos(packagesRoot) {
  const packageInfos = new Map();
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directoryPath = path.join(packagesRoot, entry.name);
    const packageJsonPath = path.join(directoryPath, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = readJson(packageJsonPath);
    packageInfos.set(packageJson.name, {
      name: packageJson.name,
      packageJson,
      directoryPath,
      relativePath: path.relative(repoRoot, directoryPath).replaceAll("\\", "/")
    });
  }

  return packageInfos;
}

function collectWorkspacePackages(workspaces) {
  const packageInfos = new Map();

  for (const workspacePattern of workspaces) {
    const absolutePatternPath = path.join(repoRoot, workspacePattern);

    if (workspacePattern.endsWith("/*")) {
      const parentPath = absolutePatternPath.slice(0, -2);
      if (!existsSync(parentPath)) {
        continue;
      }

      for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const workspacePath = path.join(parentPath, entry.name);
        const packageJsonPath = path.join(workspacePath, "package.json");
        if (!existsSync(packageJsonPath)) {
          continue;
        }

        const packageJson = readJson(packageJsonPath);
        packageInfos.set(packageJson.name, {
          name: packageJson.name,
          directoryPath: workspacePath,
          scripts: packageJson.scripts ?? {}
        });
      }
      continue;
    }

    const packageJsonPath = path.join(absolutePatternPath, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = readJson(packageJsonPath);
    packageInfos.set(packageJson.name, {
      name: packageJson.name,
      directoryPath: absolutePatternPath,
      scripts: packageJson.scripts ?? {}
    });
  }

  return packageInfos;
}

function collectDeclaredWorkspaceDeps(packageJson) {
  const dependencyFields = ["dependencies", "peerDependencies"];
  const dependencyNames = [];

  for (const fieldName of dependencyFields) {
    const fieldValue = packageJson[fieldName];
    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    for (const dependencyName of Object.keys(fieldValue)) {
      if (dependencyName.startsWith("@leafergraph/") || dependencyName === "leafergraph") {
        dependencyNames.push(dependencyName);
      }
    }
  }

  return dependencyNames;
}

function extractWorkspaceSpecifiers(source) {
  const specifiers = new Set();
  const specifierPattern =
    /\bfrom\s+["']((?:@leafergraph\/[^"']+)|leafergraph)["']|\bimport\s*\(\s*["']((?:@leafergraph\/[^"']+)|leafergraph)["']\s*\)/g;

  for (const match of source.matchAll(specifierPattern)) {
    const rawSpecifier = match[1] ?? match[2];
    if (!rawSpecifier) {
      continue;
    }

    const normalizedSpecifier = normalizeWorkspaceSpecifier(rawSpecifier);
    if (normalizedSpecifier) {
      specifiers.add(normalizedSpecifier);
    }
  }

  return specifiers;
}

function normalizeWorkspaceSpecifier(specifier) {
  if (specifier === "leafergraph") {
    return specifier;
  }

  if (!specifier.startsWith("@leafergraph/")) {
    return null;
  }

  const segments = specifier.split("/");
  return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : specifier;
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
