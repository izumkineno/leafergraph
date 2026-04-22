import { resolve } from "node:path";

import type { Alias } from "vite";

type PackageAlias = {
  alias: string;
  packagePath: string;
};

const packageAliases: PackageAlias[] = [
  { alias: "@leafergraph/core/node", packagePath: "packages/core/node" },
  { alias: "@leafergraph/core/execution", packagePath: "packages/core/execution" },
  { alias: "@leafergraph/core/contracts", packagePath: "packages/core/contracts" },
  { alias: "@leafergraph/core/config", packagePath: "packages/core/config" },
  { alias: "@leafergraph/core/theme", packagePath: "packages/core/theme" },
  { alias: "@leafergraph/core/widget-runtime", packagePath: "packages/core/widget-runtime" },
  { alias: "@leafergraph/core/basic-kit", packagePath: "packages/core/basic-kit" },
  { alias: "@leafergraph/extensions/context-menu", packagePath: "packages/extensions/context-menu" },
  {
    alias: "@leafergraph/extensions/context-menu-builtins",
    packagePath: "packages/extensions/context-menu-builtins"
  },
  { alias: "@leafergraph/extensions/undo-redo", packagePath: "packages/extensions/undo-redo" },
  { alias: "@leafergraph/extensions/shortcuts", packagePath: "packages/extensions/shortcuts" },
  { alias: "@leafergraph/node", packagePath: "packages/core/node" },
  { alias: "@leafergraph/execution", packagePath: "packages/core/execution" },
  { alias: "@leafergraph/contracts", packagePath: "packages/core/contracts" },
  { alias: "@leafergraph/config", packagePath: "packages/core/config" },
  { alias: "@leafergraph/theme", packagePath: "packages/core/theme" },
  { alias: "@leafergraph/widget-runtime", packagePath: "packages/core/widget-runtime" },
  { alias: "@leafergraph/basic-kit", packagePath: "packages/core/basic-kit" },
  { alias: "@leafergraph/context-menu", packagePath: "packages/extensions/context-menu" },
  { alias: "@leafergraph/context-menu-builtins", packagePath: "packages/extensions/context-menu-builtins" },
  { alias: "@leafergraph/undo-redo", packagePath: "packages/extensions/undo-redo" },
  { alias: "@leafergraph/shortcuts", packagePath: "packages/extensions/shortcuts" },
  { alias: "@leafergraph/authoring", packagePath: "packages/extensions/authoring" },
  { alias: "leafergraph", packagePath: "packages/leafergraph" }
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createPackageAliasEntries(rootDir: string, aliases: PackageAlias[]): Alias[] {
  return aliases.flatMap(({ alias, packagePath }) => [
    {
      find: new RegExp(`^${escapeRegExp(alias)}$`),
      replacement: resolve(rootDir, packagePath, "src", "index.ts")
    },
    {
      find: new RegExp(`^${escapeRegExp(alias)}/(.+)$`),
      replacement: `${resolve(rootDir, packagePath, "src")}/$1`
    }
  ]);
}

export function createLeafergraphAliases(rootDir: string): Alias[] {
  return createPackageAliasEntries(rootDir, packageAliases);
}
