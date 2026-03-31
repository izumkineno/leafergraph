/**
 * 连线数据流动画正式连线解析模块。
 *
 * @remarks
 * 负责把传播事件中的 `linkId/sourceSlot` 解析成可直接用于动画绘制的正式连线快照。
 */

import { resolveNodeSlotFill } from "../../node/shell/slot_style";
import type { LeaferGraphLinkNodeState } from "../curve";
import type {
  LeaferGraphLinkDataFlowAnimationHostOptions,
  LeaferGraphResolvedAnimatedLink
} from "./types";

/**
 * 根据正式图状态解析一条可动画化的连线。
 *
 * @param options - 动画宿主装配选项。
 * @param linkId - 目标连线 ID。
 * @param sourceSlotOverride - 可选的来源槽位覆盖值。
 * @returns 命中后的正式连线快照。
 */
export function resolveLeaferGraphAnimatedLink<
  TNodeState extends LeaferGraphLinkNodeState
>(
  options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>,
  linkId: string,
  sourceSlotOverride?: number
): LeaferGraphResolvedAnimatedLink<TNodeState> | null {
  const link = options.graphLinks.get(linkId);
  if (!link) {
    return null;
  }

  const sourceNode = options.graphNodes.get(link.source.nodeId);
  const targetNode = options.graphNodes.get(link.target.nodeId);
  if (!sourceNode || !targetNode) {
    return null;
  }

  const sourceSlot = normalizeSafeLinkSlot(sourceSlotOverride ?? link.source.slot);
  const targetSlot = normalizeSafeLinkSlot(link.target.slot);
  const color =
    resolveNodeSlotFill(sourceNode, "output", sourceSlot, {
      slotTypeFillMap: options.resolveSlotTypeFillMap(),
      genericFill: options.resolveLinkStroke()
    }) ?? options.resolveLinkStroke();

  return {
    link,
    sourceNode,
    targetNode,
    sourceSlot,
    targetSlot,
    color
  };
}

/**
 * 统一归一动画链路里的槽位索引。
 *
 * @param slot - 原始槽位值。
 * @returns 可安全索引的非负整数槽位。
 */
export function normalizeSafeLinkSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}
