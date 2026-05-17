/**
 * 图场景交互与恢复装配模块。
 *
 * @remarks
 * 负责把交互运行时、交互宿主、主题 runtime 和恢复宿主
 * 从 `scene.ts` 中进一步收口，让场景装配器更接近纯组合根。
 */

import type { LeaferGraphWidgetEditingManager } from "@leafergraph/core/widget-runtime";
import { LeaferGraphInteractionRuntimeHost } from "../../interaction/graph_interaction_runtime_host";
import { LeaferGraphInteractionHost } from "../../interaction/interaction_host";
import type { LeaferGraphInteractionCommitSource } from "../../interaction/interaction_commit_source";
import type { NodeViewState } from "../../node/node_host";
import type { LeaferGraphNodeShellHost } from "../../node/shell/host";
import { LeaferGraphRestoreHost } from "../host/restore";
import { LeaferGraphThemeRuntimeHost } from "../theme/runtime";
import type { LeaferGraphCanvasHost, LeaferGraphCanvasState } from "../host/canvas";
import type { LeaferGraphSceneHost } from "../host/scene";
import type { LeaferGraphSceneRuntimeHost } from "../host/scene_runtime";
import type { LeaferGraphViewHost } from "../host/view";
import type { LeaferGraphThemeHost } from "../theme/host";
import type {
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "../types";
import type { GraphLinkViewState } from "../../link/link_host";
import type { NodeShellLayoutMetrics } from "../../node/shell/layout";
import type { LeaferGraphNodeShellStyleConfig } from "../style";
import type {
  LeaferGraphGraphExecutionHost
} from "@leafergraph/core/execution";
import type {
  LeaferGraphNodeRuntimeHost
} from "@leafergraph/node-runtime";
import type {
  LeaferGraphLinkDataFlowAnimationHost
} from "@leafergraph/link-animation";
import type { NodeRegistry } from "@leafergraph/core/node";
import type { LeaferGraphWidgetHost } from "@leafergraph/core/widget-runtime";

/**
 * 图场景交互与恢复装配输入。
 */
export interface LeaferGraphSceneInteractionAssemblyOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  container: HTMLElement;
  graphState: GraphRuntimeState<TNodeState>;
  nodeViews: Map<string, NodeViewState<TNodeState>>;
  linkViews: GraphLinkViewState<TNodeState>[];
  canvasState: LeaferGraphCanvasState;
  canvasHost: LeaferGraphCanvasHost;
  nodeRegistry: NodeRegistry;
  themeHost: LeaferGraphThemeHost;
  widgetEditingManager: LeaferGraphWidgetEditingManager;
  nodeShellHost: LeaferGraphNodeShellHost<TNodeState>;
  viewHost: LeaferGraphViewHost<TNodeState, NodeViewState<TNodeState>>;
  sceneHost: LeaferGraphSceneHost<
    TNodeState,
    NodeViewState<TNodeState>,
    GraphLinkViewState<TNodeState>
  >;
  sceneRuntimeHost: LeaferGraphSceneRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  nodeRuntimeHost: LeaferGraphNodeRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  graphExecutionHost: LeaferGraphGraphExecutionHost<TNodeState>;
  dataFlowAnimationHost: LeaferGraphLinkDataFlowAnimationHost<TNodeState>;
  widgetHost: LeaferGraphWidgetHost;
  interactionCommitSource: LeaferGraphInteractionCommitSource;
  requestRender(): void;
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  nodeShellStyle: LeaferGraphNodeShellStyleConfig;
  resolveSelectedStroke(mode: import("@leafergraph/core/theme").LeaferGraphThemeMode): string;
}

/**
 * 图场景交互与恢复装配结果。
 */
export interface LeaferGraphSceneInteractionAssemblyResult<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  interactionHost: LeaferGraphInteractionHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  interactionRuntimeHost: LeaferGraphInteractionRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  restoreHost: LeaferGraphRestoreHost<TNodeState, NodeViewState<TNodeState>>;
}

