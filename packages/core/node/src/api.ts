/**
 * 节点运行时 API 工厂。
 *
 * 这里负责把可变的 `NodeRuntimeState` 包装成一组稳定方法，
 * 供生命周期钩子、执行器和宿主工具层共同调用。
 */

import type { NodeDefinition } from "./definition.js";
import type { NodeApi } from "./lifecycle.js";
import type {
  NodePropertySpec,
  NodeRuntimeState,
  NodeSlotSpec,
  NodeWidgetSpec,
  SlotType
} from "./types.js";
import {
  clonePropertySpec,
  cloneSlotSpec,
  cloneWidgetSpec,
  resizeRuntimeValues
} from "./utils.js";
import { type WidgetDefinitionReader, normalizeWidgetSpec } from "./widget.js";

/**
 * 创建 `NodeApi` 时的额外上下文。
 * 宿主可以按需注入定义对象和 Widget 注册表，让 API 在运行时补充校验与钩子。
 */
export interface CreateNodeApiOptions {
  /** 当前节点对应的正式定义；用于触发生命周期钩子。 */
  definition?: NodeDefinition;
  /** Widget 定义读取器；用于归一化运行时新增 Widget。 */
  widgetDefinitions?: WidgetDefinitionReader;
  /** 输出值写入后的宿主回调。 */
  onSetOutputData?(slot: number, data: unknown): void;
}

/**
 * 为节点运行时状态创建一组可操作 API。
 * 这些 API 会被生命周期钩子和宿主逻辑共同复用。
 *
 * @param node - 节点。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createNodeApi(
  node: NodeRuntimeState,
  options: CreateNodeApiOptions = {}
): NodeApi {
  const api: NodeApi = {
    addInput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec {
      const input = createSlotSpec(name, type, extra);
      node.inputs.push(input);
      node.inputValues = resizeRuntimeValues(node.inputValues, node.inputs.length);
      // 槽位结构变化后立即同步运行时输入缓存，避免索引错位。
      options.definition?.onInputAdded?.(node, input, api);
      return input;
    },
    addOutput(name: string, type?: SlotType, extra?: Partial<NodeSlotSpec>): NodeSlotSpec {
      const output = createSlotSpec(name, type, extra);
      node.outputs.push(output);
      node.outputValues = resizeRuntimeValues(node.outputValues, node.outputs.length);
      // 输出端同样需要保持缓存长度和槽位数量一致。
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
        // 同名属性视为覆写声明，避免同一实例里出现重复定义。
        node.propertySpecs[index] = nextSpec;
      } else {
        node.propertySpecs.push(nextSpec);
      }

      if (nextSpec.default !== undefined && node.properties[nextSpec.name] === undefined) {
        node.properties[nextSpec.name] = nextSpec.default;
      }
    },
    addWidget(spec: NodeWidgetSpec): void {
      const nextSpec = options.widgetDefinitions
        ? normalizeWidgetSpec(options.widgetDefinitions, spec)
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
      // 宿主可在这里把输出同步到连线、调试面板或执行调度器。
      options.onSetOutputData?.(slot, data);
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

/**
 * 以宿主统一的拷贝规则创建槽位声明。
 * 这样运行时新增的槽位也能与静态定义保持同一份结构语义。
 *
 * @param name - `name`。
 * @param type - 类型。
 * @param extra - `extra`。
 * @returns 创建后的结果对象。
 */
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
