import * as authoringRuntime from "@leafergraph/authoring";
import * as basicKitRuntime from "@leafergraph/basic-kit";
import * as contractsRuntime from "@leafergraph/contracts";
import * as executionRuntime from "@leafergraph/execution";
import * as nodeRuntime from "@leafergraph/node";
import * as runtimeBridgeRuntime from "@leafergraph/runtime-bridge";
import * as widgetRuntime from "@leafergraph/widget-runtime";
import * as leaferUiRuntime from "leafer-ui";
import { LeaferGraph, createLeaferGraph } from "leafergraph";

export type AnalysisRuntimeDependencyNamespace = Record<string, unknown>;

const GLOBAL_DEPENDENCY_KEY = "__LEAFERGRAPH_RUNTIME_BRIDGE_ANALYSIS_DEPS__";
const dependencyShimUrlCache = new Map<string, string>();

const leafergraphRuntime: AnalysisRuntimeDependencyNamespace = {
  createLeaferGraph,
  LeaferGraph
};

const STATIC_RUNTIME_DEPENDENCIES: Record<
  string,
  AnalysisRuntimeDependencyNamespace
> = {
  "@leafergraph/authoring": authoringRuntime,
  "@leafergraph/basic-kit": basicKitRuntime,
  "@leafergraph/contracts": contractsRuntime,
  "@leafergraph/execution": executionRuntime,
  "@leafergraph/node": nodeRuntime,
  "@leafergraph/runtime-bridge": runtimeBridgeRuntime,
  "@leafergraph/widget-runtime": widgetRuntime,
  "leafer-ui": leaferUiRuntime,
  leafergraph: leafergraphRuntime
};

export const ANALYSIS_RUNTIME_DEPENDENCY_SPECIFIERS = Object.keys(
  STATIC_RUNTIME_DEPENDENCIES
) as readonly string[];

export async function rewriteAnalysisRuntimeDependencies(
  sourceText: string
): Promise<string> {
  let nextSource = sourceText.replace(/^\/\/# sourceMappingURL=.*$/gm, "");

  for (const specifier of ANALYSIS_RUNTIME_DEPENDENCY_SPECIFIERS) {
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

async function ensureRuntimeDependencyShim(specifier: string): Promise<string> {
  const cachedUrl = dependencyShimUrlCache.get(specifier);
  if (cachedUrl) {
    return cachedUrl;
  }

  const registry = getRuntimeDependencyRegistry();
  registry[specifier] = STATIC_RUNTIME_DEPENDENCIES[specifier];

  const exportLines = buildDependencyExportLines(specifier, registry[specifier]);
  const shimUrl = URL.createObjectURL(
    new Blob([exportLines], {
      type: "text/javascript"
    })
  );
  dependencyShimUrlCache.set(specifier, shimUrl);
  return shimUrl;
}

function buildDependencyExportLines(
  specifier: string,
  moduleNamespace: AnalysisRuntimeDependencyNamespace
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

function getRuntimeDependencyRegistry(): Record<
  string,
  AnalysisRuntimeDependencyNamespace
> {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_DEPENDENCY_KEY]?: Record<string, AnalysisRuntimeDependencyNamespace>;
  };
  const currentRegistry = globalObject[GLOBAL_DEPENDENCY_KEY];
  if (currentRegistry) {
    return currentRegistry;
  }

  const nextRegistry: Record<string, AnalysisRuntimeDependencyNamespace> = {};
  globalObject[GLOBAL_DEPENDENCY_KEY] = nextRegistry;
  return nextRegistry;
}

function isValidJavaScriptIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/u.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
