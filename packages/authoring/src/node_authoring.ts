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
import { createNodeApi } from "@leafergraph/node";
import type {
  LeaferGraphExecutionContext,
  LeaferGraphNodePlugin,
  LeaferGraphNodePluginContext
} from "leafergraph";

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

export interface DevNodeMeta {
  type: string;
  title: string;
  category?: string;
  description?: string;
  keywords?: string[];
  size?: [number, number];
  resize?: NodeResizeConfig;
  inputs?: NodeSlotSpec[];
  outputs?: NodeSlotSpec[];
  properties?: NodePropertySpec[];
  widgets?: NodeWidgetSpec[];
}

export interface DevNodeContext<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
> {
  node: NodeRuntimeState;
  api: NodeApi;
  props: P;
  data: Record<string, unknown>;
  state: S;
  execution?: LeaferGraphExecutionContext;

  getInput<K extends keyof I & string>(name: K): I[K] | undefined;
  getInputAt(slot: number): unknown;
  setOutput<K extends keyof O & string>(name: K, value: O[K]): void;
  setOutputAt(slot: number, value: unknown): void;

  getWidget(name: string): unknown;
  setWidget(name: string, value: unknown): void;

  setProp<K extends keyof P & string>(name: K, value: P[K]): void;
  getData<T = unknown>(name: string): T | undefined;
  setData(name: string, value: unknown): void;
}

export abstract class BaseNode<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
> {
  static meta: DevNodeMeta;

  createState?(): S;

  onCreate?(ctx: DevNodeContext<P, I, O, S>): void;
  onConfigure?(data: NodeSerializeResult, ctx: DevNodeContext<P, I, O, S>): void;
  onSerialize?(data: NodeSerializeResult, ctx: DevNodeContext<P, I, O, S>): void;
  onExecute?(ctx: DevNodeContext<P, I, O, S>): void;
  onPropertyChanged?(
    name: keyof P & string,
    value: unknown,
    prevValue: unknown,
    ctx: DevNodeContext<P, I, O, S>
  ): boolean | void;
  onInputAdded?(input: NodeSlotSpec, ctx: DevNodeContext<P, I, O, S>): void;
  onOutputAdded?(output: NodeSlotSpec, ctx: DevNodeContext<P, I, O, S>): void;
  onConnectionsChange?(
    type: SlotDirection,
    slot: number,
    connected: boolean,
    ctx: DevNodeContext<P, I, O, S>
  ): void;
  onAction?(
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    ctx: DevNodeContext<P, I, O, S>
  ): void;
  onTrigger?(
    action: string,
    param: unknown,
    options: Record<string, unknown> | undefined,
    ctx: DevNodeContext<P, I, O, S>
  ): void;
}

export interface DevNodeClass<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
> {
  new (): BaseNode<P, I, O, S>;
  readonly meta: DevNodeMeta;
}

export interface CreateAuthoringModuleOptions {
  scope?: NodeModuleScope;
  nodes: DevNodeClass[];
}

export interface CreateAuthoringPluginOptions {
  name: string;
  version?: string;
  scope?: NodeModuleScope;
  nodes?: DevNodeClass[];
  widgets?: DevWidgetClass[];
}

interface AuthoringNodeRuntime<
  P extends NodeProps,
  I extends NodeInputs,
  O extends NodeOutputs,
  S extends NodeState
> {
  instance: BaseNode<P, I, O, S>;
  state: S;
}

export function defineAuthoringNode<
  P extends NodeProps = NodeProps,
  I extends NodeInputs = NodeInputs,
  O extends NodeOutputs = NodeOutputs,
  S extends NodeState = NodeState
>(NodeCtor: DevNodeClass<P, I, O, S>): NodeDefinition {
  const meta = normalizeNodeMeta(NodeCtor.meta);
  validateNodeMeta(meta);
  const runtimeByNode = new WeakMap<
    NodeRuntimeState,
    AuthoringNodeRuntime<P, I, O, S>
  >();

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

  const createContext = (
    node: NodeRuntimeState,
    api: NodeApi,
    execution?: LeaferGraphExecutionContext
  ): DevNodeContext<P, I, O, S> => {
    const runtime = getRuntime(node);
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
      const context = createContext(node, safeApi);
      getRuntime(node).instance.onAction?.(action, param, options, context);
    },
    onTrigger(node, action, param, options, api) {
      const safeApi = ensureApi(node, api);
      const context = createContext(node, safeApi);
      getRuntime(node).instance.onTrigger?.(action, param, options, context);
    }
  };
}

export function createAuthoringModule(options: CreateAuthoringModuleOptions): NodeModule {
  return {
    scope: options.scope,
    nodes: options.nodes.map((NodeCtor) => defineAuthoringNode(NodeCtor))
  };
}

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

function validateNodeMeta(meta: DevNodeMeta): void {
  assertUniqueNames(meta.inputs ?? [], "输入槽位");
  assertUniqueNames(meta.outputs ?? [], "输出槽位");
  assertUniqueNames(meta.widgets ?? [], "Widget");
}

function ensureNodeData(node: NodeRuntimeState): Record<string, unknown> {
  if (!node.data) {
    node.data = {};
  }

  return node.data;
}
