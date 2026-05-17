/**
 * 图场景执行链装配模块。
 *
 * @remarks
 * 负责把 node runtime、graph execution、runtime feedback 和 link animation
 * 收口到一个更窄的 execution-chain helper，
 * 让 `scene.ts` 只保留场景宿主级 wiring。
 */

import type { NodeRegistry } from "@leafergraph/core/node";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/core/contracts";
import type {
  LeaferGraphGraphThemeTokens,
  LeaferGraphThemeMode
} from "@leafergraph/core/theme";
import { LeaferGraphGraphExecutionHost } from "@leafergraph/core/execution";
import { LeaferGraphLinkDataFlowAnimationHost } from "@leafergraph/link-animation";
import { LeaferGraphNodeRuntimeHost } from "@leafergraph/node-runtime";
import type { LeaferGraphWidgetRegistry } from "@leafergraph/core/widget-runtime";
import { resolveLeaferGraphAnimatedLink } from "../../link/animation/resolved_link";
import type { NodeViewState } from "../../node/node_host";
import type { LeaferGraphNodeShellHost } from "../../node/shell/host";
import type { NodeShellLayoutMetrics } from "../../node/shell/layout";
import { createLeaferGraphLocalRuntimeFeedbackHost } from "../feedback/local_runtime_adapter";
import type { LeaferGraphRuntimeFeedbackHost } from "../feedback/local_runtime_adapter";
import type { LeaferGraphCanvasState } from "../host/canvas";
import type { LeaferGraphSceneRuntimeHost } from "../host/scene_runtime";
import type {
  LeaferGraphDataFlowAnimationStyleConfig
} from "../style";
import type {
  GraphRuntimeState,
  LeaferGraphRenderableNodeState
} from "../types";
import type { LeaferGraphThemeHost } from "../theme/host";

/**
 * 图场景执行链装配输入。
 */
export interface LeaferGraphExecutionChainAssemblyOptions<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  container: HTMLElement;
  graphState: GraphRuntimeState<TNodeState>;
  nodeViews: Map<string, NodeViewState<TNodeState>>;
  canvasState: LeaferGraphCanvasState;
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  themeHost: LeaferGraphThemeHost;
  sceneRuntimeHost: LeaferGraphSceneRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  nodeShellHost: LeaferGraphNodeShellHost<TNodeState>;
  requestRender(): void;
  resolveGraphTheme(mode: LeaferGraphThemeMode): LeaferGraphGraphThemeTokens;
  nodeShellLayoutMetrics: NodeShellLayoutMetrics;
  linkDefaultNodeWidth: number;
  linkPortSize: number;
  respectReducedMotion: boolean;
  dataFlowAnimationStyle: LeaferGraphDataFlowAnimationStyleConfig;
}

/**
 * 图场景执行链装配结果。
 */
export interface LeaferGraphExecutionChainAssemblyResult<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  nodeRuntimeHost: LeaferGraphNodeRuntimeHost<
    TNodeState,
    NodeViewState<TNodeState>
  >;
  runtimeFeedbackHost: LeaferGraphRuntimeFeedbackHost;
  dataFlowAnimationHost: LeaferGraphLinkDataFlowAnimationHost<TNodeState>;
  graphExecutionHost: LeaferGraphGraphExecutionHost<TNodeState>;
}

/**
 * 创建图场景执行链宿主集合。
 *
 * @param options - 场景执行链装配输入。
 * @returns 执行链所需的宿主集合。
 */
export function createLeaferGraphExecutionChainAssembly<
  TNodeState extends LeaferGraphRenderableNodeState
>(
  options: LeaferGraphExecutionChainAssemblyOptions<TNodeState>
): LeaferGraphExecutionChainAssemblyResult<TNodeState> {
  const nodeRuntimeHost = new LeaferGraphNodeRuntimeHost({
    nodeRegistry: options.nodeRegistry,
    widgetRegistry: options.widgetRegistry,
    graphNodes: options.graphState.nodes,
    graphLinks: options.graphState.links,
    nodeViews: options.nodeViews,
    sceneRuntime: options.sceneRuntimeHost,
    resolveNodeResizeConstraint: (node) =>
      options.nodeShellHost.resolveNodeResizeConstraint(node)
  });

  const resolveAnimationStyle = (): LeaferGraphDataFlowAnimationStyleConfig => {
    const graphTheme = options.resolveGraphTheme(options.themeHost.getMode());
    const preset = options.dataFlowAnimationStyle.preset;

    return options.dataFlowAnimationStyle.enabled
      ? graphTheme.dataFlowAnimationStyles[preset]
      : {
          ...graphTheme.dataFlowAnimationStyles.performance,
          ...options.dataFlowAnimationStyle
        };
  };

  const subscribeLinkPropagation = (
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ) => nodeRuntimeHost.subscribeLinkPropagation(listener);
  const resolveLinkStroke = () =>
    options.resolveGraphTheme(options.themeHost.getMode()).linkStroke;
  const resolveSlotTypeFillMap = () =>
    options.resolveGraphTheme(options.themeHost.getMode()).nodeShellStyle.slotTypeFillMap;

  const dataFlowAnimationHost = new LeaferGraphLinkDataFlowAnimationHost({
    container: options.container,
    linkLayer: options.canvasState.linkLayer,
    layoutMetrics: options.nodeShellLayoutMetrics,
    defaultNodeWidth: options.linkDefaultNodeWidth,
    portSize: options.linkPortSize,
    resolveStyle: resolveAnimationStyle,
    respectReducedMotion: options.respectReducedMotion,
    getThemeMode: () => options.themeHost.getMode(),
    requestRender: options.requestRender,
    subscribeLinkPropagation,
    resolveAnimatedLink: (linkId: string, sourceSlotOverride?: number) =>
      resolveLeaferGraphAnimatedLink(
        {
          graphNodes: options.graphState.nodes,
          graphLinks: options.graphState.links,
          layoutMetrics: options.nodeShellLayoutMetrics,
          defaultNodeWidth: options.linkDefaultNodeWidth,
          portSize: options.linkPortSize,
          resolveLinkStroke,
          resolveSlotTypeFillMap
        },
        linkId,
        sourceSlotOverride
      )
  });

  const graphExecutionHost = new LeaferGraphGraphExecutionHost({
    nodeExecutionHost: nodeRuntimeHost
  });

  const runtimeFeedbackHost = createLeaferGraphLocalRuntimeFeedbackHost({
    subscribeNodeExecution: (listener) =>
      nodeRuntimeHost.subscribeNodeExecution(listener),
    subscribeGraphExecution: (listener) =>
      graphExecutionHost.subscribeGraphExecution(listener),
    subscribeLinkPropagation,
    subscribeNodeState: (listener) => nodeRuntimeHost.subscribeNodeState(listener),
    projectExternalGraphExecution: (event) =>
      graphExecutionHost.projectExternalGraphExecution(event),
    projectExternalNodeExecution: (event) =>
      nodeRuntimeHost.projectExternalNodeExecution(event),
    projectExternalNodeState: (event) =>
      nodeRuntimeHost.projectExternalNodeState(event),
    projectExternalLinkPropagation: (event) =>
      nodeRuntimeHost.projectExternalLinkPropagation(event)
  });

  return {
    nodeRuntimeHost,
    runtimeFeedbackHost,
    dataFlowAnimationHost,
    graphExecutionHost
  };
}
