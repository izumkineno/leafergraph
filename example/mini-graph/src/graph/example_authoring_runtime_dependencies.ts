import * as contractsRuntime from "@leafergraph/core/contracts";
import * as executionRuntime from "@leafergraph/core/execution";
import * as nodeRuntime from "@leafergraph/core/node";
import * as widgetRuntime from "@leafergraph/core/widget-runtime";
import * as leaferUiRuntime from "leafer-ui";
import { LeaferGraph, createLeaferGraph } from "leafergraph";

export type ExampleAuthoringRuntimeDependencyNamespace = Record<string, unknown>;

/**
 * mini-graph 只把主包允许暴露的 runtime façade 桥接给 browser bundle。
 *
 * @remarks
 * 这里故意不用 `import * as leafergraphRuntime from "leafergraph"`：
 * - 主包已经收口为 runtime-only root
 * - `check:runtime-only-root` 只允许显式 named import
 * - 后续如果需要新增桥接能力，必须同时满足主包边界和 checker 规则
 */
const leafergraphRuntime: ExampleAuthoringRuntimeDependencyNamespace = {
  createLeaferGraph,
  LeaferGraph
};

const STATIC_RUNTIME_DEPENDENCIES: Record<
  string,
  ExampleAuthoringRuntimeDependencyNamespace
> = {
  "@leafergraph/core/contracts": contractsRuntime,
  "@leafergraph/core/execution": executionRuntime,
  "@leafergraph/core/node": nodeRuntime,
  "@leafergraph/core/widget-runtime": widgetRuntime,
  "leafer-ui": leaferUiRuntime,
  leafergraph: leafergraphRuntime
};

const LAZY_RUNTIME_DEPENDENCY_SPECIFIERS = ["@leafergraph/extensions/authoring"] as const;

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

  if (specifier === "@leafergraph/extensions/authoring") {
    return (await import(
      "@leafergraph/extensions/authoring"
    )) as ExampleAuthoringRuntimeDependencyNamespace;
  }

  throw new Error(`mini-graph 暂不支持依赖 ${specifier}`);
}
