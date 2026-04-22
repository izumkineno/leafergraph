/**
 * 节点实例工厂。
 *
 * 它负责把静态 `NodeDefinition` 与调用方传入的 `NodeInit`
 * 合并成真实可执行的 `NodeRuntimeState`。
 */

import { createNodeApi } from "./api.js";
import type { NodeRegistry } from "./registry.js";
import type { NodeInit, NodeRuntimeState } from "./types.js";
import {
  createMissingNodeDefinition,
  cloneFlags,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpecs,
  createDefaultTitle,
  createNodeId,
  createPropertyValues,
  resizeRuntimeValues,
  resolveNodeLayout
} from "./utils.js";
import { normalizeWidgetSpecs } from "./widget.js";

/**
 * 根据注册表中的节点定义创建一个新的节点运行时实例。
 * 这是宿主从静态定义走向真实运行时状态的核心入口。
 *
 * @param registry - 注册表。
 * @param init - `init`。
 * @returns 创建后的结果对象。
 */
export function createNodeState(
  registry: NodeRegistry,
  init: NodeInit
): NodeRuntimeState {
  const definition = registry.get(init.type) ?? createMissingNodeDefinition(init.type);
  const propertySpecs = clonePropertySpecs(init.propertySpecs ?? definition.properties);
  const inputs = cloneSlotSpecs(init.inputs ?? definition.inputs);
  const outputs = cloneSlotSpecs(init.outputs ?? definition.outputs);
  const widgets = normalizeWidgetSpecs(
    registry.widgetDefinitions,
    init.widgets ?? definition.widgets
  );

  // 创建阶段只做数据整形与默认值回填，不包含任何渲染逻辑。
  const node: NodeRuntimeState = {
    id: init.id ?? createNodeId(definition.type, init.existingNodeIds),
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
    widgetDefinitions: registry.widgetDefinitions
  });

  // 生命周期在实例结构就绪后再触发，保证回调可安全访问全部字段。
  definition.onCreate?.(node, api);
  return node;
}
