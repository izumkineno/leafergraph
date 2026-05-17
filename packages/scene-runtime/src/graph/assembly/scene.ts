/**
 * 图场景运行时装配模块。
 *
 * @remarks
 * 负责把节点、连线、Widget、主题和交互这些真正依赖场景对象的宿主接起来，
 * 让主装配器只保留“先准备基础环境，再串联场景运行时，再对外暴露 API”三段式结构。
 */

import { NodeRegistry } from "@leafergraph/core/node";
import type { LeaferGraphWidgetEditingContext } from "@leafergraph/core/contracts";
import type {
  LeaferGraphGraphThemeTokens,
  LeaferGraphThemeMode
} from "@leafergraph/core/theme";
import type { LeaferGraphGraphExecutionHost } from "@leafergraph/core/execution";
import type { LeaferGraphLinkDataFlowAnimationHost } from "@leafergraph/link-animation";
import type { LeaferGraphNodeRuntimeHost } from "@leafergraph/node-runtime";
import {
  LeaferGraphWidgetHost,
  type LeaferGraphWidgetEditingManager,
  type LeaferGraphWidgetRegistry
} from "@leafergraph/core/widget-runtime";
import { LeaferGraphInteractionRuntimeHost } from "../../interaction/graph_interaction_runtime_host";
import { LeaferGraphInteractionHost } from "../../interaction/interaction_host";
import { createLeaferGraphInteractionCommitSource } from "../../interaction/interaction_commit_source";
import { LeaferGraphLinkHost, type GraphLinkViewState } from "../../link/link_host";
import { LeaferGraphNodeHost, type NodeViewState } from "../../node/node_host";
import { LeaferGraphNodeShellHost } from "../../node/shell/host";
import type { NodeShellLayoutMetrics } from "../../node/shell/layout";
import type { NodeShellRenderTheme } from "../../node/shell/view";
import type { LeaferGraphCanvasState } from "../host/canvas";
import type { LeaferGraphCanvasHost } from "../host/canvas";
import { LeaferGraphMutationHost } from "../host/mutation";
import type {
  LeaferGraphDataFlowAnimationStyleConfig,
  LeaferGraphNodeShellStyleConfig
} from "../style";
import type {
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "../types";
import { LeaferGraphSceneHost } from "../host/scene";
import { LeaferGraphSceneRuntimeHost } from "../host/scene_runtime";
import { LeaferGraphRestoreHost } from "../host/restore";
import type { LeaferGraphThemeHost } from "../theme/host";
import { LeaferGraphViewHost } from "../host/view";
import type { LeaferGraphRuntimeFeedbackHost } from "../feedback/local_runtime_adapter";
import { createLeaferGraphExecutionChainAssembly } from "./scene_execution";
import { createLeaferGraphSceneInteractionAssembly } from "./scene_interaction";

/**
 * 图场景运行时装配输入。
 *
 * @remarks
 * 这部分依赖都已经处于“基础环境准备完成”状态：
 * 画布层、主题宿主、Widget 注册表、编辑宿主和图状态容器都由外层准备好。
 */
export interface LeaferGraphSceneRuntimeAssemblyOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  container: HTMLElement;
  graphState: GraphRuntimeState<TNodeState>;
  nodeViews: Map<string, NodeViewState<TNodeState>>;
  linkViews: GraphLinkViewState<TNodeState>[];
  canvasState: LeaferGraphCanvasState;
  canvasHost: LeaferGraphCanvasHost;
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  themeHost: LeaferGraphThemeHost;
  widgetEditingManager: LeaferGraphWidgetEditingManager;
  widgetEditingContext: LeaferGraphWidgetEditingContext;
  requestRender(): void;
  resolveGraphTheme(mode: LeaferGraphThemeMode): LeaferGraphGraphThemeTokens;
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  nodeShellStyle: LeaferGraphNodeShellStyleConfig;
  resolveSelectedStroke(mode: LeaferGraphThemeMode): string;
  resolveNodeShellRenderTheme(mode: LeaferGraphThemeMode): NodeShellRenderTheme;
  normalizeLinkSlotIndex(slot: number | undefined): number;
  linkDefaultNodeWidth: number;
  linkPortSize: number;
  linkStroke: string;
  respectReducedMotion: boolean;
  dataFlowAnimationStyle: LeaferGraphDataFlowAnimationStyleConfig;
}

