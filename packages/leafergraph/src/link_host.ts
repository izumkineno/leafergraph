import { Arrow } from "@leafer-in/arrow";
import type { LeaferGraphLinkData } from "@leafergraph/node";

/** 连线视图状态。 */
export interface GraphLinkViewState<TNodeState = unknown> {
  linkId: string;
  sourceId: string;
  targetId: string;
  sourceSlot: number;
  targetSlot: number;
  view: Arrow;
  source?: TNodeState;
  target?: TNodeState;
}

interface LeaferGraphLinkHostOptions<TNodeState> {
  graphLinks: Map<string, LeaferGraphLinkData>;
  linkViews: GraphLinkViewState<TNodeState>[];
  getNode(nodeId: string): TNodeState | undefined;
  normalizeSlotIndex(slot: number | undefined): number;
  createLinkShape(
    source: TNodeState,
    target: TNodeState,
    sourceSlot: number,
    targetSlot: number
  ): Arrow;
  addLinkShapeToLayer(view: Arrow): void;
  refreshLinkPath(
    link: GraphLinkViewState<TNodeState>,
    source: TNodeState,
    target: TNodeState
  ): void;
}

/**
 * 连线宿主装配器。
 * 当前只负责连线 view 的创建、挂载、删除和局部路径刷新。
 */
export class LeaferGraphLinkHost<TNodeState> {
  private readonly options: LeaferGraphLinkHostOptions<TNodeState>;

  constructor(options: LeaferGraphLinkHostOptions<TNodeState>) {
    this.options = options;
  }

  /** 将连线状态和连线视图一起挂入当前图。 */
  mountLinkView(link: LeaferGraphLinkData): GraphLinkViewState<TNodeState> | null {
    if (this.options.graphLinks.has(link.id)) {
      console.warn("[leafergraph] 跳过重复连线 ID", link.id);
      return null;
    }

    const state = this.createLinkView(link);
    if (!state) {
      return null;
    }

    this.options.graphLinks.set(link.id, link);
    this.options.linkViews.push(state);
    this.options.addLinkShapeToLayer(state.view);
    return state;
  }

  /** 移除一条连线的图状态和视图。 */
  removeLink(linkId: string): boolean {
    const linkIndex = this.options.linkViews.findIndex(
      (item) => item.linkId === linkId
    );

    if (linkIndex >= 0) {
      const [state] = this.options.linkViews.splice(linkIndex, 1);
      state.view.remove();
    }

    return this.options.graphLinks.delete(linkId) || linkIndex >= 0;
  }

  /** 只更新与某个节点相连的连线，避免全量重算。 */
  updateConnectedLinks(nodeId: string): void {
    this.updateConnectedLinksForNodes([nodeId]);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   * 多选拖拽时如果仍按单节点逐个扫描，会把同一条连线反复重算，
   * 这里统一按节点集合收敛目标范围，减少重复刷新。
   */
  updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    if (!nodeIds.length) {
      return;
    }

    const nodeIdSet = new Set(nodeIds);

    for (const link of this.options.linkViews) {
      if (!nodeIdSet.has(link.sourceId) && !nodeIdSet.has(link.targetId)) {
        continue;
      }

      const source = this.options.getNode(link.sourceId);
      const target = this.options.getNode(link.targetId);
      if (!source || !target) {
        continue;
      }

      this.options.refreshLinkPath(link, source, target);
    }
  }

  /**
   * 根据正式连线数据创建连线视图。
   * 当端点节点不存在时，当前阶段直接跳过并打印告警，避免半有效数据破坏整体渲染。
   */
  private createLinkView(
    link: LeaferGraphLinkData
  ): GraphLinkViewState<TNodeState> | null {
    const source = this.options.getNode(link.source.nodeId);
    const target = this.options.getNode(link.target.nodeId);
    if (!source || !target) {
      console.warn("[leafergraph] 跳过无效连线，未找到端点节点", link);
      return null;
    }

    const sourceSlot = this.options.normalizeSlotIndex(link.source.slot);
    const targetSlot = this.options.normalizeSlotIndex(link.target.slot);

    return {
      linkId: link.id,
      sourceId: link.source.nodeId,
      targetId: link.target.nodeId,
      sourceSlot,
      targetSlot,
      source,
      target,
      view: this.options.createLinkShape(source, target, sourceSlot, targetSlot)
    };
  }
}
