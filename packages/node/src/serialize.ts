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

/**
 * 将节点运行时状态转成可持久化结构。
 * 它会主动剔除输入输出缓存，只保留可恢复的静态与配置状态。
 */
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

  // 允许节点在最终输出前做一次补充或裁剪。
  definition.onSerialize?.(node, data, api);
  return data;
}
