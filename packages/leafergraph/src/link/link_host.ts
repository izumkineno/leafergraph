/**
 * 连线宿主模块。
 *
 * @remarks
 * 负责连线视图创建、移除与节点联动后的路径刷新。
 */

import type { Group } from "leafer-ui";
import { Arrow } from "@leafer-in/arrow";
import type { GraphLink } from "@leafergraph/core/node";
import { buildLinkPathFromCurve } from "./link";
import {
  resolveGraphLinkCurve,
  type LeaferGraphLinkNodeState
} from "./curve";
import type { NodeShellLayoutMetrics } from "../node/shell/layout";
import { resolveNodeSlotFill } from "../node/shell/slot_style";

export type {
  LeaferGraphLinkNodeState,
  ResolveGraphLinkCurveInput
} from "./curve";
export { resolveGraphLinkCurve } from "./curve";

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

interface LeaferGraphLinkHostOptions<TNodeState extends LeaferGraphLinkNodeState> {
  graphLinks: Map<string, GraphLink>;
  linkViews: GraphLinkViewState<TNodeState>[];
  linkLayer: Group;
  getNode(nodeId: string): TNodeState | undefined;
  normalizeSlotIndex(slot: number | undefined): number;
  layoutMetrics: NodeShellLayoutMetrics;
  defaultNodeWidth: number;
  portSize: number;
  resolveLinkStroke(): string;
  resolveSlotTypeFillMap(): Readonly<Record<string, string>>;
  resolveGenericPortFill(): string;
  strokeWidth?: number;
}

/**
 * 连线宿主装配器。
 * 当前只负责连线 view 的创建、挂载、删除和局部路径刷新。
 */
export class LeaferGraphLinkHost<TNodeState extends LeaferGraphLinkNodeState> {
  private readonly options: LeaferGraphLinkHostOptions<TNodeState>;

  /**
   * 初始化 LeaferGraphLinkHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphLinkHostOptions<TNodeState>) {
    this.options = options;
  }

  /**
   *  将连线状态和连线视图一起挂入当前图。
   *
   * @param link - 连线。
   * @returns 挂载连线视图的结果。
   */
  mountLinkView(link: GraphLink): GraphLinkViewState<TNodeState> | null {
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
    this.addLinkShapeToLayer(state.view);
    return state;
  }

  /**
   *  移除一条连线的图状态和视图。
   *
   * @param linkId - 目标连线 ID。
   * @returns 对应的判断结果。
   */
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

  /**
   *  只更新与某个节点相连的连线，避免全量重算。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 无返回值。
   */
  updateConnectedLinks(nodeId: string): void {
    this.updateConnectedLinksForNodes([nodeId]);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   * 多选拖拽时如果仍按单节点逐个扫描，会把同一条连线反复重算，
   * 这里统一按节点集合收敛目标范围，减少重复刷新。
   *
   * @param nodeIds - 节点 ID 列表。
   * @returns 无返回值。
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

      this.refreshLinkPath(link, source, target);
    }
  }

  /**
   * 根据正式连线数据创建连线视图。
   * 当端点节点不存在时，当前阶段直接跳过并打印告警，避免半有效数据破坏整体渲染。
   *
   * @param link - 连线。
   * @returns 创建后的结果对象。
   */
  private createLinkView(
    link: GraphLink
  ): GraphLinkViewState<TNodeState> | null {
    const source = this.options.getNode(link.source.nodeId);
    const target = this.options.getNode(link.target.nodeId);
    if (!source || !target) {
      console.warn("[leafergraph] 跳过无效连线，未找到端点节点", link);
      return null;
    }

    const sourceSlot = this.options.normalizeSlotIndex(link.source.slot);
    const targetSlot = this.options.normalizeSlotIndex(link.target.slot);

    const view = this.createLinkShape(source, target, sourceSlot, targetSlot);
    view.id = `graph-link-${link.id}`;
    view.name = `graph-link-${link.id}`;

    return {
      linkId: link.id,
      sourceId: link.source.nodeId,
      targetId: link.target.nodeId,
      sourceSlot,
      targetSlot,
      source,
      target,
      view
    };
  }

  /**
   *  创建两个节点之间的连线图元。
   *
   * @param source - 当前来源对象。
   * @param target - 当前目标对象。
   * @param sourceSlot - 来源槽位。
   * @param targetSlot - 目标槽位。
   * @returns 创建后的结果对象。
   */
  private createLinkShape(
    source: TNodeState,
    target: TNodeState,
    sourceSlot: number,
    targetSlot: number
  ): Arrow {
    const curve = resolveGraphLinkCurve({
      source,
      target,
      sourceSlot,
      targetSlot,
      layoutMetrics: this.options.layoutMetrics,
      defaultNodeWidth: this.options.defaultNodeWidth,
      portSize: this.options.portSize
    });

    return new Arrow({
      path: buildLinkPathFromCurve(curve),
      endArrow: "none",
      fill: "transparent",
      stroke: this.resolveLinkStroke(source, sourceSlot),
      strokeWidth: this.options.strokeWidth ?? 3,
      strokeCap: "round",
      strokeJoin: "round",
      hittable: true,
      hitStroke: "all",
      hitRadius: 6,
      cursor: "pointer"
    });
  }

  /**
   *  按当前节点位置重算单条连线路径，供移动和节点更新共用。
   *
   * @param link - 连线。
   * @param source - 当前来源对象。
   * @param target - 当前目标对象。
   * @returns 无返回值。
   */
  private refreshLinkPath(
    link: GraphLinkViewState<TNodeState>,
    source: TNodeState,
    target: TNodeState
  ): void {
    const curve = resolveGraphLinkCurve({
      source,
      target,
      sourceSlot: link.sourceSlot,
      targetSlot: link.targetSlot,
      layoutMetrics: this.options.layoutMetrics,
      defaultNodeWidth: this.options.defaultNodeWidth,
      portSize: this.options.portSize
    });

    link.view.path = buildLinkPathFromCurve(curve);
    link.view.stroke = this.resolveLinkStroke(source, link.sourceSlot);
  }

  /**
   *  正式连线颜色统一跟随 source output slot 的类型色。
   *
   * @param source - 当前来源对象。
   * @param sourceSlot - 来源槽位。
   * @returns 处理后的结果。
   */
  private resolveLinkStroke(source: TNodeState, sourceSlot: number): string {
    return (
      resolveNodeSlotFill(source, "output", sourceSlot, {
        slotTypeFillMap: this.options.resolveSlotTypeFillMap(),
        genericFill: this.options.resolveGenericPortFill()
      }) ?? this.options.resolveLinkStroke()
    );
  }

  /**
   * 将 Arrow 图元挂入连线层。
   *
   * 当前 Bun 依赖树里同时残留了 Leafer UI 的 2.0.2 / 2.0.3 类型定义，
   * 会让 `Arrow` 与 `Group.add(...)` 在 TypeScript 看来来自两套不同的类型宇宙。
   * 运行时对象本身是兼容的，因此把这次适配集中在这一处，避免把类型断言扩散出去。
   *
   * @param view - 视图。
   * @returns 无返回值。
   */
  private addLinkShapeToLayer(view: Arrow): void {
    this.options.linkLayer.add(view as unknown as Group);
  }
}
