import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const rootPackageJsonPath = path.join(repoRoot, "package.json");

export const requiredWorkspaceGlobs = [
  "packages/*",
  "packages/core/*",
  "packages/extensions/*"
];

export const packageMigrationBlueprints = [
  {
    id: "node",
    lane: 1,
    currentName: "@leafergraph/node",
    currentPath: "packages/node",
    targetName: "@leafergraph/core/node",
    targetPath: "packages/core/node"
  },
  {
    id: "execution",
    lane: 1,
    currentName: "@leafergraph/execution",
    currentPath: "packages/execution",
    targetName: "@leafergraph/core/execution",
    targetPath: "packages/core/execution"
  },
  {
    id: "contracts",
    lane: 1,
    currentName: "@leafergraph/contracts",
    currentPath: "packages/contracts",
    targetName: "@leafergraph/core/contracts",
    targetPath: "packages/core/contracts"
  },
  {
    id: "config",
    lane: 2,
    currentName: "@leafergraph/config",
    currentPath: "packages/config",
    targetName: "@leafergraph/core/config",
    targetPath: "packages/core/config"
  },
  {
    id: "theme",
    lane: 2,
    currentName: "@leafergraph/theme",
    currentPath: "packages/theme",
    targetName: "@leafergraph/core/theme",
    targetPath: "packages/core/theme"
  },
  {
    id: "widgetRuntime",
    lane: 2,
    currentName: "@leafergraph/widget-runtime",
    currentPath: "packages/widget-runtime",
    targetName: "@leafergraph/core/widget-runtime",
    targetPath: "packages/core/widget-runtime"
  },
  {
    id: "basicKit",
    lane: 2,
    currentName: "@leafergraph/basic-kit",
    currentPath: "packages/basic-kit",
    targetName: "@leafergraph/core/basic-kit",
    targetPath: "packages/core/basic-kit"
  },
  {
    id: "contextMenu",
    lane: 3,
    currentName: "@leafergraph/context-menu",
    currentPath: "packages/context-menu",
    targetName: "@leafergraph/extensions/context-menu",
    targetPath: "packages/extensions/context-menu"
  },
  {
    id: "contextMenuBuiltins",
    lane: 3,
    currentName: "@leafergraph/context-menu-builtins",
    currentPath: "packages/context-menu-builtins",
    targetName: "@leafergraph/extensions/context-menu-builtins",
    targetPath: "packages/extensions/context-menu-builtins"
  },
  {
    id: "undoRedo",
    lane: 3,
    currentName: "@leafergraph/undo-redo",
    currentPath: "packages/undo-redo",
    targetName: "@leafergraph/extensions/undo-redo",
    targetPath: "packages/extensions/undo-redo"
  },
  {
    id: "shortcuts",
    lane: 3,
    currentName: "@leafergraph/shortcuts",
    currentPath: "packages/shortcuts",
    targetName: "@leafergraph/extensions/shortcuts",
    targetPath: "packages/extensions/shortcuts"
  },
  {
    id: "authoring",
    lane: 3,
    currentName: "@leafergraph/authoring",
    currentPath: "packages/authoring",
    targetName: "@leafergraph/extensions/authoring",
    targetPath: "packages/extensions/authoring"
  },
  {
    id: "leafergraph",
    lane: 4,
    currentName: "leafergraph",
    currentPath: "packages/leafergraph",
    targetName: "leafergraph",
    targetPath: "packages/leafergraph"
  }
];