/**
 * 图场景运行时装配结果。
 *
 * @remarks
 * 外层主装配器只需要继续把这些宿主接给 bootstrap 和 API facade 即可。
 */
export interface LeaferGraphSceneRuntimeAssemblyResult<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  nodeShellHost: LeaferGraphNodeShellHost<TNodeState>;
  widgetHost: LeaferGraphWidgetHost;
  viewHost: LeaferGraphViewHost<TNodeState, NodeViewState<TNodeState>>;
  sceneRuntimeHost: LeaferGraphSceneRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  nodeRuntimeHost: LeaferGraphNodeRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  runtimeFeedbackHost: LeaferGraphRuntimeFeedbackHost;
  dataFlowAnimationHost: LeaferGraphLinkDataFlowAnimationHost<TNodeState>;
  graphExecutionHost: LeaferGraphGraphExecutionHost<TNodeState>;
  interactionHost: LeaferGraphInteractionHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  interactionRuntimeHost: LeaferGraphInteractionRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  interactionCommitSource: ReturnType<
    typeof createLeaferGraphInteractionCommitSource
  >;
  restoreHost: LeaferGraphRestoreHost<TNodeState, NodeViewState<TNodeState>>;
}

/**
 * 创建图场景运行时宿主集合。
 *
 * @param options - 场景运行时装配输入。
 * @returns 已接线完成的场景运行时宿主集合。
 */
