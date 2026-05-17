/**
 * API host 共享图类型。
 */

import type { GraphDocument, GraphLink, NodeRuntimeState } from "@leafergraph/core/node";
import type { GraphNodeDisplayProperties } from "@leafergraph/core/contracts";

export type { GraphNodeDisplayProperties } from "@leafergraph/core/contracts";

/**
 * 节点属性形态：既允许任意扩展字段，也保留常用展示字段。
 */
export type GraphNodeProperties = Record<string, unknown> &
  GraphNodeDisplayProperties;

/**
 * 能被 API host、Widget、连线宿主直接消费的最小节点状态约束。
 */
export type LeaferGraphRenderableNodeState = NodeRuntimeState & {
  properties: GraphNodeProperties;
};

/**
 * API host 内部统一图状态容器的文档根状态。
 */
export type GraphDocumentRootState = Omit<GraphDocument, "nodes" | "links">;

/**
 * API host 内部统一图状态容器。
 */
export interface GraphRuntimeState<
  TNodeState extends LeaferGraphRenderableNodeState = LeaferGraphRenderableNodeState
> {
  /** 当前图文档根状态。 */
  document: GraphDocumentRootState;
  /** 当前图中的节点状态映射。 */
  nodes: Map<string, TNodeState>;
  /** 当前图中的连线状态映射。 */
  links: Map<string, GraphLink>;
}

/** 当前入口默认使用的节点运行时状态。 */
export type GraphNodeState = LeaferGraphRenderableNodeState;

/**
 * API host 内部默认节点视图状态占位。
 *
 * @remarks
 * 这里先保持结构型类型，避免 API host 直接倒灌 scene-runtime 实现。
 */
export type GraphNodeViewState = {
  state: GraphNodeState;
  view: unknown;
  widgetLayer: unknown;
  widgetInstances: Array<unknown | null>;
};

/**
 * API host 内部默认连线视图状态占位。
 */
export type GraphLinkViewState = {
  linkId: string;
  view: unknown;
};
