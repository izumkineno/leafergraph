/**
 * `LeaferGraphApiHost` registry helper。
 *
 * @remarks
 * 负责插件、模块、节点和 widget 的注册与查询能力。
 */

import type {
  LeaferGraphApiHostContext,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiModuleInput,
  LeaferGraphApiNodeRegistration,
  LeaferGraphApiNodeViewState,
  LeaferGraphApiPlugin,
  LeaferGraphApiWidgetRegistration
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { LeaferGraphWidgetEntry } from "@leafergraph/contracts";
import type { NodeDefinition } from "@leafergraph/node";

/**
 * 安装一个外部节点插件。
 *
 * @param context - 当前 API 宿主上下文。
 * @param plugin - 需要安装的节点插件。
 * @returns 插件安装完成后的异步结果。
 */
export async function useLeaferGraphApiPlugin<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  plugin: LeaferGraphApiPlugin
): Promise<void> {
  return context.options.runtime.bootstrapRuntime.use(plugin);
}

/**
 * 安装一个静态节点模块。
 *
 * @param context - 当前 API 宿主上下文。
 * @param input - 模块安装输入。
 * @returns 无返回值。
 */
export function installLeaferGraphApiModule<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  input: LeaferGraphApiModuleInput
): void {
  context.options.runtime.bootstrapRuntime.installModule(
    input.module,
    input.options
  );
}

/**
 * 注册一个节点定义。
 *
 * @param context - 当前 API 宿主上下文。
 * @param input - 节点注册输入。
 * @returns 无返回值。
 */
export function registerLeaferGraphApiNode<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  input: LeaferGraphApiNodeRegistration
): void {
  context.options.runtime.bootstrapRuntime.registerNode(
    input.definition,
    input.options
  );
}

/**
 * 注册一个完整 widget 条目。
 *
 * @param context - 当前 API 宿主上下文。
 * @param input - widget 注册输入。
 * @returns 无返回值。
 */
export function registerLeaferGraphApiWidget<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  input: LeaferGraphApiWidgetRegistration
): void {
  context.options.runtime.bootstrapRuntime.registerWidget(
    input.entry,
    input.options
  );
}

/**
 * 查询一个 widget 条目。
 *
 * @param context - 当前 API 宿主上下文。
 * @param type - 目标 widget 类型。
 * @returns 匹配到的 widget 条目。
 */
export function getLeaferGraphApiWidget<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  type: string
): LeaferGraphWidgetEntry | undefined {
  return context.options.runtime.bootstrapRuntime.getWidget(type);
}

/**
 * 列出当前全部 widget 条目。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 当前已注册的 widget 列表。
 */
export function listLeaferGraphApiWidgets<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): LeaferGraphWidgetEntry[] {
  return context.options.runtime.bootstrapRuntime.listWidgets();
}

/**
 * 列出当前全部已注册节点定义。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 当前已注册的节点定义列表。
 */
export function listLeaferGraphApiNodes<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): NodeDefinition[] {
  return context.options.runtime.bootstrapRuntime.listNodes();
}
