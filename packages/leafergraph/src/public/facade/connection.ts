/**
 * public façade 的连接预览与端口方法组。
 */

import type {
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult
} from "@leafergraph/contracts";
import { getLeaferGraphApiHost } from "../leafer_graph";
import type { LeaferGraph } from "../leafer_graph";

/**
 * `LeaferGraph` 的连接预览与端口 façade。
 */
export interface LeaferGraphConnectionFacade {
  resolveConnectionPort(
    nodeId: string,
    direction: LeaferGraphConnectionPortState["direction"],
    slot: number
  ): LeaferGraphConnectionPortState | undefined;
  resolveConnectionPortAtPoint(
    point: { x: number; y: number },
    direction: LeaferGraphConnectionPortState["direction"]
  ): LeaferGraphConnectionPortState | undefined;
  setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void;
  setConnectionCandidatePort(port: LeaferGraphConnectionPortState | null): void;
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void;
  clearConnectionPreview(): void;
  canCreateConnection(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult;
}

/**
 * 解析某个节点方向和槽位对应的正式端口几何。
 *
 * @param this - 当前图实例。
 * @param nodeId - 目标节点 ID。
 * @param direction - 目标方向。
 * @param slot - 目标槽位。
 * @returns 匹配到的端口状态。
 */
function resolveLeaferGraphConnectionPort(
  this: LeaferGraph,
  nodeId: string,
  direction: LeaferGraphConnectionPortState["direction"],
  slot: number
): LeaferGraphConnectionPortState | undefined {
  return getLeaferGraphApiHost(this).resolveConnectionPort(nodeId, direction, slot);
}

/**
 * 根据当前画布 page 坐标命中一个方向匹配的端口。
 *
 * @param this - 当前图实例。
 * @param point - 当前画布坐标。
 * @param direction - 目标方向。
 * @returns 命中的端口状态。
 */
function resolveLeaferGraphConnectionPortAtPoint(
  this: LeaferGraph,
  point: { x: number; y: number },
  direction: LeaferGraphConnectionPortState["direction"]
): LeaferGraphConnectionPortState | undefined {
  return getLeaferGraphApiHost(this).resolveConnectionPortAtPoint(point, direction);
}

/**
 * 设置当前连接预览的起点高亮。
 *
 * @param this - 当前图实例。
 * @param port - 当前高亮的起点端口。
 * @returns 无返回值。
 */
function setLeaferGraphConnectionSourcePort(
  this: LeaferGraph,
  port: LeaferGraphConnectionPortState | null
): void {
  getLeaferGraphApiHost(this).setConnectionSourcePort(port);
}

/**
 * 设置当前连接预览的候选终点高亮。
 *
 * @param this - 当前图实例。
 * @param port - 当前高亮的候选端口。
 * @returns 无返回值。
 */
function setLeaferGraphConnectionCandidatePort(
  this: LeaferGraph,
  port: LeaferGraphConnectionPortState | null
): void {
  getLeaferGraphApiHost(this).setConnectionCandidatePort(port);
}

/**
 * 刷新当前连接预览线。
 *
 * @param this - 当前图实例。
 * @param source - 当前起点端口。
 * @param pointer - 当前指针坐标。
 * @param target - 当前候选终点端口。
 * @returns 无返回值。
 */
function setLeaferGraphConnectionPreview(
  this: LeaferGraph,
  source: LeaferGraphConnectionPortState,
  pointer: { x: number; y: number },
  target?: LeaferGraphConnectionPortState
): void {
  getLeaferGraphApiHost(this).setConnectionPreview(source, pointer, target);
}

/**
 * 清理当前连接预览和候选高亮。
 *
 * @param this - 当前图实例。
 * @returns 无返回值。
 */
function clearLeaferGraphConnectionPreview(this: LeaferGraph): void {
  getLeaferGraphApiHost(this).clearConnectionPreview();
}

/**
 * 校验两个端口当前是否允许建立正式连线。
 *
 * @param this - 当前图实例。
 * @param source - 当前来源端口。
 * @param target - 当前目标端口。
 * @returns 连接校验结果。
 */
function canLeaferGraphCreateConnection(
  this: LeaferGraph,
  source: LeaferGraphConnectionPortState,
  target: LeaferGraphConnectionPortState
): LeaferGraphConnectionValidationResult {
  return getLeaferGraphApiHost(this).canCreateConnection(source, target);
}

export const leaferGraphConnectionFacadeMethods: LeaferGraphConnectionFacade = {
  resolveConnectionPort: resolveLeaferGraphConnectionPort,
  resolveConnectionPortAtPoint: resolveLeaferGraphConnectionPortAtPoint,
  setConnectionSourcePort: setLeaferGraphConnectionSourcePort,
  setConnectionCandidatePort: setLeaferGraphConnectionCandidatePort,
  setConnectionPreview: setLeaferGraphConnectionPreview,
  clearConnectionPreview: clearLeaferGraphConnectionPreview,
  canCreateConnection: canLeaferGraphCreateConnection
};
