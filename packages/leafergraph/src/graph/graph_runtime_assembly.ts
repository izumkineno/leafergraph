/**
 * 图运行时装配模块。
 *
 * @remarks
 * 负责按固定顺序装配主包运行时宿主，并向入口返回精简的 API 宿主。
 */

import { NodeRegistry } from "@leafergraph/node";
import { LeaferGraphLocalExecutionFeedbackAdapter } from "@leafergraph/execution";
import type {
  LeaferGraphWidgetRenderer
} from "@leafergraph/contracts";
import type { NormalizedLeaferGraphConfig } from "@leafergraph/config";
import type {
  LeaferGraphGraphThemeTokens,
  LeaferGraphThemeMode,
  LeaferGraphWidgetThemeContext
} from "@leafergraph/theme";
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
import {
  createHistoryRecordEvent,
  createLeaferGraphHistorySource,
  createLinkCreateHistoryRecord,
  createNodeCollapseHistoryRecord,
  createNodeMoveCommitHistoryRecord,
  createNodeResizeHistoryRecord,
  createNodeWidgetHistoryRecord,
  serializeRuntimeGraphDocument
} from "./graph_history";
import { createLeaferGraphSceneRuntimeAssembly } from "./graph_scene_runtime_assembly";
import { createLeaferGraphWidgetEnvironment } from "./graph_widget_runtime_host";

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
    canvasState.app.forceRender();
  };
  /**
   * 处理 `renderFrame` 相关逻辑。
   *
   * @returns 无返回值。
   */
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
    canvasHost,
    widgetEditingManager: widgetEnvironment.widgetEditingManager,
    widgetEditingContext: widgetEnvironment.widgetEditingContext,
    requestRender,
    renderFrame,
    resolveGraphTheme: options.resolveGraphTheme,
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
  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
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
  const historySource = createLeaferGraphHistorySource();
  /**
   * 获取图文档。
   *
   * @returns 处理后的结果。
   */
  const getGraphDocument = () =>
    serializeRuntimeGraphDocument(nodeRegistry, options.graphState);
  const disposeHistoryCapture = sceneRuntime.interactionCommitSource.subscribe(
    (event) => {
      switch (event.type) {
        case "node.move.commit": {
          const record = createNodeMoveCommitHistoryRecord({
            entries: event.entries,
            source: "interaction.commit"
          });
          if (record) {
            historySource.emit(createHistoryRecordEvent(record));
          }
          return;
        }
        case "node.resize.commit": {
          const record = createNodeResizeHistoryRecord({
            nodeId: event.nodeId,
            before: event.before,
            after: event.after,
            source: "interaction.commit"
          });
          if (record) {
            historySource.emit(createHistoryRecordEvent(record));
          }
          return;
        }
        case "node.collapse.commit": {
          const afterDocument = getGraphDocument();
          const record = createNodeCollapseHistoryRecord({
            afterDocument,
            nodeId: event.nodeId,
            beforeCollapsed: event.beforeCollapsed,
            afterCollapsed: event.afterCollapsed,
            source: "interaction.commit"
          });
          if (record) {
            historySource.emit(createHistoryRecordEvent(record));
          }
          return;
        }
        case "node.widget.commit": {
          const afterDocument = getGraphDocument();
          const record = createNodeWidgetHistoryRecord({
            afterDocument,
            nodeId: event.nodeId,
            beforeWidgets: event.beforeWidgets,
            afterWidgets: event.afterWidgets,
            source: "interaction.commit"
          });
          if (record) {
            historySource.emit(createHistoryRecordEvent(record));
          }
          return;
        }
        case "link.create.commit": {
          try {
            const link = sceneRuntime.sceneRuntimeHost.createLink(
              event.input,
              "interaction.commit"
            );
            const record = createLinkCreateHistoryRecord({
              link,
              source: "interaction.commit"
            });
            historySource.emit(createHistoryRecordEvent(record));
          } catch {
            // 当前阶段让正式交互事件继续可观测，但不重复抛出运行时错误。
          }
          return;
        }
      }
    }
  );
  const apiRuntime: LeaferGraphApiRuntime<TNodeState> = {
    app: canvasState.app,
    bootstrapRuntime: bootstrapHost,
    getGraphDocument,
    runtimeAdapter,
    widgetEditingManager: widgetEnvironment.widgetEditingManager,
    sceneRuntime: sceneRuntime.sceneRuntimeHost,
    historySource,
    destroyHistoryCapture: disposeHistoryCapture,
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
