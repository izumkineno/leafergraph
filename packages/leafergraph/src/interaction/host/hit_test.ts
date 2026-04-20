/**
 * 图交互宿主命中判断 helper。
 *
 * @remarks
 * 负责 resize 句柄、端口热区和选择修饰键的最小几何判断。
 */

import type { NodeRuntimeState, SlotDirection } from "@leafergraph/node";
import type { LeaferGraphConnectionPortState } from "@leafergraph/contracts";
import type {
  LeaferGraphInteractiveNodeViewState
} from "./types";
import type { LeaferGraphWidgetPointerEvent } from "@leafergraph/widget-runtime";

/**
 * 判断当前事件命中是否来自节点 resize 句柄。
 *
 * @param target - 当前事件命中目标。
 * @returns 当前命中是否来自 resize 句柄。
 */
export function isResizeHandleTarget(
  target: LeaferGraphWidgetPointerEvent["target"]
): boolean {
  let current = target;

  while (current) {
    if ((current.name ?? "").startsWith("node-resize-handle-")) {
      return true;
    }
    current = current.parent ?? null;
  }

  return false;
}

/**
 * 判断当前事件命中是否来自节点端口热区。
 *
 * @param target - 当前事件命中目标。
 * @returns 当前命中是否来自端口热区。
 */
export function isPortHitTarget(
  target: LeaferGraphWidgetPointerEvent["target"]
): boolean {
  let current = target;

  while (current) {
    if ((current.name ?? "").startsWith("node-port-hit-")) {
      return true;
    }
    current = current.parent ?? null;
  }

  return false;
}

/**
 * 判断当前事件命中是否来自节点标题热区。
 *
 * @param target - 当前事件命中目标。
 * @returns 当前命中是否来自节点标题热区。
 */
export function isNodeTitleHitTarget(
  target: LeaferGraphWidgetPointerEvent["target"]
): boolean {
  let current = target;

  while (current) {
    if ((current.name ?? "").startsWith("node-title-hit-")) {
      return true;
    }
    current = current.parent ?? null;
  }

  return false;
}

/**
 * 通过节点局部坐标兜底判断一次按下是否命中了 resize 热区。
 *
 * @param event - 当前 Leafer 指针事件。
 * @param state - 当前节点视图状态。
 * @param resolveNodeSize - 节点尺寸解析函数。
 * @param getPagePointFromGraphEvent - page 坐标解析函数。
 * @returns 当前命中是否落在 resize 热区。
 */
export function isResizeHandleHit<TNodeState extends NodeRuntimeState>(
  event: LeaferGraphWidgetPointerEvent,
  state: LeaferGraphInteractiveNodeViewState<TNodeState>,
  resolveNodeSize: (nodeId: string) => { width: number; height: number } | undefined,
  getPagePointFromGraphEvent: (
    event: LeaferGraphWidgetPointerEvent
  ) => { x: number; y: number }
): boolean {
  const size = resolveNodeSize(state.state.id);
  if (!size) {
    return false;
  }

  const point = getPagePointFromGraphEvent(event);
  const localX = point.x - state.state.layout.x;
  const localY = point.y - state.state.layout.y;

  return localX >= size.width - 20 && localY >= size.height - 20;
}

/**
 * 统一读取当前事件里的多选辅助修饰键。
 *
 * @param event - 当前 Leafer 指针事件。
 * @returns 当前是否按下多选辅助修饰键。
 */
export function isSelectionModifierPressed(
  event: LeaferGraphWidgetPointerEvent
): boolean {
  const origin = event.origin as PointerEvent | undefined;
  const eventLike = event as LeaferGraphWidgetPointerEvent & {
    shiftKey?: boolean;
  };
  return Boolean(origin?.shiftKey ?? eventLike.shiftKey);
}

/**
 * 根据拖线起点方向解析目标端应命中的相反方向。
 *
 * @param direction - 当前起点方向。
 * @returns 当前方向对应的相反方向。
 */
export function getOppositeDirection(direction: SlotDirection): SlotDirection {
  return direction === "output" ? "input" : "output";
}

/**
 * 把任意方向发起的拖线归一成正式 `output -> input` 端点对。
 *
 * @param originPort - 当前起点端口。
 * @param candidatePort - 当前候选端口。
 * @returns 规范化后的正式端点对。
 */
export function resolveConnectionEndpoints(
  originPort: LeaferGraphConnectionPortState,
  candidatePort: LeaferGraphConnectionPortState
):
  | {
      source: LeaferGraphConnectionPortState;
      target: LeaferGraphConnectionPortState;
    }
  | null {
  if (originPort.direction === candidatePort.direction) {
    return null;
  }

  return originPort.direction === "output"
    ? {
        source: originPort,
        target: candidatePort
      }
    : {
        source: candidatePort,
        target: originPort
      };
}
