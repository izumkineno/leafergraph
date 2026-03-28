/**
 * 图运行时装配模块。
 *
 * @remarks
 * 负责按固定顺序装配主包运行时宿主，并向入口返回精简的 API 宿主。
 */

import { NodeRegistry } from "@leafergraph/node";
import { LeaferGraphLocalExecutionFeedbackAdapter } from "@leafergraph/execution";
import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetEditingOptions,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetThemeContext
} from "../api/plugin";
import {
  LeaferGraphApiHost,
  type LeaferGraphApiRuntime
} from "../api/graph_api_host";
import { LeaferGraphBootstrapHost } from "./graph_bootstrap_host";
import { LeaferGraphCanvasHost } from "./graph_canvas_host";
import type { GraphLinkViewState } from "../link/link_host";
import type { NodeViewState } from "../node/node_host";
import type { NodeShellLayoutMetrics } from "../node/node_layout";
import type { NodeShellRenderTheme } from "../node/node_shell";
import type {
  LeaferGraphDataFlowAnimationStyleConfig,
  LeaferGraphNodeShellStyleConfig
} from "./graph_runtime_style";
import type {
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "./graph_runtime_types";
import { LeaferGraphLocalRuntimeAdapter } from "./graph_local_runtime_adapter";
import { createLeaferGraphSceneRuntimeAssembly } from "./graph_scene_runtime_assembly";
import { createLeaferGraphWidgetEnvironment } from "./graph_widget_runtime_host";

interface LeaferGraphRuntimeAssemblyOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  container: HTMLElement;
  graphState: GraphRuntimeState<TNodeState>;
  nodeViews: Map<string, NodeViewState<TNodeState>>;
  linkViews: GraphLinkViewState<TNodeState>[];
  fill?: string;
  themeMode?: LeaferGraphThemeMode;
  widgetEditing?: LeaferGraphWidgetEditingOptions;
  viewportMinScale: number;
  viewportMaxScale: number;
  createMissingWidgetRenderer(): LeaferGraphWidgetRenderer;
  resolveWidgetTheme(mode: LeaferGraphThemeMode): LeaferGraphWidgetThemeContext;
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  nodeShellStyle: LeaferGraphNodeShellStyleConfig;
  resolveSelectedStroke(mode: LeaferGraphThemeMode): string;
  resolveNodeShellRenderTheme(mode: LeaferGraphThemeMode): NodeShellRenderTheme;
  normalizeLinkSlotIndex(slot: number | undefined): number;
  linkDefaultNodeWidth: number;
  linkPortSize: number;
  linkStroke: string;
  dataFlowAnimationStyle: LeaferGraphDataFlowAnimationStyleConfig;
}

export interface LeaferGraphRuntimeAssemblyResult<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  app: ReturnType<LeaferGraphCanvasHost["mount"]>["app"];
  root: ReturnType<LeaferGraphCanvasHost["mount"]>["root"];
  linkLayer: ReturnType<LeaferGraphCanvasHost["mount"]>["linkLayer"];
  nodeLayer: ReturnType<LeaferGraphCanvasHost["mount"]>["nodeLayer"];
  apiHost: LeaferGraphApiHost<TNodeState, NodeViewState<TNodeState>>;
}

/**
 * LeaferGraph 运行时装配器。
 * 这层专门负责把各宿主按固定顺序接起来，避免入口文件继续堆长构造函数。
 */
