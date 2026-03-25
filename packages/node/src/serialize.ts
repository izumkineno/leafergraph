/**
 * 节点序列化入口。
 *
 * 它把宿主持有的运行时实例裁剪成稳定的可恢复结构，
 * 并允许节点定义在最终落盘前做一次输出修整。
 */

import { createNodeApi } from "./api.js";
import type { NodeRegistry } from "./registry.js";
import type { NodeRuntimeState, NodeSerializeResult } from "./types.js";
import {
  createMissingNodeDefinition,
  cloneFlags,
  cloneLayout,
  clonePropertySpecs,
  cloneRecord,
  cloneSlotSpecs
} from "./utils.js";
import { serializeWidgetSpecs } from "./widget.js";

/**
 * 将节点运行时状态转成可持久化结构。
 * 它会主动剔除输入输出缓存，只保留可恢复的静态与配置状态。
 */
export function serializeNode(
  registry: NodeRegistry,
  node: NodeRuntimeState
): NodeSerializeResult {
  const definition = registry.get(node.type) ?? createMissingNodeDefinition(node.type);
  const data: NodeSerializeResult = {
    id: node.id,
    type: node.type,
    title: node.title,
    layout: cloneLayout(node.layout),
    properties: cloneRecord(node.properties),
    propertySpecs: clonePropertySpecs(node.propertySpecs),
    inputs: cloneSlotSpecs(node.inputs),
    outputs: cloneSlotSpecs(node.outputs),
    widgets: serializeWidgetSpecs(registry.widgetDefinitions, node.widgets),
    flags: cloneFlags(node.flags),
    data: cloneRecord(node.data)
  };

  const api = createNodeApi(node, {
    definition,
    widgetDefinitions: registry.widgetDefinitions
  });

  // 允许节点在最终输出前做一次补充或裁剪。
  definition.onSerialize?.(node, data, api);
  return data;
}
