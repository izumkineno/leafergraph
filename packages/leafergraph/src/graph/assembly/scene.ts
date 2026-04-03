/**
 * 图场景运行时装配模块。
 *
 * @remarks
 * 负责把节点、连线、Widget、主题和交互这些真正依赖场景对象的宿主接起来，
 * 让主装配器只保留“先准备基础环境，再串联场景运行时，再对外暴露 API”三段式结构。
 */

import { NodeRegistry } from "@leafergraph/node";
import type { LeaferGraphWidgetEditingContext } from "@leafergraph/contracts";
import type {
  LeaferGraphGraphThemeTokens,
  LeaferGraphThemeMode
} from "@leafergraph/theme";
import { LeaferGraphGraphExecutionHost } from "@leafergraph/execution";
import {
  LeaferGraphWidgetHost,
  type LeaferGraphWidgetEditingManager,
  type LeaferGraphWidgetRegistry
} from "@leafergraph/widget-runtime";
import { LeaferGraphInteractionRuntimeHost } from "../../interaction/graph_interaction_runtime_host";
import { LeaferGraphInteractionHost } from "../../interaction/interaction_host";
import { createLeaferGraphInteractionCommitSource } from "../../interaction/interaction_commit_source";
import { LeaferGraphLinkDataFlowAnimationHost } from "../../link/animation/controller";
import { LeaferGraphLinkHost, type GraphLinkViewState } from "../../link/link_host";
import { LeaferGraphNodeHost, type NodeViewState } from "../../node/node_host";
import { LeaferGraphNodeRuntimeHost } from "../../node/runtime/controller";
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
import { LeaferGraphThemeRuntimeHost } from "../theme/runtime";
import { LeaferGraphViewHost } from "../host/view";

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
  renderFrame(): void;
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
  let dataFlowAnimationHost!: LeaferGraphLinkDataFlowAnimationHost<TNodeState>;
  let graphExecutionHost!: LeaferGraphGraphExecutionHost<TNodeState>;
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
    nodeRegistry: options.nodeRegistry,
    layoutMetrics: options.nodeShellLayoutMetrics,
    style: options.nodeShellStyle,
    getThemeMode: () => options.themeHost.getMode(),
    resolveSelectedStroke: options.resolveSelectedStroke,
    resolveRenderTheme: options.resolveNodeShellRenderTheme,
    resolveNodeExecutionState: (nodeId) =>
      nodeRuntimeHost.getNodeExecutionState(nodeId),
    canResizeNode: (nodeId) => nodeRuntimeHost.canResizeNode(nodeId),
    isNodeResizing: (nodeId) => interactionHost.isResizingNode(nodeId)
  });

  const viewHost = new LeaferGraphViewHost({
    app: options.canvasState.app,
    graphNodes: options.graphState.nodes,
    nodeViews: options.nodeViews,
    applyNodeSelectionStyles: (state) =>
      nodeShellHost.applyNodeSelectionStyles(state),
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
      nodeShellHost.applyNodeSelectionStyles(state);
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
      nodeShellHost.applyNodeSelectionStyles(state);
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

  nodeRuntimeHost = new LeaferGraphNodeRuntimeHost({
    nodeRegistry: options.nodeRegistry,
    widgetRegistry: options.widgetRegistry,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    nodeViews: options.nodeViews,
    sceneRuntime: sceneRuntimeHost,
    resolveNodeResizeConstraint: (node) =>
      nodeShellHost.resolveNodeResizeConstraint(node)
  });

  dataFlowAnimationHost = new LeaferGraphLinkDataFlowAnimationHost({
    container: options.container,
    linkLayer: options.canvasState.linkLayer,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    layoutMetrics: options.nodeShellLayoutMetrics,
    defaultNodeWidth: options.linkDefaultNodeWidth,
    portSize: options.linkPortSize,
    resolveLinkStroke: () =>
      options.resolveGraphTheme(options.themeHost.getMode()).linkStroke,
    resolveSlotTypeFillMap: () =>
      options.resolveGraphTheme(options.themeHost.getMode()).nodeShellStyle.slotTypeFillMap,
    resolveStyle: () => {
      const graphTheme = options.resolveGraphTheme(options.themeHost.getMode());
      const preset = options.dataFlowAnimationStyle.preset;

      return options.dataFlowAnimationStyle.enabled
        ? graphTheme.dataFlowAnimationStyles[preset]
        : {
            ...graphTheme.dataFlowAnimationStyles.performance,
            ...options.dataFlowAnimationStyle
          };
    },
    respectReducedMotion: options.respectReducedMotion,
    getThemeMode: () => options.themeHost.getMode(),
    requestRender: options.requestRender,
    renderFrame: options.renderFrame,
    subscribeLinkPropagation: (listener) =>
      nodeRuntimeHost.subscribeLinkPropagation(listener)
  });

  graphExecutionHost = new LeaferGraphGraphExecutionHost({
    nodeExecutionHost: nodeRuntimeHost
  });

  const interactionRuntimeHost = new LeaferGraphInteractionRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    nodeViews: options.nodeViews,
    linkLayer: options.canvasState.linkLayer,
    bringNodeViewToFront: (state) => viewHost.bringNodeViewToFront(state),
    syncNodeResizeHandleVisibility: (state) =>
      nodeShellHost.syncNodeResizeHandleVisibility(state),
    requestRender: options.requestRender,
    resolveDraggedNodeIds: (nodeId) => viewHost.resolveDraggedNodeIds(nodeId),
    listSelectedNodeIds: () => viewHost.listSelectedNodeIds(),
    isNodeSelected: (nodeId) => viewHost.isNodeSelected(nodeId),
    setSelectedNodeIds: (nodeIds, mode) =>
      viewHost.setSelectedNodeIds(nodeIds, mode),
    clearSelectedNodes: () => viewHost.clearSelectedNodes(),
    sceneRuntime: sceneRuntimeHost,
    setNodeCollapsed: (nodeId, collapsed) =>
      sceneRuntimeHost.setNodeCollapsed(nodeId, collapsed),
    beginNodeTitleEdit: (nodeId) => {
      const state = options.nodeViews.get(nodeId);
      if (!state || !options.widgetEditingManager.enabled) {
        return;
      }

      const originalTitle = state.state.title;
      const titleLabel = state.shellView.titleLabel;
      if (!titleLabel) {
        return;
      }
      
      const headerHeight =
        options.nodeShellLayoutMetrics.headerHeight;

      const textWidth = titleLabel.width ?? (originalTitle.length * 10);
      const textHeight = titleLabel.height ?? headerHeight;

      options.widgetEditingManager.beginTextEdit({
        nodeId,
        widgetIndex: -1,
        value: originalTitle,
        readOnly: false,
        multiline: false,
        maxLength: 100,
        target: titleLabel,
        frame: {
          width: Math.max(textWidth + 20, 120),
          height: textHeight,
          offsetX: 0,
          offsetY: -8,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4
        },
        placeholder: "Enter node title",
        onCommit: (newTitleRaw) => {
          let trimmedTitle = newTitleRaw.trim();
          if (!trimmedTitle) {
            trimmedTitle = originalTitle;
          }

          trimmedTitle = trimmedTitle.replace(/[\r\n]/g, " ").slice(0, 100);

          if (trimmedTitle === originalTitle) {
            return;
          }

          sceneRuntimeHost.updateNode(nodeId, { title: trimmedTitle });
          interactionCommitSource.emit({
            type: "node.rename.commit",
            nodeId,
            beforeTitle: originalTitle,
            afterTitle: trimmedTitle
          });
        },
        onCancel: () => {}
      });
    },
    canResizeNode: (nodeId) => nodeRuntimeHost.canResizeNode(nodeId),
    getPagePointByClient: (event) => viewHost.getPagePointByClient(event),
    getPagePointFromGraphEvent: (event) =>
      viewHost.getPagePointFromGraphEvent(event),
    resolveNodeSize: (state) => ({
      width:
        state.state.layout.width ?? options.nodeShellStyle.defaultNodeWidth,
      height:
        state.state.layout.height ??
        options.nodeShellStyle.defaultNodeMinHeight
    }),
    slotTypeFillMap: options.nodeShellStyle.slotTypeFillMap,
    genericPortFill: options.nodeShellStyle.genericPortFill,
    resolveConnectionPreviewStrokeFallback: () =>
      options.resolveSelectedStroke(options.themeHost.getMode())
  });

  interactionHost = new LeaferGraphInteractionHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    container: options.container,
    runtime: interactionRuntimeHost,
    selectionLayer: options.canvasState.selectionLayer,
    resolveSelectionStroke: () =>
      options.resolveSelectedStroke(options.themeHost.getMode()),
    requestRender: options.requestRender,
    emitInteractionCommit: (event) => interactionCommitSource.emit(event)
  });

  const themeRuntimeHost = new LeaferGraphThemeRuntimeHost({
    widgetEditingManager: options.widgetEditingManager,
    canvasHost: options.canvasHost,
    sceneRuntime: sceneRuntimeHost
  });
  options.themeHost.attachRuntime(themeRuntimeHost);

  const restoreHost = new LeaferGraphRestoreHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    nodeRegistry: options.nodeRegistry,
    graphDocument: options.graphState.document,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    nodeViews: options.nodeViews,
    linkViews: options.linkViews,
    clearInteractionState: () => interactionHost.clearInteractionState(),
    resetRuntimeState: () => viewHost.resetViewState(),
    resetNodeExecutionStates: () => nodeRuntimeHost.clearAllExecutionStates(),
    resetGraphExecutionState: () => graphExecutionHost.resetState(),
    destroyNodeViewWidgets: (state) =>
      widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer),
    clearNodeLayer: () => options.canvasState.nodeLayer.removeAll(),
    clearLinkLayer: () => {
      dataFlowAnimationHost.clear();
      options.canvasState.linkLayer.removeAll();
      dataFlowAnimationHost.restoreLayer();
      interactionRuntimeHost.restoreConnectionPreviewLayer();
    },
    mountNodeView: (node) => sceneHost.mountNodeView(node),
    mountLinkView: (link) => sceneHost.mountLinkView(link),
    handleLinkRestored: (link) => nodeRuntimeHost.notifyLinkCreated(link),
    requestRender: options.requestRender
  });

  return {
    widgetHost,
    viewHost,
    sceneRuntimeHost,
    nodeRuntimeHost,
    dataFlowAnimationHost,
    graphExecutionHost,
    interactionHost,
    interactionRuntimeHost,
    interactionCommitSource,
    restoreHost
  };
}