/**
 * 创建图场景交互与恢复宿主集合。
 *
 * @param options - 场景交互装配输入。
 * @returns 交互与恢复相关宿主集合。
 */
export function createLeaferGraphSceneInteractionAssembly<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphSceneInteractionAssemblyOptions<TNodeState>
): LeaferGraphSceneInteractionAssemblyResult<TNodeState> {
  const interactionRuntimeHost = new LeaferGraphInteractionRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    nodeViews: options.nodeViews,
    linkLayer: options.canvasState.linkLayer,
    bringNodeViewToFront: (state) => options.viewHost.bringNodeViewToFront(state),
    syncNodeResizeHandleVisibility: (state) =>
      options.nodeShellHost.syncNodeResizeHandleVisibility(state),
    requestRender: options.requestRender,
    resolveDraggedNodeIds: (nodeId) =>
      options.viewHost.resolveDraggedNodeIds(nodeId),
    listSelectedNodeIds: () => options.viewHost.listSelectedNodeIds(),
    isNodeSelected: (nodeId) => options.viewHost.isNodeSelected(nodeId),
    setSelectedNodeIds: (nodeIds, mode) =>
      options.viewHost.setSelectedNodeIds(nodeIds, mode),
    clearSelectedNodes: () => options.viewHost.clearSelectedNodes(),
    sceneRuntime: options.sceneRuntimeHost,
    setNodeCollapsed: (nodeId, collapsed) =>
      options.sceneRuntimeHost.setNodeCollapsed(nodeId, collapsed),
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

      const headerHeight = options.nodeShellLayoutMetrics.headerHeight;
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

          options.sceneRuntimeHost.updateNode(nodeId, { title: trimmedTitle });
          options.interactionCommitSource.emit({
            type: "node.rename.commit",
            nodeId,
            beforeTitle: originalTitle,
            afterTitle: trimmedTitle
          });
        },
        onCancel: () => {}
      });
    },
    canResizeNode: (nodeId) => options.nodeRuntimeHost.canResizeNode(nodeId),
    getPagePointByClient: (event) => options.viewHost.getPagePointByClient(event),
    getPagePointFromGraphEvent: (event) =>
      options.viewHost.getPagePointFromGraphEvent(event),
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

  const interactionHost = new LeaferGraphInteractionHost<
    TNodeState,
    NodeViewState<TNodeState>
  >({
    container: options.container,
    runtime: interactionRuntimeHost,
    selectionLayer: options.canvasState.selectionLayer,
    resolveSelectionStroke: () =>
      options.resolveSelectedStroke(options.themeHost.getMode()),
    requestRender: options.requestRender,
    emitInteractionCommit: (event) => options.interactionCommitSource.emit(event)
  });

  const themeRuntimeHost = new LeaferGraphThemeRuntimeHost({
    widgetEditingManager: options.widgetEditingManager,
    canvasHost: options.canvasHost,
    sceneRuntime: options.sceneRuntimeHost
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
    resetRuntimeState: () => options.viewHost.resetViewState(),
    resetNodeExecutionStates: () =>
      options.nodeRuntimeHost.clearAllExecutionStates(),
    resetGraphExecutionState: () => options.graphExecutionHost.resetState(),
    destroyNodeViewWidgets: (state) =>
      options.widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer),
    clearNodeLayer: () => options.canvasState.nodeLayer.removeAll(),
    clearLinkLayer: () => {
      options.dataFlowAnimationHost.clear();
      options.canvasState.linkLayer.removeAll();
      options.dataFlowAnimationHost.restoreLayer();
      interactionRuntimeHost.restoreConnectionPreviewLayer();
    },
    mountNodeView: (node) => options.sceneHost.mountNodeView(node),
    mountLinkView: (link) => options.sceneHost.mountLinkView(link),
    handleLinkRestored: (link) => options.nodeRuntimeHost.notifyLinkCreated(link),
    requestRender: options.requestRender
  });

  return {
    interactionHost,
    interactionRuntimeHost,
    restoreHost
  };
}
