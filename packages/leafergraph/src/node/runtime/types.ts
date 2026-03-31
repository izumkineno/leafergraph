/**
 * 节点运行时 controller 共享类型模块。
 *
 * @remarks
 * 负责集中声明 `node/runtime/*` 之间共用的宿主选项和上下文结构。
 */

import type { GraphLink, NodeRegistry } from "@leafergraph/node";
import type {
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason,
  LeaferGraphNodeResizeConstraint
} from "@leafergraph/contracts";
import type { LeaferGraphNodeExecutionHost } from "@leafergraph/execution";
import type { LeaferGraphWidgetRegistry } from "@leafergraph/widget-runtime";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { LeaferGraphSceneRuntimeHost } from "../../graph/host/scene_runtime";

/**
 * 节点运行时宿主依赖的最小节点视图状态。
 */
export type LeaferGraphRuntimeNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  state: TNodeState;
};

/**
 * 节点运行时宿主装配选项。
 */
export interface LeaferGraphNodeRuntimeHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  nodeRegistry: NodeRegistry;
  widgetRegistry: LeaferGraphWidgetRegistry;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, GraphLink>;
  nodeViews: Map<string, TNodeViewState>;
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "refreshNodeView" | "updateConnectedLinks" | "resizeNode" | "requestRender"
  >;
  resolveNodeResizeConstraint(node: TNodeState): LeaferGraphNodeResizeConstraint;
}

/**
 * 节点运行时 helper 共享上下文。
 */
export interface LeaferGraphNodeRuntimeContext<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  readonly options: LeaferGraphNodeRuntimeHostOptions<TNodeState, TNodeViewState>;
  readonly nodeExecutionHost: LeaferGraphNodeExecutionHost<TNodeState>;
  readonly stateListeners: Set<(event: LeaferGraphNodeStateChangeEvent) => void>;
  refreshExecutedNode(nodeId: string): void;
  notifyNodeStateChanged(
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason
  ): void;
}

