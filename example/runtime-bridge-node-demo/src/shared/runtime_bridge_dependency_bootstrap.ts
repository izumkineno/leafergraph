import * as authoringRuntime from "@leafergraph/authoring";
import * as basicKitRuntime from "@leafergraph/basic-kit";
import * as contractsRuntime from "@leafergraph/contracts";
import * as executionRuntime from "@leafergraph/execution";
import * as nodeRuntime from "@leafergraph/node";
import * as runtimeBridgeRuntime from "@leafergraph/runtime-bridge";
import * as widgetRuntime from "@leafergraph/widget-runtime";
import * as leaferUiRuntime from "leafer-ui";
import {
  LeaferGraph,
  createLeaferGraph,
  registerRuntimeBridgeModuleDependencies
} from "@leafergraph/runtime-bridge";

let bootstrapped = false;

export function bootstrapRuntimeBridgeDemoModuleDependencies(): void {
  if (bootstrapped) {
    return;
  }

  registerRuntimeBridgeModuleDependencies({
    "@leafergraph/authoring": authoringRuntime,
    "@leafergraph/basic-kit": basicKitRuntime,
    "@leafergraph/contracts": contractsRuntime,
    "@leafergraph/execution": executionRuntime,
    "@leafergraph/node": nodeRuntime,
    "@leafergraph/runtime-bridge": runtimeBridgeRuntime,
    "@leafergraph/widget-runtime": widgetRuntime,
    "leafer-ui": leaferUiRuntime,
    leafergraph: {
      createLeaferGraph,
      LeaferGraph
    }
  });
  bootstrapped = true;
}
