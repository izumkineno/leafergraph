/**
 * 节点作者层桥接。
 *
 * 这个模块把“开发者编写的作者类”投影成正式 `NodeDefinition`、
 * `NodeModule` 和 `LeaferGraphNodePlugin`，让宿主只消费标准产物，
 * 不直接依赖作者类本身。
 */

import type {
  NodeApi,
  NodeDefinition,
  NodeModule,
  NodeModuleScope,
  NodePropertySpec,
  NodeResizeConfig,
  NodeRuntimeState,
  NodeSerializeResult,
  NodeSlotSpec,
  NodeWidgetSpec,
  SlotDirection
} from "@leafergraph/node";
import type { LeaferGraphExecutionContext } from "@leafergraph/execution";
import { createNodeApi } from "@leafergraph/node";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphNodePluginContext
} from "@leafergraph/contracts";

import {
  assertNonEmptyText,
  assertUniqueNames,
  clonePropertySpecs,
  cloneSlotSpecs,
  cloneStringList,
  cloneWidgetSpecs,
  type NodeInputs,
  type NodeOutputs,
  type NodeProps,
  type NodeState
} from "./shared.js";
import { defineAuthoringWidget, type DevWidgetClass } from "./widget_authoring.js";

/**
 * 作者类静态 `meta` 的描述结构。
 * 它表达的是“这类节点的静态声明”，不是某个运行时实例的当前值。
 */
export interface DevNodeMeta {
  /** 节点类型标识，最终会成为正式 `NodeDefinition.type`。 */
  type: string;
  /** 节点标题。 */
  title: string;
  /** 节点默认分类。 */
  category?: string;
  /** 节点描述。 */
  description?: string;
  /** 便于宿主搜索或分类的关键词。 */
  keywords?: string[];
  /** 节点默认尺寸。 */
  size?: [number, number];
  /** 节点 resize 约束。 */
  resize?: NodeResizeConfig;
  /** 输入槽位声明。 */
  inputs?: NodeSlotSpec[];
  /** 输出槽位声明。 */
  outputs?: NodeSlotSpec[];
  /** 属性声明。 */
  properties?: NodePropertySpec[];
  /** 节点内默认 Widget 声明。 */
  widgets?: NodeWidgetSpec[];
}

/**
 * 节点作者层运行时上下文。
 * 作者类只通过这组上下文读写节点实例，不需要直接理解宿主内部结构。
 */
export interface DevNodeContext<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
> {
  /** 当前节点运行时实例。 */
  node: NodeRuntimeState;
  /** 由底层模型层提供的结构性操作 API。 */
  api: NodeApi;
  /** 当前节点属性对象。 */
  props: P;
  /** 给作者类保留的节点级附加数据。 */
  data: Record<string, unknown>;
  /** 作者类私有状态。 */
  state: S;
  /** 当前执行上下文；非执行阶段可能不存在。 */
  execution?: LeaferGraphExecutionContext;

  /** 按输入槽位名称读取输入值。 */
  getInput<K extends keyof I & string>(name: K): I[K] | undefined;
  /** 按输入槽位序号读取输入值。 */
  getInputAt(slot: number): unknown;
  /** 按输出槽位名称写入输出值。 */
  setOutput<K extends keyof O & string>(name: K, value: O[K]): void;
  /** 按输出槽位序号写入输出值。 */
  setOutputAt(slot: number, value: unknown): void;

  /** 读取当前节点内某个 Widget 的值。 */
  getWidget(name: string): unknown;
  /** 更新当前节点内某个 Widget 的值。 */
  setWidget(name: string, value: unknown): void;

  /** 更新属性值。 */
  setProp<K extends keyof P & string>(name: K, value: P[K]): void;
  /** 读取作者层私有附加数据。 */
  getData<T = unknown>(name: string): T | undefined;
  /** 写入作者层私有附加数据。 */
  setData(name: string, value: unknown): void;
}

/**
 * 节点作者类基类。
 * 外部开发者通过继承它来声明节点行为；宿主最终只消费转换后的标准定义。
 */
