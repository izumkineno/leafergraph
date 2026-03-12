import { createNodeApi } from "./api";
import type { NodeRegistry } from "./registry";
import type { NodeRuntimeState, NodeSerializeResult } from "./types";
import {
  cloneFlags,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpecs,
  createDefaultTitle,
  createPropertyValues,
  resizeRuntimeValues,
  resolveNodeLayout
} from "./utils";
import { normalizeWidgetSpecs } from "./widget";

export type NodeConfigureInput = Partial<NodeSerializeResult> &
  Pick<NodeSerializeResult, "type">;

export function configureNode(
  registry: NodeRegistry,
  node: NodeRuntimeState,
  data: NodeConfigureInput
): NodeRuntimeState {
  const definition = registry.require(data.type);
  const propertySpecs = clonePropertySpecs(
    data.propertySpecs ?? node.propertySpecs ?? definition.properties
  );

  node.id = data.id ?? node.id;
  node.type = definition.type;
  node.title = data.title ?? node.title ?? definition.title ?? createDefaultTitle(definition.type);
  node.layout = resolveNodeLayout(definition, data.layout, node.layout);
  node.propertySpecs = propertySpecs;
  node.properties = createPropertyValues(propertySpecs, data.properties ?? node.properties);
  node.inputs = cloneSlotSpecs(data.inputs ?? node.inputs ?? definition.inputs);
  node.outputs = cloneSlotSpecs(data.outputs ?? node.outputs ?? definition.outputs);
  node.widgets = normalizeWidgetSpecs(
    registry.widgetRegistry,
    data.widgets ?? node.widgets ?? definition.widgets
  );
  node.flags = {
    ...cloneFlags(node.flags),
    ...cloneFlags(data.flags)
  };
  node.inputValues = resizeRuntimeValues(node.inputValues, node.inputs.length);
  node.outputValues = resizeRuntimeValues(node.outputValues, node.outputs.length);
  node.data = data.data ? cloneRecord(data.data) : cloneRecord(node.data);

  const api = createNodeApi(node, {
    definition,
    widgetRegistry: registry.widgetRegistry
  });

  definition.onConfigure?.(
    node,
    {
      id: node.id,
      type: node.type,
      title: node.title,
      layout: node.layout,
      properties: cloneRecord(node.properties),
      propertySpecs: clonePropertySpecs(node.propertySpecs),
      inputs: cloneSlotSpecs(node.inputs),
      outputs: cloneSlotSpecs(node.outputs),
      widgets: normalizeWidgetSpecs(registry.widgetRegistry, node.widgets),
      flags: cloneFlags(node.flags),
      data: cloneRecord(node.data)
    },
    api
  );

  return node;
}
