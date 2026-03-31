/**
 * `LeaferGraphApiHost` 生命周期 helper。
 *
 * @remarks
 * 负责把初始化和销毁顺序从入口类中移走，让 facade 文件只保留状态拥有权。
 */

import type { LeaferGraphApiHostContext } from "./types";
import type {
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState
} from "./types";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { LeaferGraphOptions } from "@leafergraph/contracts";

/**
 * 执行启动期安装流程并恢复初始图数据。
 *
 * @param context - 当前 API 宿主上下文。
 * @param options - 主包初始化配置。
 * @returns 启动完成后返回的异步结果。
 */
export function initializeLeaferGraphApiHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>,
  options: LeaferGraphOptions
): Promise<void> {
  return context.options.runtime.bootstrapRuntime.initialize(options);
}

/**
 * 按统一顺序销毁当前 API 宿主依赖的全部运行时资源。
 *
 * @param context - 当前 API 宿主上下文。
 * @returns 无返回值。
 */
export function destroyLeaferGraphApiHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState
>(
  context: LeaferGraphApiHostContext<TNodeState, TNodeViewState, TLinkViewState>
): void {
  const runtime = context.options.runtime;

  for (const state of context.options.nodeViews.values()) {
    runtime.widgetHost.destroyNodeWidgets(
      state.widgetInstances,
      state.widgetLayer
    );
  }

  runtime.runtimeAdapter.destroy?.();
  runtime.destroyHistoryCapture();
  runtime.interactionHost.destroy();
  runtime.dataFlowAnimationHost.destroy();
  runtime.widgetEditingManager.destroy();
  runtime.historySource.destroy();
  runtime.app.destroy();
}
