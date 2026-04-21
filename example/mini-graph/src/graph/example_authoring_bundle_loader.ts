/**
 * mini-graph 的 authoring bundle 文件加载器。
 *
 * @remarks
 * 这里专门负责：
 * - 读取用户选择的编译后 JS 文件
 * - 把 bundle 里的 bare import 改写到当前宿主可用的运行时依赖
 * - 从 bundle 导出中解析出可注册的 plugin / module
 */

import type { NodeModule } from "@leafergraph/core/node";
import type { LeaferGraphNodePlugin } from "@leafergraph/core/contracts";
import type { LeaferGraph } from "leafergraph";
import {
  EXAMPLE_AUTHORING_RUNTIME_DEPENDENCY_SPECIFIERS,
  loadExampleAuthoringRuntimeDependency,
  type ExampleAuthoringRuntimeDependencyNamespace as RuntimeDependencyNamespace
} from "./example_authoring_runtime_dependencies";

const GLOBAL_DEPENDENCY_KEY = "__LEAFERGRAPH_MINI_AUTHORING_BUNDLE_DEPS__";
const dependencyShimUrlCache = new Map<string, string>();

/** 单个 bundle 成功解析后对外暴露的最小注册结果。 */
export interface ExampleAuthoringBundleRegistration {
  exportName: string;
  packageName: string;
  registrationMode: "plugin" | "module";
  apply(graph: LeaferGraph): Promise<void> | void;
}

/**
 *  读取一个编译后 JS bundle，并解析出可注册的入口。
 *
 * @param file - 文件。
 * @returns 处理后的结果。
 */
export async function loadAuthoringBundleRegistration(
  file: File
): Promise<ExampleAuthoringBundleRegistration> {
  const sourceText = stripSourceMapComment(await file.text());
  const rewrittenSource = await rewriteRuntimeDependencies(sourceText);
  const bundleUrl = URL.createObjectURL(
    new Blob([rewrittenSource], {
      type: "text/javascript"
    })
  );

  try {
    const moduleNamespace = (await import(
      /* @vite-ignore */ bundleUrl
    )) as RuntimeDependencyNamespace;
    return resolveBundleRegistration(file, moduleNamespace);
  } finally {
    URL.revokeObjectURL(bundleUrl);
  }
}

/**
 * 处理 `stripSourceMapComment` 相关逻辑。
 *
 * @param sourceText - 来源文本。
 * @returns 处理后的结果。
 */
function stripSourceMapComment(sourceText: string): string {
  return sourceText.replace(/^\/\/# sourceMappingURL=.*$/gm, "");
}

/**
 * 重写运行时依赖。
 *
 * @param sourceText - 来源文本。
 * @returns 重写运行时依赖的结果。
 */
async function rewriteRuntimeDependencies(
  sourceText: string
): Promise<string> {
  let nextSource = sourceText;

  for (const specifier of EXAMPLE_AUTHORING_RUNTIME_DEPENDENCY_SPECIFIERS) {
    if (!nextSource.includes(specifier)) {
      continue;
    }

    const shimUrl = await ensureRuntimeDependencyShim(specifier);
    const specifierPattern = new RegExp(
      `(["'])${escapeRegExp(specifier)}\\1`,
      "g"
    );
    nextSource = nextSource.replace(specifierPattern, `"${shimUrl}"`);
  }

  return nextSource;
}

/**
 * 确保运行时依赖垫片。
 *
 * @param specifier - `specifier`。
 * @returns 确保运行时依赖垫片的结果。
 */
async function ensureRuntimeDependencyShim(
  specifier: string
): Promise<string> {
  const cachedUrl = dependencyShimUrlCache.get(specifier);
  if (cachedUrl) {
    return cachedUrl;
  }

  const registry = getRuntimeDependencyRegistry();
  registry[specifier] = await loadExampleAuthoringRuntimeDependency(specifier);

  const exportLines = buildDependencyExportLines(specifier, registry[specifier]);
  const shimUrl = URL.createObjectURL(
    new Blob([exportLines], {
      type: "text/javascript"
    })
  );
  dependencyShimUrlCache.set(specifier, shimUrl);
  return shimUrl;
}

/**
 * 处理 `buildDependencyExportLines` 相关逻辑。
 *
 * @param specifier - `specifier`。
 * @param moduleNamespace - 模块`Namespace`。
 * @returns 处理后的结果。
 */
function buildDependencyExportLines(
  specifier: string,
  moduleNamespace: RuntimeDependencyNamespace
): string {
  const lines = [
    `const namespace = globalThis[${JSON.stringify(
      GLOBAL_DEPENDENCY_KEY
    )}][${JSON.stringify(specifier)}];`
  ];

  for (const exportName of Object.keys(moduleNamespace)) {
    if (exportName === "default") {
      continue;
    }
    if (!isValidJavaScriptIdentifier(exportName)) {
      continue;
    }

    lines.push(
      `export const ${exportName} = namespace[${JSON.stringify(exportName)}];`
    );
  }

  if ("default" in moduleNamespace) {
    lines.push("export default namespace.default;");
  }

  return lines.join("\n");
}

/**
 * 获取运行时依赖注册表。
 *
 * @returns 处理后的结果。
 */
function getRuntimeDependencyRegistry(): Record<
  string,
  RuntimeDependencyNamespace
> {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_DEPENDENCY_KEY]?: Record<string, RuntimeDependencyNamespace>;
  };
  const currentRegistry = globalObject[GLOBAL_DEPENDENCY_KEY];
  if (currentRegistry) {
    return currentRegistry;
  }

  const nextRegistry: Record<string, RuntimeDependencyNamespace> = {};
  globalObject[GLOBAL_DEPENDENCY_KEY] = nextRegistry;
  return nextRegistry;
}

