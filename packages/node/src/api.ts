import type { NodeDefinition } from "./definition";
import type { NodeApi } from "./lifecycle";
import type {
  NodePropertySpec,
  NodeRuntimeState,
  NodeSlotSpec,
  NodeWidgetSpec,
  SlotType
} from "./types";
import {
  clonePropertySpec,
  cloneSlotSpec,
  cloneWidgetSpec,
  resizeRuntimeValues
} from "./utils";
import { type WidgetRegistry, normalizeWidgetSpec } from "./widget";

export interface CreateNodeApiOptions {
  definition?: NodeDefinition;
  widgetRegistry?: WidgetRegistry;
}

export function createNodeApi(
  node: NodeRuntimeState,
  options: CreateNodeApiOptions = {}
): NodeApi {
  const api: NodeApi = {
    addInput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec {
      const input = createSlotSpec(name, type, extra);
      node.inputs.push(input);
      node.inputValues = resizeRuntimeValues(node.inputValues, node.inputs.length);
      options.definition?.onInputAdded?.(node, input, api);
      return input;
    },
    addOutput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec {
      const output = createSlotSpec(name, type, extra);
      node.outputs.push(output);
      node.outputValues = resizeRuntimeValues(node.outputValues, node.outputs.length);
      options.definition?.onOutputAdded?.(node, output, api);
      return output;
    },
    removeInput(index: number): void {
      if (index < 0 || index >= node.inputs.length) {
        return;
      }

      node.inputs.splice(index, 1);
      node.inputValues.splice(index, 1);
      node.inputValues = resizeRuntimeValues(node.inputValues, node.inputs.length);
    },
    removeOutput(index: number): void {
      if (index < 0 || index >= node.outputs.length) {
        return;
      }

      node.outputs.splice(index, 1);
      node.outputValues.splice(index, 1);
      node.outputValues = resizeRuntimeValues(node.outputValues, node.outputs.length);
    },
    addProperty(spec: NodePropertySpec): void {
      const nextSpec = clonePropertySpec(spec);
      const index = node.propertySpecs.findIndex((item) => item.name === nextSpec.name);

      if (index >= 0) {
        node.propertySpecs[index] = nextSpec;
      } else {
        node.propertySpecs.push(nextSpec);
      }

      if (nextSpec.default !== undefined && node.properties[nextSpec.name] === undefined) {
        node.properties[nextSpec.name] = nextSpec.default;
      }
    },
    addWidget(spec: NodeWidgetSpec): void {
      const nextSpec = options.widgetRegistry
        ? normalizeWidgetSpec(options.widgetRegistry, spec)
        : cloneWidgetSpec(spec);
      node.widgets.push(nextSpec);
    },
    getInputData(slot: number): unknown {
      return node.inputValues[slot];
    },
    setOutputData(slot: number, data: unknown): void {
      if (slot < 0) {
        return;
      }

      node.outputValues = resizeRuntimeValues(
        node.outputValues,
        Math.max(node.outputValues.length, slot + 1)
      );
      node.outputValues[slot] = data;
    },
    findInputSlot(name: string): number {
      return node.inputs.findIndex((input) => input.name === name);
    },
    findOutputSlot(name: string): number {
      return node.outputs.findIndex((output) => output.name === name);
    }
  };

  return api;
}

function createSlotSpec(
  name: string,
  type?: SlotType,
  extra?: Partial<NodeSlotSpec>
): NodeSlotSpec {
  return cloneSlotSpec({
    name,
    type,
    ...extra
  });
}
