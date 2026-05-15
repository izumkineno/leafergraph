/**
 * 图运行时装配模块。
 *
 * @remarks
 * 负责按固定顺序装配主包运行时宿主，并向入口返回精简的 API 宿主。
 */

import { NodeRegistry } from "@leafergraph/core/node";
import type { LeaferGraphWidgetRenderer } from "@leafergraph/core/contracts";
import type { NormalizedLeaferGraphConfig } from "@leafergraph/core/config";
import type {
  LeaferGraphGraphThemeTokens,
  LeaferGraphThemeMode,
  LeaferGraphWidgetThemeContext
} from "@leafergraph/core/theme";
import { LeaferGraphApiHost } from "../../api/graph_api_host";
import { LeaferGraphBootstrapHost } from "../host/bootstrap";
import { LeaferGraphCanvasHost } from "../host/canvas";
import type { GraphLinkViewState } from "../../link/link_host";
import type { NodeViewState } from "../../node/node_host";
import type { NodeShellLayoutMetrics } from "../../node/shell/layout";
import type { NodeShellRenderTheme } from "../../node/shell/view";
import type {
  LeaferGraphDataFlowAnimationStyleConfig,
  LeaferGraphNodeShellStyleConfig
} from "../style";
import type {
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "../types";
import { createLeaferGraphRuntimeApiAssembly } from "./runtime_api";
import { createLeaferGraphRuntimeHistoryCapture } from "./runtime_history";
import { createLeaferGraphSceneRuntimeAssembly } from "./scene";
import { createLeaferGraphWidgetEnvironment } from "./widget_environment";

interface LeaferGraphRuntimeAssemblyOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  container: HTMLElement;
  graphState: GraphRuntimeState<TNodeState>;
  nodeViews: Map<string, NodeViewState<TNodeState>>;
  linkViews: GraphLinkViewState<TNodeState>[];
  config: NormalizedLeaferGraphConfig;
  themeMode?: LeaferGraphThemeMode;
  createMissingWidgetRenderer(): LeaferGraphWidgetRenderer;
  resolveWidgetTheme(mode: LeaferGraphThemeMode): LeaferGraphWidgetThemeContext;
  resolveGraphTheme(mode: LeaferGraphThemeMode): LeaferGraphGraphThemeTokens;
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  nodeShellStyle: LeaferGraphNodeShellStyleConfig;
  resolveCanvasBackground(mode: LeaferGraphThemeMode): string;
  resolveSelectedStroke(mode: LeaferGraphThemeMode): string;
  resolveNodeShellRenderTheme(mode: LeaferGraphThemeMode): NodeShellRenderTheme;
  normalizeLinkSlotIndex(slot: number | undefined): number;
  linkDefaultNodeWidth: number;
  linkPortSize: number;
  linkStroke: string;
  respectReducedMotion: boolean;
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
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createLeaferGraphRuntimeAssembly<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphRuntimeAssemblyOptions<TNodeState>
): LeaferGraphRuntimeAssemblyResult<TNodeState> {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const canvasHost = new LeaferGraphCanvasHost({
    container: options.container,
    fill: options.config.graph.fill,
    themeMode: options.themeMode,
    resolveBackground: options.resolveCanvasBackground,
    leaferAppConfig: options.config.leafer.app,
    leaferTreeConfig: options.config.leafer.tree,
    leaferViewportConfig: options.config.leafer.viewport
  });
  const canvasState = canvasHost.mount();
  const widgetEnvironment = createLeaferGraphWidgetEnvironment({
    app: canvasState.app,
    container: options.container,
    themeMode: options.themeMode,
    widgetConfig: options.config.widget,
    leaferEditorConfig: options.config.leafer.editor,
    leaferTextEditorConfig: options.config.leafer.textEditor,
    createMissingWidgetRenderer: options.createMissingWidgetRenderer,
    resolveWidgetTheme: options.resolveWidgetTheme
  });
  const nodeRegistry = new NodeRegistry(widgetEnvironment.widgetRegistry);
  /**
   * 处理 `requestRender` 相关逻辑。
   *
   * @returns 无返回值。
   */
  const requestRender = (): void => {
    canvasState.app.requestRender(true);
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
    canvasHost,
    widgetEditingManager: widgetEnvironment.widgetEditingManager,
    widgetEditingContext: widgetEnvironment.widgetEditingContext,
    requestRender,
    resolveGraphTheme: options.resolveGraphTheme,
    nodeShellLayoutMetrics: options.nodeShellLayoutMetrics,
    nodeShellStyle: options.nodeShellStyle,
    resolveSelectedStroke: options.resolveSelectedStroke,
    resolveNodeShellRenderTheme: options.resolveNodeShellRenderTheme,
    normalizeLinkSlotIndex: options.normalizeLinkSlotIndex,
    linkDefaultNodeWidth: options.linkDefaultNodeWidth,
    linkPortSize: options.linkPortSize,
    linkStroke: options.linkStroke,
    respectReducedMotion: options.respectReducedMotion,
    dataFlowAnimationStyle: options.dataFlowAnimationStyle
  });
  const bootstrapHost = new LeaferGraphBootstrapHost({
    nodeRegistry,
    widgetRegistry: widgetEnvironment.widgetRegistry,
    replaceGraphDocument: (document) =>
      sceneRuntime.restoreHost.replaceGraphDocument(document)
  });
  const historyCapture = createLeaferGraphRuntimeHistoryCapture({
    nodeRegistry,
    graphState: options.graphState,
    sceneRuntime
  });
  const apiHost = new LeaferGraphApiHost({
    runtime: createLeaferGraphRuntimeApiAssembly({
      app: canvasState.app,
      bootstrapRuntime: bootstrapHost,
      sceneRuntime,
      widgetEnvironment,
      historyCapture,
      nodeRegistry
    }),
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