/**
 * 解析Bundle `Registration`。
 *
 * @param file - 文件。
 * @param moduleNamespace - 模块`Namespace`。
 * @returns 处理后的结果。
 */
function resolveBundleRegistration(
  file: File,
  moduleNamespace: RuntimeDependencyNamespace
): ExampleAuthoringBundleRegistration {
  const pluginCandidate = resolvePluginCandidate(moduleNamespace);
  if (pluginCandidate) {
    return {
      exportName: pluginCandidate.exportName,
      packageName: resolvePackageName(pluginCandidate.value, file),
      registrationMode: "plugin",
      apply(graph) {
        return graph.use(pluginCandidate.value);
      }
    };
  }

  const moduleCandidate = resolveModuleCandidate(moduleNamespace);
  if (moduleCandidate) {
    return {
      exportName: moduleCandidate.exportName,
      packageName: resolvePackageName(moduleCandidate.value, file),
      registrationMode: "module",
      apply(graph) {
        graph.installModule(moduleCandidate.value);
      }
    };
  }

  throw new Error(
    "选择的 JS 文件未导出可注册的 plugin 或 module，请确认它是单文件 ESM authoring bundle。"
  );
}

/**
 * 解析插件候选项。
 *
 * @param moduleNamespace - 模块`Namespace`。
 * @returns 处理后的结果。
 */
function resolvePluginCandidate(
  moduleNamespace: RuntimeDependencyNamespace
): { exportName: string; value: LeaferGraphNodePlugin } | null {
  const defaultExport = moduleNamespace.default;
  if (isPluginLike(defaultExport)) {
    return {
      exportName: "default",
      value: defaultExport
    };
  }

  for (const [exportName, value] of Object.entries(moduleNamespace)) {
    if (exportName !== "default" && exportName.endsWith("Plugin") && isPluginLike(value)) {
      return {
        exportName,
        value
      };
    }
  }

  for (const [exportName, value] of Object.entries(moduleNamespace)) {
    if (exportName !== "default" && isPluginLike(value)) {
      return {
        exportName,
        value
      };
    }
  }

  return null;
}

/**
 * 解析模块候选项。
 *
 * @param moduleNamespace - 模块`Namespace`。
 * @returns 处理后的结果。
 */
function resolveModuleCandidate(
  moduleNamespace: RuntimeDependencyNamespace
): { exportName: string; value: NodeModule } | null {
  const defaultExport = moduleNamespace.default;
  if (isNodeModuleLike(defaultExport)) {
    return {
      exportName: "default",
      value: defaultExport
    };
  }

  for (const [exportName, value] of Object.entries(moduleNamespace)) {
    if (exportName !== "default" && exportName.endsWith("Module") && isNodeModuleLike(value)) {
      return {
        exportName,
        value
      };
    }
  }

  for (const [exportName, value] of Object.entries(moduleNamespace)) {
    if (exportName !== "default" && isNodeModuleLike(value)) {
      return {
        exportName,
        value
      };
    }
  }

  return null;
}

/**
 * 判断是否为插件`Like`。
 *
 * @param value - 当前值。
 * @returns 对应的判断结果。
 */
function isPluginLike(value: unknown): value is LeaferGraphNodePlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { install?: unknown }).install === "function"
  );
}

/**
 * 判断是否为节点模块`Like`。
 *
 * @param value - 当前值。
 * @returns 对应的判断结果。
 */
function isNodeModuleLike(value: unknown): value is NodeModule {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { nodes?: unknown }).nodes)
  );
}

/**
 * 解析包`Name`。
 *
 * @param value - 当前值。
 * @param file - 文件。
 * @returns 处理后的结果。
 */
function resolvePackageName(value: unknown, file: File): string {
  const packageName =
    typeof (value as { name?: unknown })?.name === "string"
      ? (value as { name: string }).name
      : undefined;
  return packageName && packageName.trim()
    ? packageName
    : removeFileExtension(file.name);
}

/**
 * 移除文件`Extension`。
 *
 * @param fileName - 文件`Name`。
 * @returns 移除文件`Extension`的结果。
 */
function removeFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/**
 * 处理 `isValidJavaScriptIdentifier` 相关逻辑。
 *
 * @param value - 当前值。
 * @returns 对应的判断结果。
 */
function isValidJavaScriptIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/u.test(value);
}

/**
 * 处理 `escapeRegExp` 相关逻辑。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
