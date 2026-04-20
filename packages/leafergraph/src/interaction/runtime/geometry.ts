/**
 * 图交互运行时几何 helper。
 *
 * @remarks
 * 负责端口几何、命中矩形和槽位兼容判断等纯计算逻辑。
 */

import type { NodeRuntimeState, SlotType } from "@leafergraph/node";
import type { LeaferGraphConnectionPortState } from "@leafergraph/contracts";
import { resolveNodePortHitAreaBounds } from "../../node/shell/ports";
import { normalizeComparableSlotTypes } from "../../node/shell/slot_style";
import type {
  LeaferGraphInteractionPortViewLike,
  LeaferGraphInteractionRuntimeNodeViewState
} from "./types";

/**
 * 创建一个连接端口状态快照。
 *
 * @param state - 当前节点视图状态。
 * @param portView - 当前端口视图状态。
 * @returns 创建出的连接端口状态。
 */
export function createConnectionPortState<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  state: TNodeViewState,
  portView: LeaferGraphInteractionPortViewLike
): LeaferGraphConnectionPortState {
  // 先把端口 hit area 的显式字段和布局回退值归一成稳定矩形。
  const fallbackHitBounds = resolveNodePortHitAreaBounds(portView.layout);
  const hitX =
    state.state.layout.x +
    coerceFiniteNumber(portView.hitArea.x, fallbackHitBounds.x);
  const hitY =
    state.state.layout.y +
    coerceFiniteNumber(portView.hitArea.y, fallbackHitBounds.y);
  const hitWidth = coerceFiniteNumber(
    portView.hitArea.width,
    fallbackHitBounds.width
  );
  const hitHeight = coerceFiniteNumber(
    portView.hitArea.height,
    fallbackHitBounds.height
  );

  // 再基于节点布局和端口局部坐标组装正式的连接端口状态。
  return {
    nodeId: state.state.id,
    direction: portView.layout.direction,
    slot: normalizeSlotIndex(portView.layout.index),
    center: {
      x:
        state.state.layout.x +
        portView.layout.portX +
        portView.layout.portWidth / 2,
      y:
        state.state.layout.y +
        portView.layout.portY +
        portView.layout.portHeight / 2
    },
    hitBounds: {
      x: hitX,
      y: hitY,
      width: hitWidth,
      height: hitHeight
    },
    slotType: portView.layout.slotType
  };
}

/**
 * 规范化槽位索引。
 *
 * @param slot - 当前槽位值。
 * @returns 规范化后的槽位索引。
 */
export function normalizeSlotIndex(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

/**
 * 通过端口状态生成稳定键值。
 *
 * @param port - 当前端口状态。
 * @returns 当前端口的稳定键值。
 */
export function getPortKey(
  port: Pick<LeaferGraphConnectionPortState, "nodeId" | "direction" | "slot">
): string {
  return `${port.nodeId}:${port.direction}:${normalizeSlotIndex(port.slot)}`;
}

/**
 * 判断一个点是否位于矩形边界内。
 *
 * @param point - 需要命中的坐标点。
 * @param bounds - 当前矩形边界。
 * @returns 当前点是否落在矩形范围内。
 */
export function isPointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * 规范化一个矩形边界。
 *
 * @param bounds - 当前矩形边界。
 * @returns 规范化后的矩形边界。
 */
export function normalizeRectBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const nextX = bounds.width >= 0 ? bounds.x : bounds.x + bounds.width;
  const nextY = bounds.height >= 0 ? bounds.y : bounds.y + bounds.height;

  return {
    x: nextX,
    y: nextY,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height)
  };
}

/**
 * 判断两个矩形边界是否相交。
 *
 * @param left - 左侧矩形边界。
 * @param right - 右侧矩形边界。
 * @returns 当前矩形边界是否相交。
 */
export function doBoundsIntersect(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  );
}

/**
 * 把任意数值收敛成有限数字。
 *
 * @param value - 当前值。
 * @param fallback - 非法时使用的回退值。
 * @returns 收敛后的有限数字。
 */
export function coerceFiniteNumber(
  value: number | undefined,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * 判断两个槽位类型当前是否兼容。
 *
 * @param sourceType - 来源槽位类型。
 * @param targetType - 目标槽位类型。
 * @returns 当前槽位类型是否兼容。
 */
export function areSlotTypesCompatible(
  sourceType: SlotType | undefined,
  targetType: SlotType | undefined
): boolean {
  if (
    sourceType === undefined ||
    sourceType === 0 ||
    targetType === undefined ||
    targetType === 0
  ) {
    return true;
  }

  const sourceTypes = normalizeComparableSlotTypes(sourceType);
  const targetTypes = normalizeComparableSlotTypes(targetType);

  if (!sourceTypes.length || !targetTypes.length) {
    return true;
  }

  if (sourceTypes.includes("*") || targetTypes.includes("*")) {
    return true;
  }

  return sourceTypes.some((type) => targetTypes.includes(type));
}