export const verificationMatrix = [
  {
    lane: 0,
    title: "workspace gate",
    commands: [
      "bun run inspect:package-split",
      "bun run check:workspace-boundaries",
      "bun run check:runtime-only-root"
    ]
  },
  {
    lane: 1,
    title: "core foundation",
    commands: [
      "bun run build:node",
      "bun run build:execution",
      "bun run build:contracts",
      "bun run test:node",
      "bun run test:execution",
      "bun run test:contracts"
    ]
  },
  {
    lane: 2,
    title: "core runtime",
    commands: [
      "bun run build:theme",
      "bun run build:config",
      "bun run build:widget-runtime",
      "bun run build:basic-kit",
      "bun run test:theme",
      "bun run test:widget-runtime",
      "bun run test:basic-kit"
    ]
  },
  {
    lane: 3,
    title: "extensions",
    commands: [
      "bun run build:context-menu",
      "bun run build:context-menu-builtins",
      "bun run build:shortcuts",
      "bun run build:undo-redo",
      "bun run build:authoring",
      "bun run test:context-menu",
      "bun run test:context-menu-builtins",
      "bun run test:shortcuts",
      "bun run test:undo-redo",
      "bun run test:authoring"
    ]
  },
  {
    lane: 4,
    title: "main package",
    commands: ["bun run build:leafergraph", "bun run test:leafergraph"]
  },
  {
    lane: 5,
    title: "docs/examples/templates",
    commands: [
      "bun run test:smoke:examples",
      "bun run test:smoke:templates",
      "bun run test"
    ]
  }
];

const packageBoundaryBlueprints = {
  node: {
    names: ["@leafergraph/node", "@leafergraph/core/node"],
    allowedWorkspaceDepIds: [],
    allowedSourceImportIds: []
  },
  theme: {
    names: ["@leafergraph/theme", "@leafergraph/core/theme"],
    allowedWorkspaceDepIds: [],
    allowedSourceImportIds: []
  },
  config: {
    names: ["@leafergraph/config", "@leafergraph/core/config"],
    allowedWorkspaceDepIds: [],
    allowedSourceImportIds: []
  },
  execution: {
    names: ["@leafergraph/execution", "@leafergraph/core/execution"],
    allowedWorkspaceDepIds: ["node"],
    allowedSourceImportIds: ["node"]
  },
  contracts: {
    names: ["@leafergraph/contracts", "@leafergraph/core/contracts"],
    allowedWorkspaceDepIds: ["config", "execution", "node", "theme"],
    allowedSourceImportIds: ["config", "execution", "node", "theme"]
  },
  runtimeBridge: {
    names: ["@leafergraph/runtime-bridge"],
    allowedWorkspaceDepIds: ["contracts", "execution", "node", "leafergraph"],
    allowedSourceImportIds: ["contracts", "execution", "node", "leafergraph"]
  },
  widgetRuntime: {
    names: ["@leafergraph/widget-runtime", "@leafergraph/core/widget-runtime"],
    allowedWorkspaceDepIds: ["config", "contracts", "node", "theme"],
    allowedSourceImportIds: ["config", "contracts", "node", "theme"]
  },
  basicKit: {
    names: ["@leafergraph/basic-kit", "@leafergraph/core/basic-kit"],
    allowedWorkspaceDepIds: ["contracts", "execution", "node", "theme", "widgetRuntime"],
    allowedSourceImportIds: ["contracts", "execution", "node", "theme", "widgetRuntime"]
  },
  contextMenu: {
    names: ["@leafergraph/context-menu", "@leafergraph/extensions/context-menu"],
    allowedWorkspaceDepIds: ["config", "theme"],
    allowedSourceImportIds: ["config", "theme"]
  },
  contextMenuBuiltins: {
    names: [
      "@leafergraph/context-menu-builtins",
      "@leafergraph/extensions/context-menu-builtins"
    ],
    allowedWorkspaceDepIds: ["contextMenu", "contracts", "node"],
    allowedSourceImportIds: ["contextMenu", "contracts", "node"]
  },
  shortcuts: {
    names: ["@leafergraph/shortcuts", "@leafergraph/extensions/shortcuts"],
    allowedWorkspaceDepIds: [],
    allowedSourceImportIds: []
  },
  undoRedo: {
    names: ["@leafergraph/undo-redo", "@leafergraph/extensions/undo-redo"],
    allowedWorkspaceDepIds: ["config", "contracts", "node"],
    allowedSourceImportIds: ["config", "contracts", "node"]
  },
  authoring: {
    names: ["@leafergraph/authoring", "@leafergraph/extensions/authoring"],
    allowedWorkspaceDepIds: ["contracts", "execution", "node", "theme", "leafergraph"],
    allowedSourceImportIds: ["contracts", "execution", "node", "theme"]
  },
  leafergraph: {
    names: ["leafergraph"],
    allowedWorkspaceDepIds: ["config", "contracts", "execution", "node", "theme", "widgetRuntime"],
    allowedSourceImportIds: ["config", "contracts", "execution", "node", "theme", "widgetRuntime"]
  }
};

