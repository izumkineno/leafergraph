import * as contractsRuntime from "@leafergraph/contracts";
import * as executionRuntime from "@leafergraph/execution";
import * as nodeRuntime from "@leafergraph/node";
import * as leaferUiRuntime from "leafer-ui";
import * as leafergraphRuntime from "leafergraph";

export type ExampleAuthoringRuntimeDependencyNamespace = Record<string, unknown>;

const STATIC_RUNTIME_DEPENDENCIES: Record<
  string,
  ExampleAuthoringRuntimeDependencyNamespace
> = {
  "@leafergraph/contracts": contractsRuntime,
  "@leafergraph/execution": executionRuntime,
  "@leafergraph/node": nodeRuntime,
  "leafer-ui": leaferUiRuntime,
  leafergraph: leafergraphRuntime
};

const LAZY_RUNTIME_DEPENDENCY_SPECIFIERS = ["@leafergraph/authoring"] as const;

export const EXAMPLE_AUTHORING_RUNTIME_DEPENDENCY_SPECIFIERS = [
  ...LAZY_RUNTIME_DEPENDENCY_SPECIFIERS,
  ...Object.keys(STATIC_RUNTIME_DEPENDENCIES)
] as const;

/**
 * 处理 `loadExampleAuthoringRuntimeDependency` 相关逻辑。
 *
 * @param specifier - `specifier`。
 * @returns 处理后的结果。
 */
export async function loadExampleAuthoringRuntimeDependency(
  specifier: string
): Promise<ExampleAuthoringRuntimeDependencyNamespace> {
  const staticDependency = STATIC_RUNTIME_DEPENDENCIES[specifier];
  if (staticDependency) {
    return staticDependency;
  }

  if (specifier === "@leafergraph/authoring") {
    return (await import(
      "@leafergraph/authoring"
    )) as ExampleAuthoringRuntimeDependencyNamespace;
  }

  throw new Error(`mini-graph 暂不支持依赖 ${specifier}`);
}