export function createLeaferGraphRuntimeAssembly<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphRuntimeAssemblyOptions<TNodeState>
): LeaferGraphRuntimeAssemblyResult<TNodeState> {
  const canvasState = new LeaferGraphCanvasHost({
    container: options.container,
    fill: options.fill,
    viewportMinScale: options.viewportMinScale,
    viewportMaxScale: options.viewportMaxScale
  }).mount();
  const widgetEnvironment = createLeaferGraphWidgetEnvironment({
    app: canvasState.app,
    container: options.container,
    themeMode: options.themeMode,
    widgetEditing: options.widgetEditing,
    createMissingWidgetRenderer: options.createMissingWidgetRenderer,
    resolveWidgetTheme: options.resolveWidgetTheme
  });
  const nodeRegistry = new NodeRegistry(widgetEnvironment.widgetRegistry);
  const requestRender = (): void => {
    canvasState.app.forceRender();
  };
  const renderFrame = (): void => {
    canvasState.app.forceUpdate();
    canvasState.app.forceRender(undefined, true);
  };
  const sceneRuntime = createLeaferGraphSceneRuntimeAssembly({
    container: options.container,
    graphState: options.graphState,
    nodeViews: options.nodeViews,
    linkViews: options.linkViews,
    canvasState,
    nodeRegistry,
    widgetRegistry: widgetEnvironment.widgetRegistry,
    themeHost: widgetEnvironment.themeHost,
    widgetEditingManager: widgetEnvironment.widgetEditingManager,
    widgetEditingContext: widgetEnvironment.widgetEditingContext,
    requestRender,
    renderFrame,
    nodeShellLayoutMetrics: options.nodeShellLayoutMetrics,
    nodeShellStyle: options.nodeShellStyle,
    resolveSelectedStroke: options.resolveSelectedStroke,
    resolveNodeShellRenderTheme: options.resolveNodeShellRenderTheme,
    normalizeLinkSlotIndex: options.normalizeLinkSlotIndex,
    linkDefaultNodeWidth: options.linkDefaultNodeWidth,
    linkPortSize: options.linkPortSize,
    linkStroke: options.linkStroke,
    dataFlowAnimationStyle: options.dataFlowAnimationStyle
  });
  const bootstrapHost = new LeaferGraphBootstrapHost({
    nodeRegistry,
    widgetRegistry: widgetEnvironment.widgetRegistry,
    replaceGraphDocument: (document) =>
      sceneRuntime.restoreHost.replaceGraphDocument(document)
  });
  const executionAdapter = new LeaferGraphLocalExecutionFeedbackAdapter({
    subscribeNodeExecution: (listener) =>
      sceneRuntime.nodeRuntimeHost.subscribeNodeExecution(listener),
    subscribeGraphExecution: (listener) =>
      sceneRuntime.graphExecutionRuntimeHost.subscribeGraphExecution(listener),
    subscribeLinkPropagation: (listener) =>
      sceneRuntime.nodeRuntimeHost.subscribeLinkPropagation(listener)
  });
  const runtimeAdapter = new LeaferGraphLocalRuntimeAdapter({
    executionAdapter,
    subscribeNodeState: (listener) =>
      sceneRuntime.nodeRuntimeHost.subscribeNodeState(listener)
  });
  const apiRuntime: LeaferGraphApiRuntime<TNodeState> = {
    app: canvasState.app,
    bootstrapRuntime: bootstrapHost,
    runtimeAdapter,
    widgetEditingManager: widgetEnvironment.widgetEditingManager,
    sceneRuntime: sceneRuntime.sceneRuntimeHost,
    interactionCommitSource: sceneRuntime.interactionCommitSource,
    interactionHost: sceneRuntime.interactionHost,
    interactionRuntime: sceneRuntime.interactionRuntimeHost,
    nodeRuntimeHost: sceneRuntime.nodeRuntimeHost,
    dataFlowAnimationHost: sceneRuntime.dataFlowAnimationHost,
    graphExecutionHost: sceneRuntime.graphExecutionRuntimeHost,
    themeHost: widgetEnvironment.themeHost,
    viewHost: sceneRuntime.viewHost,
    widgetHost: sceneRuntime.widgetHost
  };
  const apiHost = new LeaferGraphApiHost({
    runtime: apiRuntime,
    nodeViews: options.nodeViews,
    linkViews: options.linkViews
  });

  return {
    app: canvasState.app,
    root: canvasState.root,
    linkLayer: canvasState.linkLayer,
    nodeLayer: canvasState.nodeLayer,
    apiHost
  };
}