export abstract class BaseNode<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
> {
  /** 节点静态元信息。 */
  static meta: DevNodeMeta;

  /**
   *  创建作者层私有状态。
   *
   * @returns 无返回值。
   */
  createState?(): S;

  /**
   *  节点实例初次创建完成后触发。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onCreate?(ctx: DevNodeContext<P, I, O, S>): void;
  /**
   *  节点实例被配置或反序列化时触发。
   *
   * @param data - 当前数据。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onConfigure?(data: NodeSerializeResult, ctx: DevNodeContext<P, I, O, S>): void;
  /**
   *  节点序列化前触发，可覆写最终输出内容。
   *
   * @param data - 当前数据。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onSerialize?(data: NodeSerializeResult, ctx: DevNodeContext<P, I, O, S>): void;
  /**
   *  节点执行阶段触发。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute?(ctx: DevNodeContext<P, I, O, S>): void;
  /**
   *  节点属性变化后触发。
   *
   * @param name - `name`。
   * @param value - 当前值。
   * @param prevValue - 当前值。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onPropertyChanged?(
    name: keyof P & string,
    value: unknown,
    prevValue: unknown,
    ctx: DevNodeContext<P, I, O, S>
  ): boolean | void;
  /**
   *  新增输入槽位后触发。
   *
   * @param input - 输入参数。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onInputAdded?(input: NodeSlotSpec, ctx: DevNodeContext<P, I, O, S>): void;
  /**
   *  新增输出槽位后触发。
   *
   * @param output - 输出参数。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onOutputAdded?(output: NodeSlotSpec, ctx: DevNodeContext<P, I, O, S>): void;
  /**
   *  连线状态变化后触发。
   *
   * @param type - 类型。
   * @param slot - 槽位。
   * @param connected - `connected`。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onConnectionsChange?(
    type: SlotDirection,
    slot: number,
    connected: boolean,
    ctx: DevNodeContext<P, I, O, S>
  ): void;
  /**
   *  宿主发送动作消息时触发。
   *
   * @param action - 动作。
   * @param param - 解构后的输入参数。
   * @param options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onAction?(
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    ctx: DevNodeContext<P, I, O, S>
  ): void;
  /**
   *  宿主发送触发型消息时触发。
   *
   * @param action - 动作。
   * @param param - 解构后的输入参数。
   * @param options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onTrigger?(
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    ctx: DevNodeContext<P, I, O, S>
  ): void;
}

/**
 * 节点作者类构造器类型。
 * 约束作者类必须提供可实例化构造函数和静态 `meta`。
 */
export interface DevNodeClass<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
> {
  new (): BaseNode<P, I, O, S>;
  readonly meta: DevNodeMeta;
}

/** 创建作者层模块时的输入结构。 */
export interface CreateAuthoringModuleOptions {
  /** 可选模块作用域。 */
  scope?: NodeModuleScope;
  /** 需要收口进模块的节点作者类。 */
  nodes: DevNodeClass[];
}

/** 创建作者层插件时的输入结构。 */
export interface CreateAuthoringPluginOptions {
  /** 插件名称。 */
  name: string;
  /** 插件版本。 */
  version?: string;
  /** 可选模块作用域。 */
  scope?: NodeModuleScope;
  /** 需要注册的节点作者类。 */
  nodes?: DevNodeClass[];
  /** 需要注册的 Widget 作者类。 */
  widgets?: DevWidgetClass[];
}

/**
 * 节点实例对应的作者层运行时。
 * 每个 `NodeRuntimeState` 都会关联一个作者类实例和一份作者层私有状态。
 */
interface AuthoringNodeRuntime<
  P extends NodeProps,
  I extends NodeInputs,
  O extends NodeOutputs,
  S extends NodeState
> {
  instance: BaseNode<P, I, O, S>;
  state: S;
}

/**
 * 把节点作者类转换成正式 `NodeDefinition`。
 * 转换结果不再暴露作者类本身，而是标准模型层定义与生命周期桥接。
 *
 * @param NodeCtor - 节点`Ctor`。
 * @returns 定义`Authoring` 节点的结果。
 */
export function defineAuthoringNode<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
>(NodeCtor: DevNodeClass<P, I, O, S>): NodeDefinition {
  // 先整理当前阶段需要的输入、状态与依赖。
  const meta = normalizeNodeMeta(NodeCtor.meta);
  validateNodeMeta(meta);
  const runtimeByNode = new WeakMap<
    NodeRuntimeState,
    AuthoringNodeRuntime<P, I, O, S>
  >();

  /**
   * 读取或懒创建某个节点实例对应的作者层运行时。
   * 这样可以把作者类实例与节点实例一一对应起来。
   *
   * @param node - 节点。
   * @returns 处理后的结果。
   */
  // 再执行核心逻辑，并把结果或副作用统一收口。
  const getRuntime = (node: NodeRuntimeState): AuthoringNodeRuntime<P, I, O, S> => {
    const existing = runtimeByNode.get(node);
    if (existing) {
      return existing;
    }

    const instance = new NodeCtor();
    const runtime = {
      instance,
      state: instance.createState?.() ?? ({} as S)
    };
    runtimeByNode.set(node, runtime);
    return runtime;
  };

  /**
   * 为作者类组装统一上下文。
   * 它负责把模型层 `NodeApi`、节点实例和作者层私有状态收敛成一个稳定接口。
   *
   * @param node - 节点。
   * @param api - API。
   * @param execution - 执行。
   * @returns 创建后的结果对象。
   */
  const createContext = (
    node: NodeRuntimeState,
    api: NodeApi,
    execution?: LeaferGraphExecutionContext
  ): DevNodeContext<P, I, O, S> => {
    // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
    const runtime = getRuntime(node);
    // 再按当前规则组合结果，并把派生数据一并收口到输出里。
    const data = ensureNodeData(node);

    return {
      node,
      api,
      props: node.properties as P,
      data,
      state: runtime.state,
      execution,
      getInput(name) {
        const slot = api.findInputSlot(name);
        if (slot < 0) {
          return undefined;
        }

        return api.getInputData(slot) as I[typeof name] | undefined;
      },
      getInputAt(slot) {
        return api.getInputData(slot);
      },
      setOutput(name, value) {
        const slot = api.findOutputSlot(name);
        if (slot < 0) {
          throw new Error(`未声明的输出槽位: ${name}`);
        }

        api.setOutputData(slot, value);
      },
      setOutputAt(slot, value) {
        api.setOutputData(slot, value);
      },
      getWidget(name) {
        return node.widgets.find((widget) => widget.name === name)?.value;
      },
      setWidget(name, value) {
        const widget = node.widgets.find((item) => item.name === name);
        if (!widget) {
          throw new Error(`未声明的 Widget: ${name}`);
        }

        widget.value = value;
      },
      setProp(name, value) {
        node.properties[name] = value;
      },
      getData<T = unknown>(name: string) {
        return ensureNodeData(node)[name] as T | undefined;
      },
      setData(name, value) {
        ensureNodeData(node)[name] = value;
      }
    };
  };

  /**
   * 在宿主未显式传入 `NodeApi` 时兜底创建一份。
   * 这样动作消息与触发消息等路径也能拿到完整 API。
   *
   * @param node - 节点。
   * @param api - API。
   * @returns 确保API的结果。
   */
  const ensureApi = (node: NodeRuntimeState, api?: NodeApi): NodeApi =>
    api ?? createNodeApi(node);

  return {
    type: meta.type,
    title: meta.title,
    category: meta.category,
    description: meta.description,
    keywords: meta.keywords,
    size: meta.size,
    resize: meta.resize,
    inputs: meta.inputs,
    outputs: meta.outputs,
    properties: meta.properties,
    widgets: meta.widgets,
    onCreate(node, api) {
      const context = createContext(node, api);
      getRuntime(node).instance.onCreate?.(context);
    },
    onConfigure(node, data, api) {
      const context = createContext(node, api);
      getRuntime(node).instance.onConfigure?.(data, context);
    },
    onSerialize(node, data, api) {
      const context = createContext(node, api);
      getRuntime(node).instance.onSerialize?.(data, context);
    },
    onExecute(node, context, api) {
      const safeApi = ensureApi(node, api);
      const safeContext = createContext(
        node,
        safeApi,
        context as LeaferGraphExecutionContext | undefined
      );
      getRuntime(node).instance.onExecute?.(safeContext);
    },
    onPropertyChanged(node, name, value, prevValue, api) {
      const context = createContext(node, api);
      return getRuntime(node).instance.onPropertyChanged?.(
        name as keyof P & string,
        value,
        prevValue,
        context
      );
    },
    onInputAdded(node, input, api) {
      const context = createContext(node, api);
      getRuntime(node).instance.onInputAdded?.(input, context);
    },
    onOutputAdded(node, output, api) {
      const context = createContext(node, api);
      getRuntime(node).instance.onOutputAdded?.(output, context);
    },
    onConnectionsChange(node, type, slot, connected, api) {
      const context = createContext(node, api);
      getRuntime(node).instance.onConnectionsChange?.(type, slot, connected, context);
    },
    onAction(node, action, param, options, api) {
      const safeApi = ensureApi(node, api);
      const context = createContext(
        node,
        safeApi,
        resolveExecutionContextFromActionOptions(options)
      );
      getRuntime(node).instance.onAction?.(action, param, options, context);
    },
    onTrigger(node, action, param, options, api) {
      const safeApi = ensureApi(node, api);
      const context = createContext(
        node,
        safeApi,
        resolveExecutionContextFromActionOptions(options)
      );
      getRuntime(node).instance.onTrigger?.(action, param, options, context);
    }
  };
}

/**
 * 把一组节点作者类组装成正式 `NodeModule`。
 * 这里不处理 Widget，只处理节点定义和可选作用域。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createAuthoringModule(options: CreateAuthoringModuleOptions): NodeModule {
  return {
    scope: options.scope,
    nodes: options.nodes.map((NodeCtor) => defineAuthoringNode(NodeCtor))
  };
}

/**
 * 把节点作者类与 Widget 作者类组装成主包可安装的插件。
 * 宿主只需安装插件，不需要自行理解作者类桥接细节。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createAuthoringPlugin(
  options: CreateAuthoringPluginOptions
): LeaferGraphNodePlugin {
  const name = assertNonEmptyText(options.name, "插件名称");
  const widgets = options.widgets?.map((WidgetCtor) => defineAuthoringWidget(WidgetCtor)) ?? [];
  const module =
    options.nodes && options.nodes.length
      ? createAuthoringModule({
          scope: options.scope,
          nodes: options.nodes
        })
      : undefined;

  return {
    name,
    version: options.version?.trim() || undefined,
    install(context: LeaferGraphNodePluginContext) {
      for (const entry of widgets) {
        context.registerWidget(entry);
      }

      if (module) {
        context.installModule(module);
      }
    }
  };
}

/**
 * 规范化节点元信息。
 * 这里会裁剪文本字段，并深拷贝数组 / 对象字段，避免宿主持有外部可变引用。
 *
 * @param meta - `meta`。
 * @returns 处理后的结果。
 */
function normalizeNodeMeta(meta: DevNodeMeta): DevNodeMeta {
  const type = assertNonEmptyText(meta.type, "节点类型");
  const title = assertNonEmptyText(meta.title, "节点标题");

  return {
    type,
    title,
    category: meta.category?.trim() || undefined,
    description: meta.description?.trim() || undefined,
    keywords: cloneStringList(meta.keywords),
    size: meta.size ? [meta.size[0], meta.size[1]] : undefined,
    resize: meta.resize ? { ...meta.resize } : undefined,
    inputs: cloneSlotSpecs(meta.inputs),
    outputs: cloneSlotSpecs(meta.outputs),
    properties: clonePropertySpecs(meta.properties),
    widgets: cloneWidgetSpecs(meta.widgets)
  };
}

/**
 *  校验节点元信息里按名称索引的声明项是否唯一。
 *
 * @param meta - `meta`。
 * @returns 无返回值。
 */
function validateNodeMeta(meta: DevNodeMeta): void {
  assertUniqueNames(meta.inputs ?? [], "输入槽位");
  assertUniqueNames(meta.outputs ?? [], "输出槽位");
  assertUniqueNames(meta.widgets ?? [], "Widget");
}

/**
 * 确保节点拥有作者层可写的 `data` 容器。
 * 这个容器只保存作者层附加数据，不改变正式结构字段。
 *
 * @param node - 节点。
 * @returns 确保节点数据的结果。
 */
function ensureNodeData(node: NodeRuntimeState): Record<string, unknown> {
  if (!node.data) {
    node.data = {};
  }

  return node.data;
}

/**
 * 从动作选项解析执行上下文。
 *
 * @param options - 可选配置项。
 * @returns 处理后的结果。
 */
function resolveExecutionContextFromActionOptions(
  options: Record<string, unknown> | undefined
): LeaferGraphExecutionContext | undefined {
  if (!options || typeof options !== "object") {
    return undefined;
  }

  const executionContext = options.executionContext;
  if (!executionContext || typeof executionContext !== "object") {
    return undefined;
  }

  return executionContext as LeaferGraphExecutionContext;
}
