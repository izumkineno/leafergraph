import { createNodeApi } from "./api.js";
import type { NodeRegistry } from "./registry.js";
import type { NodeRuntimeState, NodeSerializeResult } from "./types.js";
import {
  createMissingNodeDefinition,
  cloneFlags,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpecs,
  createDefaultTitle,
  createPropertyValues,
  resizeRuntimeValues,
  resolveNodeLayout
} from "./utils.js";
import { normalizeWidgetSpecs } from "./widget.js";

/**
 * 重新配置节点实例时允许传入的数据结构。
 * 它要求至少提供 `type`，其余字段都可以按需增量覆盖。
 */
export type NodeConfigureInput = Partial<NodeSerializeResult> &
  Pick<NodeSerializeResult, "type">;

/**
 * 按节点定义和覆写数据重新配置一个既有节点实例。
 * 该函数会同步刷新属性、槽位、Widget 和运行时缓存，并触发 `onConfigure`。
 */
export function configureNode(
  registry: NodeRegistry,
  node: NodeRuntimeState,
  data: NodeConfigureInput
): NodeRuntimeState {
  const definition = registry.get(data.type) ?? createMissingNodeDefinition(data.type);
  const propertySpecs = clonePropertySpecs(
    data.propertySpecs ?? node.propertySpecs ?? definition.properties
  );

  // 先根据传入数据与定义回填静态结构，再重建运行时缓存。
  node.id = data.id ?? node.id;
  node.type = definition.type;
  node.title = data.title ?? node.title ?? definition.title ?? createDefaultTitle(definition.type);
  node.layout = resolveNodeLayout(definition, data.layout, node.layout);
  node.propertySpecs = propertySpecs;
  node.properties = createPropertyValues(propertySpecs, data.properties ?? node.properties);
  node.inputs = cloneSlotSpecs(data.inputs ?? node.inputs ?? definition.inputs);
  node.outputs = cloneSlotSpecs(data.outputs ?? node.outputs ?? definition.outputs);
  node.widgets = normalizeWidgetSpecs(
    registry.widgetDefinitions,
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
    widgetDefinitions: registry.widgetDefinitions
  });

  // 传给生命周期钩子的结构必须是安全副本，避免用户回调无意污染宿主状态。
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
      widgets: normalizeWidgetSpecs(registry.widgetDefinitions, node.widgets),
      flags: cloneFlags(node.flags),
      data: cloneRecord(node.data)
    },
    api
  );

  return node;
}
