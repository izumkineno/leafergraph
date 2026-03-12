import { createNodeApi } from "./api";
import type { NodeRegistry } from "./registry";
import type { NodeInit, NodeRuntimeState } from "./types";
import {
  cloneFlags,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpecs,
  createDefaultTitle,
  createNodeId,
  createPropertyValues,
  resizeRuntimeValues,
  resolveNodeLayout
} from "./utils";
import { normalizeWidgetSpecs } from "./widget";

export function createNodeState(
  registry: NodeRegistry,
  init: NodeInit
): NodeRuntimeState {
  const definition = registry.require(init.type);
  const propertySpecs = clonePropertySpecs(init.propertySpecs ?? definition.properties);
  const inputs = cloneSlotSpecs(init.inputs ?? definition.inputs);
  const outputs = cloneSlotSpecs(init.outputs ?? definition.outputs);
  const widgets = normalizeWidgetSpecs(
    registry.widgetRegistry,
    init.widgets ?? definition.widgets
  );

  const node: NodeRuntimeState = {
    id: init.id ?? createNodeId(definition.type),
    type: definition.type,
    title: init.title ?? definition.title ?? createDefaultTitle(definition.type),
    layout: resolveNodeLayout(definition, init.layout),
    properties: createPropertyValues(propertySpecs, init.properties),
    propertySpecs,
    inputs,
    outputs,
    widgets,
    flags: cloneFlags(init.flags),
    inputValues: resizeRuntimeValues([], inputs.length),
    outputValues: resizeRuntimeValues([], outputs.length),
    data: cloneRecord(init.data)
  };

  const api = createNodeApi(node, {
    definition,
    widgetRegistry: registry.widgetRegistry
  });

  definition.onCreate?.(node, api);
  return node;
}
