/**
 * 图运行时 API 壳面装配模块。
 *
 * @remarks
 * 负责把 scene runtime、Widget 环境和 history capture 收口为
 * `LeaferGraphApiHost` 需要的最小 runtime 壳面。
 */

import type { NodeRegistry } from "@leafergraph/core/node";
import type { LeaferGraphApiRuntime } from "../../api/graph_api_host";
import type { LeaferGraphRenderableNodeState } from "../types";
import type { LeaferGraphBootstrapRuntimeLike } from "../host/bootstrap";
import type { LeaferGraphSceneRuntimeAssemblyResult } from "./scene";
import type { LeaferGraphWidgetEnvironment } from "./widget_environment";
import type { LeaferGraphRuntimeHistoryCapture } from "./runtime_history";

/**
 * 图运行时 API 壳面装配输入。
 */
export interface LeaferGraphRuntimeApiAssemblyOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  app: LeaferGraphApiRuntime<TNodeState>["app"];
  bootstrapRuntime: LeaferGraphBootstrapRuntimeLike;
  sceneRuntime: LeaferGraphSceneRuntimeAssemblyResult<TNodeState>;
  widgetEnvironment: LeaferGraphWidgetEnvironment;
  historyCapture: LeaferGraphRuntimeHistoryCapture;
  nodeRegistry: NodeRegistry;
}

/**
 * 组装 `LeaferGraphApiHost` 依赖的最小 runtime。
 *
 * @param options - API runtime 装配输入。
 * @returns API host 使用的 runtime 壳面。
 */
export function createLeaferGraphRuntimeApiAssembly<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphRuntimeApiAssemblyOptions<TNodeState>
): LeaferGraphApiRuntime<TNodeState> {
  const {
    app,
    bootstrapRuntime,
    sceneRuntime,
    widgetEnvironment,
    historyCapture,
    nodeRegistry
  } = options;

  return {
    app,
    bootstrapRuntime,
    getGraphDocument: historyCapture.getGraphDocument,
    runtimeFeedbackHost: sceneRuntime.runtimeFeedbackHost,
    widgetEditingManager: widgetEnvironment.widgetEditingManager,
    sceneRuntime: sceneRuntime.sceneRuntimeHost,
    historySource: historyCapture.historySource,
    destroyHistoryCapture: historyCapture.destroyHistoryCapture,
    interactionCommitSource: sceneRuntime.interactionCommitSource,
    interactionHost: sceneRuntime.interactionHost,
    interactionRuntime: sceneRuntime.interactionRuntimeHost,
    nodeRuntimeHost: sceneRuntime.nodeRuntimeHost,
    nodeShellHost: sceneRuntime.nodeShellHost,
    dataFlowAnimationHost: sceneRuntime.dataFlowAnimationHost,
    graphExecutionHost: sceneRuntime.graphExecutionHost,
    themeHost: widgetEnvironment.themeHost,
    viewHost: sceneRuntime.viewHost,
    widgetHost: sceneRuntime.widgetHost,
    nodeRegistry,
    widgetRegistry: widgetEnvironment.widgetRegistry,
    nodeExecutionHost: sceneRuntime.nodeRuntimeHost
  };
}
