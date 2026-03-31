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
  /** 节点运行时状态。 */
  state: TNodeState;
};

/**
 * 节点运行时宿主装配选项。
 */
export interface LeaferGraphNodeRuntimeHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  /** 节点注册表。 */
  nodeRegistry: NodeRegistry;
  /** Widget 注册表。 */
  widgetRegistry: LeaferGraphWidgetRegistry;
  /** 图中的节点映射。 */
  graphNodes: Map<string, TNodeState>;
  /** 图中的连线映射。 */
  graphLinks: Map<string, GraphLink>;
  /** 节点视图映射。 */
  nodeViews: Map<string, TNodeViewState>;
  /** 场景运行时最小能力。 */
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "refreshNodeView" | "updateConnectedLinks" | "resizeNode" | "requestRender"
  >;
  /** 解析节点 resize 约束。 */
  resolveNodeResizeConstraint(node: TNodeState): LeaferGraphNodeResizeConstraint;
}

/**
 * 节点运行时 helper 共享上下文。
 */
export interface LeaferGraphNodeRuntimeContext<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphRuntimeNodeViewState<TNodeState>
> {
  /** 节点运行时宿主初始化选项。 */
  readonly options: LeaferGraphNodeRuntimeHostOptions<TNodeState, TNodeViewState>;
  /** 底层节点执行宿主。 */
  readonly nodeExecutionHost: LeaferGraphNodeExecutionHost<TNodeState>;
  /** 节点状态事件监听器集合。 */
  readonly stateListeners: Set<(event: LeaferGraphNodeStateChangeEvent) => void>;
  /** 刷新当前已执行节点的可视状态。 */
  refreshExecutedNode(nodeId: string): void;
  /** 发射节点状态变化事件。 */
  notifyNodeStateChanged(
    nodeId: string,
    reason: LeaferGraphNodeStateChangeReason
  ): void;
}
