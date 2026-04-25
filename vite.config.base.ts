import { resolve, basename, dirname } from "node:path";
import glob from "fast-glob";
const globSync = glob.sync;

import type { Alias, LibraryFormats, UserConfig } from "vite";

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

export interface LeafergraphBuildConfigOptions {
  /** 构建格式，默认 ['es'] */
  formats?: LibraryFormats[];
  /** 是否生成 sourcemap，默认 true */
  sourcemap?: boolean;
  /** 外部依赖列表 */
  external?: string[];
  /** 是否仅构建指定的包，不传则构建所有包 */
  packages?: string[];
}

/**
 * 创建统一的 Leafergraph 构建配置
 * 所有包的产物都会输出到根目录的 dist 文件夹下
 */
export function createLeafergraphBuildConfig(
  rootDir: string,
  options: LeafergraphBuildConfigOptions = {}
): UserConfig {
  const {
    formats = ["es"],
    sourcemap = true,
    external = [],
    packages: filterPackages
  } = options;

  // 扫描所有包的入口文件
  const entryFiles = globSync("packages/**/src/index.ts", {
    cwd: rootDir,
    absolute: true,
    onlyFiles: true
  });

  // 构建入口映射
  const entries: Record<string, string> = {};
  entryFiles.forEach(filePath => {
    // 从文件路径提取包路径，例如：
    // /project/packages/core/node/src/index.ts → core/node
    // /project/packages/extensions/context-menu/src/index.ts → extensions/context-menu
    // /project/packages/leafergraph/src/index.ts → leafergraph
    const relativePath = filePath.replace(resolve(rootDir, "packages"), "").replace(/\\/g, "/");
    const packagePath = dirname(dirname(relativePath)).replace(/^\//, "");

    // 如果指定了包过滤，只保留符合条件的包
    if (filterPackages && filterPackages.length > 0) {
      const packageName = packagePath.includes("/") ? basename(packagePath) : packagePath;
      if (!filterPackages.includes(packageName) && !filterPackages.includes(packagePath)) {
        return;
      }
    }

    entries[`${packagePath}/index`] = filePath;
  });

  // 如果只有一个入口，使用单包构建模式
  const entryKeys = Object.keys(entries);
  if (entryKeys.length === 1) {
    const entryKey = entryKeys[0];
    const entryPath = entries[entryKey];
    // 提取包名，例如 leafergraph/index → leafergraph
    const packageName = entryKey.replace(/\/index$/, "");

    return {
      build: {
        lib: {
          entry: entryPath,
          name: packageName,
          fileName: "index",
          formats
        },
        rollupOptions: {
          external
        },
        sourcemap,
        // 输出到根目录的对应包目录，从当前工作目录出发
        outDir: `../../dist/${packageName}`
      },
      resolve: {
        alias: createLeafergraphAliases(rootDir)
      }
    };
  }

  // 多包构建模式
  return {
    build: {
      lib: {
        entry: entries,
        formats,
        fileName: (format, entryName) => {
          // entryName 是 core/node/index → 输出到 core/node/index.js
          return `${entryName}.js`;
        }
      },
      rollupOptions: {
        external,
        output: {
          // 保留目录结构
          preserveModules: true,
          preserveModulesRoot: "packages",
          // 输出到根目录 dist
          dir: resolve(rootDir, "dist")
        }
      },
      sourcemap,
      emptyOutDir: false // 不自动清空目录，避免删除其他包的产物
    },
    resolve: {
      alias: createLeafergraphAliases(rootDir)
    }
  };
}
