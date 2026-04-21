import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const canonicalPackageRules = {
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
  "@leafergraph/runtime-bridge": {
    allowedWorkspaceDeps: [
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "leafergraph"
    ],
    allowedSourceImports: [
      "@leafergraph/contracts",
      "@leafergraph/execution",
      "@leafergraph/node",
      "leafergraph"
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
  "@leafergraph/shortcuts": {
    allowedWorkspaceDeps: [],
    allowedSourceImports: []
  },
  "@leafergraph/undo-redo": {
    allowedWorkspaceDeps: [
      "@leafergraph/config",
      "@leafergraph/contracts",
      "@leafergraph/node"
    ],
    allowedSourceImports: [
      "@leafergraph/config",
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

const ruleAliases = {
  "@leafergraph/node": ["@leafergraph/core/node"],
  "@leafergraph/execution": ["@leafergraph/core/execution"],
  "@leafergraph/contracts": ["@leafergraph/core/contracts"],
  "@leafergraph/config": ["@leafergraph/core/config"],
  "@leafergraph/theme": ["@leafergraph/core/theme"],
  "@leafergraph/widget-runtime": ["@leafergraph/core/widget-runtime"],
  "@leafergraph/basic-kit": ["@leafergraph/core/basic-kit"],
  "@leafergraph/context-menu": ["@leafergraph/extensions/context-menu"],
  "@leafergraph/context-menu-builtins": ["@leafergraph/extensions/context-menu-builtins"],
  "@leafergraph/undo-redo": ["@leafergraph/extensions/undo-redo"],
  "@leafergraph/shortcuts": ["@leafergraph/extensions/shortcuts"],
  "@leafergraph/authoring": ["@leafergraph/extensions/authoring"]
};

export const packageRules = buildPackageRules();

export function getPackageRule(packageName) {
  return packageRules[packageName] ?? null;
}

export function collectPackageInfos(packagesRoot, repoRoot) {
  const packageInfos = new Map();
  for (const directoryPath of walkPackageDirectories(packagesRoot)) {
    const packageJsonPath = path.join(directoryPath, "package.json");
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

export function collectWorkspacePackages(repoRoot, workspaces) {
  const packageInfos = new Map();

  for (const workspacePattern of workspaces) {
    const workspacePaths = resolveWorkspacePattern(repoRoot, workspacePattern);
    for (const workspacePath of workspacePaths) {
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
  }

  return packageInfos;
}

export function collectDeclaredWorkspaceDeps(packageJson) {
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

export function extractWorkspaceSpecifiers(source) {
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

export function normalizeWorkspaceSpecifier(specifier) {
  if (specifier === "leafergraph") {
    return specifier;
  }

  if (!specifier.startsWith("@leafergraph/")) {
    return null;
  }

  const segments = specifier.split("/");
  if (segments.length >= 3 && (segments[1] === "core" || segments[1] === "extensions")) {
    return segments.slice(0, 3).join("/");
  }

  return segments.length >= 2 ? segments.slice(0, 2).join("/") : specifier;
}

function buildPackageRules() {
  const rules = {};

  for (const [packageName, rule] of Object.entries(canonicalPackageRules)) {
    rules[packageName] = rule;

    for (const alias of ruleAliases[packageName] ?? []) {
      rules[alias] = {
        allowedWorkspaceDeps: rule.allowedWorkspaceDeps.map(normalizeRulePackageName),
        allowedSourceImports: rule.allowedSourceImports.map(normalizeRulePackageName)
      };
    }
  }

  return rules;
}

function normalizeRulePackageName(packageName) {
  for (const [canonicalName, aliases] of Object.entries(ruleAliases)) {
    if (packageName === canonicalName) {
      return aliases[0] ?? packageName;
    }
  }

  return packageName;
}

function resolveWorkspacePattern(repoRoot, workspacePattern) {
  const absolutePatternPath = path.join(repoRoot, workspacePattern);

  if (workspacePattern.endsWith("/*")) {
    const parentPath = absolutePatternPath.slice(0, -2);
    if (!existsSync(parentPath)) {
      return [];
    }

    return readdirSync(parentPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(parentPath, entry.name));
  }

  return [absolutePatternPath];
}

function walkPackageDirectories(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }

  const packageDirectories = [];
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const hasPackageJson = entries.some(
    (entry) => entry.isFile() && entry.name === "package.json"
  );

  if (hasPackageJson) {
    packageDirectories.push(directoryPath);
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    packageDirectories.push(...walkPackageDirectories(path.join(directoryPath, entry.name)));
  }

  return packageDirectories;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
