import { createNodeApi } from "./api";
import type { NodeRegistry } from "./registry";
import type { NodeRuntimeState, NodeSerializeResult } from "./types";
import {
  cloneFlags,
  cloneLayout,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpecs
} from "./utils";
import { serializeWidgetSpecs } from "./widget";

export function serializeNode(
  registry: NodeRegistry,
  node: NodeRuntimeState
): NodeSerializeResult {
  const definition = registry.require(node.type);
  const data: NodeSerializeResult = {
    id: node.id,
    type: node.type,
    title: node.title,
    layout: cloneLayout(node.layout),
    properties: cloneRecord(node.properties),
    propertySpecs: clonePropertySpecs(node.propertySpecs),
    inputs: cloneSlotSpecs(node.inputs),
    outputs: cloneSlotSpecs(node.outputs),
    widgets: serializeWidgetSpecs(registry.widgetRegistry, node.widgets),
    flags: cloneFlags(node.flags),
    data: cloneRecord(node.data)
  };

  const api = createNodeApi(node, {
    definition,
    widgetRegistry: registry.widgetRegistry
  });

  definition.onSerialize?.(node, data, api);
  return data;
}
