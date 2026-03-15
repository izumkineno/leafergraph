import { NodeRegistry } from "@leafergraph/node";
import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetEditingContext,
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
import { LeaferGraphMutationHost } from "./graph_mutation_host";
import {
  LeaferGraphInteractionRuntimeHost
} from "../interaction/graph_interaction_runtime_host";
import { LeaferGraphSceneHost } from "./graph_scene_host";
import { LeaferGraphSceneRuntimeHost } from "./graph_scene_runtime_host";
import { LeaferGraphThemeHost } from "./graph_theme_host";
import {
  LeaferGraphThemeRuntimeHost
} from "./graph_theme_runtime_host";
import { LeaferGraphNodeRuntimeHost } from "../node/node_runtime_host";
import { LeaferGraphRestoreHost } from "./graph_restore_host";
import { LeaferGraphViewHost } from "./graph_view_host";
import { LeaferGraphInteractionHost } from "../interaction/interaction_host";
import {
  LeaferGraphLinkHost,
  type GraphLinkViewState
} from "../link/link_host";
import {
  LeaferGraphNodeHost,
  type NodeViewState
} from "../node/node_host";
import { LeaferGraphNodeShellHost } from "../node/node_shell_host";
import type { NodeShellLayoutMetrics } from "../node/node_layout";
import type { NodeShellRenderTheme } from "../node/node_shell";
import type { LeaferGraphNodeShellStyleConfig } from "./graph_runtime_style";
import type {
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "./graph_runtime_types";
import {
  LeaferGraphWidgetHost
} from "../widgets/widget_host";
import { LeaferGraphWidgetRegistry } from "../widgets/widget_registry";
import {
  LeaferGraphWidgetEditingManager,
  resolveWidgetEditingOptions
} from "../widgets/widget_editing";

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
  const widgetRegistry = new LeaferGraphWidgetRegistry(
    options.createMissingWidgetRenderer()
  );
  const nodeRegistry = new NodeRegistry(widgetRegistry);
  const resolvedEditing = resolveWidgetEditingOptions(
    options.themeMode ?? "light",
    options.widgetEditing
  );
  const themeHost = new LeaferGraphThemeHost({
    initialMode: resolvedEditing.themeMode,
    resolveWidgetTheme: options.resolveWidgetTheme
  });
  const canvasState = new LeaferGraphCanvasHost({
    container: options.container,
    fill: options.fill,
    viewportMinScale: options.viewportMinScale,
    viewportMaxScale: options.viewportMaxScale
  }).mount();
  const requestRender = (): void => {
    canvasState.app.forceRender();
  };
  const widgetEditingManager = new LeaferGraphWidgetEditingManager({
    app: canvasState.app,
    container: options.container,
    theme: themeHost.getWidgetTheme(),
    editing: resolvedEditing.editing
  });
  const widgetEditingContext: LeaferGraphWidgetEditingContext =
    widgetEditingManager;

  let interactionHost!: LeaferGraphInteractionHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  let sceneHost!: LeaferGraphSceneHost<
    TNodeState,
    NodeViewState<TNodeState>,
    GraphLinkViewState<TNodeState>
  >;
  let mutationHost!: LeaferGraphMutationHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  let sceneRuntimeHost!: LeaferGraphSceneRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  let nodeRuntimeHost!: LeaferGraphNodeRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;

  const widgetHost = new LeaferGraphWidgetHost({
    registry: widgetRegistry,
    getTheme: () => themeHost.getWidgetTheme(),
    getEditing: () => widgetEditingContext,
    setNodeWidgetValue: (nodeId, widgetIndex, newValue) => {
      sceneRuntimeHost.setNodeWidgetValue(nodeId, widgetIndex, newValue);
    },
    requestRender,
    emitNodeWidgetAction: (nodeId, action, param, extra) =>
      nodeRuntimeHost.emitNodeWidgetAction(nodeId, action, param, extra)
  });
  const nodeShellHost = new LeaferGraphNodeShellHost<TNodeState>({
    nodeRegistry,
    layoutMetrics: options.nodeShellLayoutMetrics,
    style: options.nodeShellStyle,
    getThemeMode: () => themeHost.getMode(),
    resolveSelectedStroke: options.resolveSelectedStroke,
    resolveRenderTheme: options.resolveNodeShellRenderTheme,
    canResizeNode: (nodeId) => nodeRuntimeHost.canResizeNode(nodeId),
    isNodeResizing: (nodeId) => interactionHost.isResizingNode(nodeId)
  });
  const viewHost = new LeaferGraphViewHost({
    app: canvasState.app,
    graphNodes: options.graphState.nodes,
    nodeViews: options.nodeViews,
    applyNodeSelectionStyles: (state) =>
      nodeShellHost.applyNodeSelectionStyles(state),
    requestRender
  });
  const nodeHost = new LeaferGraphNodeHost<TNodeState>({
    nodeViews: options.nodeViews,
    nodeLayer: canvasState.nodeLayer,
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
      interactionHost.bindNodeResize(nodeId, state);
      interactionHost.bindNodeCollapseToggle(nodeId, state);
    },
    onNodeRefreshed: (nodeId, state) => {
      interactionHost.bindNodeResize(nodeId, state);
      interactionHost.bindNodeCollapseToggle(nodeId, state);
      nodeShellHost.applyNodeSelectionStyles(state);
    }
  });
  const linkHost = new LeaferGraphLinkHost<TNodeState>({
    graphLinks: options.graphState.links,
    linkViews: options.linkViews,
    linkLayer: canvasState.linkLayer,
    getNode: (nodeId) => options.graphState.nodes.get(nodeId),
    normalizeSlotIndex: options.normalizeLinkSlotIndex,
    layoutMetrics: options.nodeShellLayoutMetrics,
    defaultNodeWidth: options.linkDefaultNodeWidth,
    portSize: options.linkPortSize,
    stroke: options.linkStroke
  });
  sceneHost = new LeaferGraphSceneHost({
    nodeViews: options.nodeViews,
    nodeHost,
    linkHost,
    widgetHost
  });
  mutationHost = new LeaferGraphMutationHost<TNodeState, NodeViewState<TNodeState>>({
    nodeRegistry,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    nodeViews: options.nodeViews,
    mountNodeView: (node) => sceneHost.mountNodeView(node),
    unmountNodeView: (nodeId) => sceneHost.unmountNodeView(nodeId),
    refreshNodeView: (state) => sceneHost.refreshNodeView(state),
    mountLinkView: (link) => sceneHost.mountLinkView(link),
    removeLinkInternal: (linkId) => sceneHost.removeLink(linkId),
    updateConnectedLinks: (nodeId) => sceneHost.updateConnectedLinks(nodeId),
    updateConnectedLinksForNodes: (nodeIds) =>
      sceneHost.updateConnectedLinksForNodes(nodeIds),
    handleNodeRemoved: (nodeId) => interactionHost.handleNodeRemoved(nodeId),
    requestRender,
    resolveNodeResizeConstraint: (node) =>
      nodeShellHost.resolveNodeResizeConstraint(node)
  });
  sceneRuntimeHost = new LeaferGraphSceneRuntimeHost({
    graphNodes: options.graphState.nodes,
    nodeViews: options.nodeViews,
    sceneHost,
    mutationHost,
    requestRender
  });
  nodeRuntimeHost = new LeaferGraphNodeRuntimeHost({
    nodeRegistry,
    widgetRegistry,
    graphNodes: options.graphState.nodes,
    nodeViews: options.nodeViews,
    sceneRuntime: sceneRuntimeHost,
    resolveNodeResizeConstraint: (node) =>
      nodeShellHost.resolveNodeResizeConstraint(node)
  });
  const interactionRuntimeHost = new LeaferGraphInteractionRuntimeHost({
    nodeViews: options.nodeViews,
    bringNodeViewToFront: (state) => viewHost.bringNodeViewToFront(state),
    syncNodeResizeHandleVisibility: (state) =>
      nodeShellHost.syncNodeResizeHandleVisibility(state),
    requestRender,
    resolveDraggedNodeIds: (nodeId) => viewHost.resolveDraggedNodeIds(nodeId),
    sceneRuntime: sceneRuntimeHost,
    setNodeCollapsed: (nodeId, collapsed) =>
      nodeRuntimeHost.setNodeCollapsed(nodeId, collapsed),
    canResizeNode: (nodeId) => nodeRuntimeHost.canResizeNode(nodeId),
    getPagePointByClient: (event) => viewHost.getPagePointByClient(event),
    getPagePointFromGraphEvent: (event) =>
      viewHost.getPagePointFromGraphEvent(event),
    resolveNodeSize: (state) => ({
      width:
        state.state.layout.width ?? options.nodeShellStyle.defaultNodeWidth,
      height:
        state.state.layout.height ?? options.nodeShellStyle.defaultNodeMinHeight
    })
  });
  interactionHost = new LeaferGraphInteractionHost({
    container: options.container,
    runtime: interactionRuntimeHost
  });
  const themeRuntimeHost = new LeaferGraphThemeRuntimeHost({
    widgetEditingManager,
    sceneRuntime: sceneRuntimeHost
  });
  themeHost.attachRuntime(themeRuntimeHost);
  const restoreHost = new LeaferGraphRestoreHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    nodeRegistry,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    nodeViews: options.nodeViews,
    linkViews: options.linkViews,
    clearInteractionState: () => interactionHost.clearInteractionState(),
    resetRuntimeState: () => viewHost.resetViewState(),
    destroyNodeViewWidgets: (state) =>
      widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer),
    clearNodeLayer: () => canvasState.nodeLayer.removeAll(),
    clearLinkLayer: () => canvasState.linkLayer.removeAll(),
    mountNodeView: (node) => sceneHost.mountNodeView(node),
    mountLinkView: (link) => sceneHost.mountLinkView(link)
  });
  const bootstrapHost = new LeaferGraphBootstrapHost({
    nodeRegistry,
    widgetRegistry,
    restoreGraph: (graph) => restoreHost.restoreGraph(graph)
  });
  const apiRuntime: LeaferGraphApiRuntime<TNodeState> = {
    app: canvasState.app,
    bootstrapRuntime: bootstrapHost,
    widgetEditingManager,
    sceneRuntime: sceneRuntimeHost,
    interactionHost,
    nodeRuntimeHost,
    themeHost,
    viewHost,
    widgetHost
  };
  const apiHost = new LeaferGraphApiHost({
    runtime: apiRuntime,
    nodeViews: options.nodeViews
  });

  return {
    app: canvasState.app,
    root: canvasState.root,
    linkLayer: canvasState.linkLayer,
    nodeLayer: canvasState.nodeLayer,
    apiHost
  };
}