export function createLeaferGraphSceneRuntimeAssembly<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphSceneRuntimeAssemblyOptions<TNodeState>
): LeaferGraphSceneRuntimeAssemblyResult<TNodeState> {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  let interactionHost!: LeaferGraphInteractionHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  let sceneHost!: LeaferGraphSceneHost<
    TNodeState,
    NodeViewState<TNodeState>,
    GraphLinkViewState<TNodeState>
  >;
  let sceneRuntimeHost!: LeaferGraphSceneRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  let nodeRuntimeHost!: LeaferGraphNodeRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  const interactionCommitSource = createLeaferGraphInteractionCommitSource();

  const widgetHost = new LeaferGraphWidgetHost({
    registry: options.widgetRegistry,
    getTheme: () => options.themeHost.getWidgetTheme(),
    getEditing: () => options.widgetEditingContext,
    setNodeWidgetValue: (nodeId, widgetIndex, newValue) => {
      sceneRuntimeHost.setNodeWidgetValue(nodeId, widgetIndex, newValue);
    },
    commitNodeWidgetValue: (nodeId, widgetIndex, commit) => {
      const node = options.graphState.nodes.get(nodeId);
      if (!node) {
        return;
      }

      const nextValue =
        commit.newValue === undefined
          ? node.widgets[widgetIndex]?.value
          : commit.newValue;

      if (
        !sceneRuntimeHost.setNodeWidgetValue(nodeId, widgetIndex, nextValue)
      ) {
        return;
      }

      const afterWidgets = structuredClone(node.widgets);
      const afterValue = afterWidgets[widgetIndex]?.value;
      if (
        Object.is(commit.beforeValue, afterValue) &&
        JSON.stringify(commit.beforeWidgets) === JSON.stringify(afterWidgets)
      ) {
        return;
      }

      interactionCommitSource.emit({
        type: "node.widget.commit",
        nodeId,
        widgetIndex,
        beforeValue: commit.beforeValue,
        afterValue,
        beforeWidgets: commit.beforeWidgets,
        afterWidgets
      });
    },
    requestRender: options.requestRender,
    emitNodeWidgetAction: (nodeId, action, param, extra) =>
      nodeRuntimeHost.emitNodeWidgetAction(nodeId, action, param, extra)
  });

  const nodeShellHost = new LeaferGraphNodeShellHost<TNodeState>({
    container: options.container,
    nodeViews: options.nodeViews,
    nodeRegistry: options.nodeRegistry,
    layoutMetrics: options.nodeShellLayoutMetrics,
    style: options.nodeShellStyle,
    getThemeMode: () => options.themeHost.getMode(),
    resolveSelectedStroke: options.resolveSelectedStroke,
    resolveRenderTheme: options.resolveNodeShellRenderTheme,
    resolveNodeExecutionState: (nodeId) =>
      nodeRuntimeHost.getNodeExecutionState(nodeId),
    canResizeNode: (nodeId) => nodeRuntimeHost.canResizeNode(nodeId),
    isNodeResizing: (nodeId) => interactionHost.isResizingNode(nodeId),
    requestRender: options.requestRender,
    respectReducedMotion: options.respectReducedMotion
  });

  const viewHost = new LeaferGraphViewHost({
    app: options.canvasState.app,
    graphNodes: options.graphState.nodes,
    nodeViews: options.nodeViews,
    applyNodeSelectionStyles: (state) =>
      nodeShellHost.applyNodeShellStatusStyles(state),
    requestRender: options.requestRender
  });

  const nodeHost = new LeaferGraphNodeHost<TNodeState>({
    nodeViews: options.nodeViews,
    nodeLayer: options.canvasState.nodeLayer,
    layoutMetrics: options.nodeShellLayoutMetrics,
    buildNodeShell: (node, shellLayout) =>
      nodeShellHost.buildNodeShell(node, shellLayout),
    isMissingNodeType: (node) => nodeShellHost.isMissingNodeType(node),
    renderNodeWidgets: (node, widgetLayer, shellLayout) =>
      widgetHost.renderNodeWidgets(node, widgetLayer, shellLayout.widgets),
    destroyNodeWidgets: (state) =>
      widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer),
    onNodeViewCreated: (state) => {
      nodeShellHost.applyNodeShellStatusStyles(state);
      viewHost.bringNodeViewToFront(state);
    },
    onNodeMounted: (nodeId, state) => {
      interactionHost.bindNodeDragging(nodeId, state.view);
      interactionHost.bindNodePorts(nodeId, state);
      interactionHost.bindNodeResize(nodeId, state);
      interactionHost.bindNodeCollapseToggle(nodeId, state);
      interactionHost.bindNodeTitleEdit(nodeId, state);
    },
    onNodeRefreshed: (nodeId, state) => {
      interactionHost.bindNodePorts(nodeId, state);
      interactionHost.bindNodeResize(nodeId, state);
      interactionHost.bindNodeCollapseToggle(nodeId, state);
      interactionHost.bindNodeTitleEdit(nodeId, state);
      nodeShellHost.applyNodeShellStatusStyles(state);
    }
  });

  const linkHost = new LeaferGraphLinkHost<TNodeState>({
    graphLinks: options.graphState.links,
    linkViews: options.linkViews,
    linkLayer: options.canvasState.linkLayer,
    getNode: (nodeId) => options.graphState.nodes.get(nodeId),
    normalizeSlotIndex: options.normalizeLinkSlotIndex,
    layoutMetrics: options.nodeShellLayoutMetrics,
    defaultNodeWidth: options.linkDefaultNodeWidth,
    portSize: options.linkPortSize,
    resolveLinkStroke: () =>
      options.resolveGraphTheme(options.themeHost.getMode()).linkStroke,
    resolveSlotTypeFillMap: () =>
      options.resolveGraphTheme(options.themeHost.getMode()).nodeShellStyle.slotTypeFillMap,
    resolveGenericPortFill: () =>
      options.resolveGraphTheme(options.themeHost.getMode()).nodeShellStyle.genericPortFill
  });

  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  sceneHost = new LeaferGraphSceneHost({
    nodeViews: options.nodeViews,
    nodeHost,
    linkHost,
    widgetHost
  });

  const mutationHost = new LeaferGraphMutationHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    nodeRegistry: options.nodeRegistry,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    nodeViews: options.nodeViews,
    mountNodeView: (node) => sceneHost.mountNodeView(node),
    unmountNodeView: (nodeId) => sceneHost.unmountNodeView(nodeId),
    refreshNodeView: (state) => sceneHost.refreshNodeView(state),
    setNodeWidgetValue: (nodeId, widgetIndex, newValue) =>
      sceneHost.setNodeWidgetValue(nodeId, widgetIndex, newValue),
    commitNodeWidgetValue: (nodeId, widgetIndex, commit) =>
      sceneHost.commitNodeWidgetValue(nodeId, widgetIndex, commit),
    renameNode: (nodeId, newTitle) => sceneHost.renameNode(nodeId, newTitle),
    mountLinkView: (link) => sceneHost.mountLinkView(link),
    removeLinkInternal: (linkId) => sceneHost.removeLink(linkId),
    updateConnectedLinks: (nodeId) => sceneHost.updateConnectedLinks(nodeId),
    updateConnectedLinksForNodes: (nodeIds) =>
      sceneHost.updateConnectedLinksForNodes(nodeIds),
    handleNodeRemoved: (nodeId) => {
      interactionHost.handleNodeRemoved(nodeId);
      nodeRuntimeHost.clearNodeExecutionState(nodeId);
    },
    handleLinkCreated: (link) => nodeRuntimeHost.notifyLinkCreated(link),
    handleLinkRemoved: (link) => nodeRuntimeHost.notifyLinkRemoved(link),
    requestRender: options.requestRender,
    resolveNodeResizeConstraint: (node) =>
      nodeShellHost.resolveNodeResizeConstraint(node)
  });

  sceneRuntimeHost = new LeaferGraphSceneRuntimeHost({
    graphDocument: options.graphState.document,
    graphNodes: options.graphState.nodes,
    nodeViews: options.nodeViews,
    sceneHost,
    mutationHost,
    requestRender: options.requestRender,
    notifyNodeStateChanged: (nodeId, reason) =>
      nodeRuntimeHost.notifyNodeStateChanged(nodeId, reason)
  });

  const executionChain = createLeaferGraphExecutionChainAssembly({
    container: options.container,
    graphState: options.graphState,
    nodeViews: options.nodeViews,
    canvasState: options.canvasState,
    nodeRegistry: options.nodeRegistry,
    widgetRegistry: options.widgetRegistry,
    themeHost: options.themeHost,
    sceneRuntimeHost,
    nodeShellHost,
    requestRender: options.requestRender,
    resolveGraphTheme: options.resolveGraphTheme,
    nodeShellLayoutMetrics: options.nodeShellLayoutMetrics,
    linkDefaultNodeWidth: options.linkDefaultNodeWidth,
    linkPortSize: options.linkPortSize,
    respectReducedMotion: options.respectReducedMotion,
    dataFlowAnimationStyle: options.dataFlowAnimationStyle
  });
  nodeRuntimeHost = executionChain.nodeRuntimeHost;
  const runtimeFeedbackHost = executionChain.runtimeFeedbackHost;
  const dataFlowAnimationHost = executionChain.dataFlowAnimationHost;
  const graphExecutionHost = executionChain.graphExecutionHost;

  const sceneInteraction = createLeaferGraphSceneInteractionAssembly({
    container: options.container,
    graphState: options.graphState,
    nodeViews: options.nodeViews,
    linkViews: options.linkViews,
    canvasState: options.canvasState,
    canvasHost: options.canvasHost,
    nodeRegistry: options.nodeRegistry,
    themeHost: options.themeHost,
    widgetEditingManager: options.widgetEditingManager,
    nodeShellHost,
    viewHost,
    sceneHost,
    sceneRuntimeHost,
    nodeRuntimeHost,
    graphExecutionHost,
    dataFlowAnimationHost,
    widgetHost,
    interactionCommitSource,
    requestRender: options.requestRender,
    nodeShellLayoutMetrics: options.nodeShellLayoutMetrics,
    nodeShellStyle: options.nodeShellStyle,
    resolveSelectedStroke: options.resolveSelectedStroke
  });
  interactionHost = sceneInteraction.interactionHost;
  const interactionRuntimeHost = sceneInteraction.interactionRuntimeHost;
  const restoreHost = sceneInteraction.restoreHost;

  return {
    nodeShellHost,
    widgetHost,
    viewHost,
    sceneRuntimeHost,
    nodeRuntimeHost,
    runtimeFeedbackHost,
    dataFlowAnimationHost,
    graphExecutionHost,
    interactionHost,
    interactionRuntimeHost,
    interactionCommitSource,
    restoreHost
  };
}