export function createWorkspaceBoundaryRules() {
  const packageNamesById = Object.fromEntries(
    Object.entries(packageBoundaryBlueprints).map(([id, blueprint]) => [id, blueprint.names])
  );

  return Object.fromEntries(
    Object.values(packageBoundaryBlueprints)
      .flatMap((blueprint) =>
        blueprint.names.map((name) => [
          name,
          {
            allowedWorkspaceDeps: expandAllowedNames(
              blueprint.allowedWorkspaceDepIds,
              packageNamesById
            ),
            allowedSourceImports: expandAllowedNames(
              blueprint.allowedSourceImportIds,
              packageNamesById
            )
          }
        ])
      )
  );
}

function expandAllowedNames(ids, packageNamesById) {
  return ids.flatMap((id) => packageNamesById[id] ?? []);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function collectWorkspacePackageInventory() {
  const rootPackageJson = readJson(rootPackageJsonPath);
  const inventory = [];

  for (const workspacePattern of rootPackageJson.workspaces ?? []) {
    if (!workspacePattern.startsWith("packages/")) {
      continue;
    }

    for (const directoryPath of resolveWorkspaceDirectories(workspacePattern)) {
      const packageJsonPath = path.join(directoryPath, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = readJson(packageJsonPath);
      const relativePath = path.relative(repoRoot, directoryPath).replaceAll("\\", "/");
      const blueprint = packageMigrationBlueprints.find(
        (entry) =>
          entry.currentName === packageJson.name || entry.targetName === packageJson.name
      );

      inventory.push({
        name: packageJson.name,
        relativePath,
        lane: blueprint?.lane ?? null,
        targetName: blueprint?.targetName ?? null,
        targetPath: blueprint?.targetPath ?? null
      });
    }
  }

  return inventory.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function resolveWorkspaceDirectories(workspacePattern) {
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

function printInventoryReport() {
  const rootPackageJson = readJson(rootPackageJsonPath);
  const inventory = collectWorkspacePackageInventory();
  const missingRequiredGlobs = requiredWorkspaceGlobs.filter(
    (workspace) => !(rootPackageJson.workspaces ?? []).includes(workspace)
  );

  console.log("# Package split workspace gate");
  console.log("");
  console.log("## Required workspace globs");
  for (const workspace of requiredWorkspaceGlobs) {
    const status = missingRequiredGlobs.includes(workspace) ? "missing" : "ok";
    console.log(`- [${status}] ${workspace}`);
  }

  console.log("");
  console.log("## Current package inventory");
  for (const entry of inventory) {
    const migrationSuffix = entry.targetPath
      ? ` -> ${entry.targetPath} (${entry.targetName})`
      : "";
    const laneSuffix = entry.lane ? ` [lane ${entry.lane}]` : "";
    console.log(`- ${entry.relativePath} (${entry.name})${laneSuffix}${migrationSuffix}`);
  }

  console.log("");
  console.log("## Verification matrix");
  for (const lane of verificationMatrix) {
    console.log(`- Lane ${lane.lane} ${lane.title}: ${lane.commands.join(" | ")}`);
  }
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  printInventoryReport();
}
