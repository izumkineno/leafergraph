/**
 * 图运行时类型模块。
 *
 * @remarks
 * 负责声明主包内部节点、连线和图状态容器所需的共享类型。
 */

import type { GraphLink, NodeRuntimeState } from "@leafergraph/node";
import type { GraphLinkViewState as LeaferGraphLinkHostViewState } from "../link/link_host";
import type { NodeViewState as LeaferGraphNodeHostViewState } from "../node/node_host";

/** 节点展示层对外可见的保留属性。 */
export interface GraphNodeDisplayProperties {
  subtitle?: string;
  accent?: string;
  category?: string;
  status?: string;
}

/** 主包内部使用的节点属性形态：既允许任意扩展字段，也保留常用展示字段。 */
export type GraphNodeProperties = Record<string, unknown> &
  GraphNodeDisplayProperties;

/** 能被主包节点、Widget、连线宿主直接消费的最小节点状态约束。 */
export type LeaferGraphRenderableNodeState = NodeRuntimeState & {
  properties: GraphNodeProperties;
};

/** 主包内部统一图状态容器。 */
export interface GraphRuntimeState<
  TNodeState extends LeaferGraphRenderableNodeState = LeaferGraphRenderableNodeState
> {
  nodes: Map<string, TNodeState>;
  links: Map<string, GraphLink>;
}

/** 当前入口默认使用的节点运行时状态。 */
export type GraphNodeState = LeaferGraphRenderableNodeState;

/** 当前入口默认使用的节点视图状态。 */
export type GraphNodeViewState = LeaferGraphNodeHostViewState<GraphNodeState>;

/** 当前入口默认使用的连线视图状态。 */
export type GraphLinkViewState = LeaferGraphLinkHostViewState<GraphNodeState>;
