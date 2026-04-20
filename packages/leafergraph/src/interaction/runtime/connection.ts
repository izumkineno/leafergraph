/**
 * 图交互运行时连线 helper。
 *
 * @remarks
 * 负责端口解析、端口高亮、预览线更新和正式建线校验。
 */

import type { NodeRuntimeState, SlotDirection } from "@leafergraph/node";
import type {
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult
} from "@leafergraph/contracts";
import {
  PORT_DIRECTION_LEFT,
  PORT_DIRECTION_RIGHT,
  buildLinkPath
} from "../../link/link";
import { resolveNodeSlotFill } from "../../node/shell/slot_style";
import {
  areSlotTypesCompatible,
  createConnectionPortState,
  getPortKey,
  isPointInBounds,
  normalizeSlotIndex
} from "./geometry";
import type {
  LeaferGraphInteractionRuntimeContext,
  LeaferGraphInteractionRuntimeNodeViewState
} from "./types";

/**
 * 在外部清空连线层后，把预览线图元重新挂回当前连线层。
 *
 * @param context - 当前交互运行时上下文。
 * @returns 无返回值。
 */
export function restoreLeaferGraphInteractionConnectionPreviewLayer<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>
): void {
  context.attachPreviewPathToLayer();
}

/**
 * 按节点、方向和槽位解析一个端口的完整几何信息。
 *
 * @param context - 当前交互运行时上下文。
 * @param nodeId - 目标节点 ID。
 * @param direction - 目标端口方向。
 * @param slot - 目标槽位。
 * @returns 解析到的端口状态。
 */
export function resolveLeaferGraphInteractionPort<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  nodeId: string,
  direction: SlotDirection,
  slot: number
): LeaferGraphConnectionPortState | undefined {
  const state = context.options.nodeViews.get(nodeId);
  if (!state) {
    return undefined;
  }

  const portView = state.shellView.portViews.find(
    (item) =>
      item.layout.direction === direction &&
      item.layout.index === normalizeSlotIndex(slot)
  );
  if (!portView) {
    return undefined;
  }

  return createConnectionPortState(state, portView);
}

/**
 * 在当前场景中根据 page 坐标命中一个端口。
 *
 * @param context - 当前交互运行时上下文。
 * @param point - 需要命中的 page 坐标。
 * @param direction - 目标端口方向。
 * @returns 命中到的端口状态。
 */
export function resolveLeaferGraphInteractionPortAtPoint<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  point: { x: number; y: number },
  direction: SlotDirection
): LeaferGraphConnectionPortState | undefined {
  // 先扫描所有与方向匹配的端口，并按命中矩形过滤出候选项。
  let bestMatch:
    | {
        port: LeaferGraphConnectionPortState;
        zIndex: number;
        distance: number;
      }
    | undefined;

  for (const state of context.options.nodeViews.values()) {
    for (const portView of state.shellView.portViews) {
      if (portView.layout.direction !== direction) {
        continue;
      }

      const port = createConnectionPortState(state, portView);
      if (!isPointInBounds(point, port.hitBounds)) {
        continue;
      }

      const rawZIndex = state.view.zIndex;
      const zIndex =
        typeof rawZIndex === "number" && Number.isFinite(rawZIndex)
          ? rawZIndex
          : 0;
      const distance = Math.hypot(
        point.x - port.center.x,
        point.y - port.center.y
      );

      if (
        !bestMatch ||
        zIndex > bestMatch.zIndex ||
        (zIndex === bestMatch.zIndex && distance < bestMatch.distance)
      ) {
        bestMatch = {
          port,
          zIndex,
          distance
        };
      }
    }
  }

  // 再按 zIndex 和距离做二次排序，保证拖线命中优先落在视觉最上层端口。
  return bestMatch?.port;
}

/**
 * 设置当前拖线起点端口高亮。
 *
 * @param context - 当前交互运行时上下文。
 * @param port - 当前来源端口。
 * @returns 无返回值。
 */
export function setLeaferGraphInteractionConnectionSourcePort<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  port: LeaferGraphConnectionPortState | null
): void {
  const nextKey = port ? getPortKey(port) : null;
  if (context.getActiveSourcePortKey() === nextKey) {
    return;
  }

  context.togglePortHighlight(context.getActiveSourcePortKey(), false);
  context.setActiveSourcePortKey(nextKey);
  context.togglePortHighlight(context.getActiveSourcePortKey(), true);
  context.options.requestRender();
}

/**
 * 设置当前拖线候选目标端口高亮。
 *
 * @param context - 当前交互运行时上下文。
 * @param port - 当前候选端口。
 * @returns 无返回值。
 */
export function setLeaferGraphInteractionConnectionCandidatePort<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  port: LeaferGraphConnectionPortState | null
): void {
  const nextKey = port ? getPortKey(port) : null;
  if (context.getActiveCandidatePortKey() === nextKey) {
    return;
  }

  context.togglePortHighlight(context.getActiveCandidatePortKey(), false);
  context.setActiveCandidatePortKey(nextKey);
  context.togglePortHighlight(context.getActiveCandidatePortKey(), true);
  context.options.requestRender();
}

/**
 * 更新拖拽中的连接预览线。
 *
 * @param context - 当前交互运行时上下文。
 * @param source - 当前来源端口。
 * @param pointer - 当前指针位置。
 * @param target - 当前候选目标端口。
 * @returns 无返回值。
 */
export function setLeaferGraphInteractionConnectionPreview<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  source: LeaferGraphConnectionPortState,
  pointer: { x: number; y: number },
  target?: LeaferGraphConnectionPortState
): void {
  const startDirection =
    source.direction === "input" ? PORT_DIRECTION_LEFT : PORT_DIRECTION_RIGHT;
  const endPoint = target?.center ?? pointer;
  const endDirection = target
    ? target.direction === "input"
      ? PORT_DIRECTION_LEFT
      : PORT_DIRECTION_RIGHT
    : endPoint.x >= source.center.x
      ? PORT_DIRECTION_LEFT
      : PORT_DIRECTION_RIGHT;

  context.previewPath.stroke = context.resolveConnectionPreviewStroke(source);
  context.previewPath.path = buildLinkPath(
    [source.center.x, source.center.y],
    [endPoint.x, endPoint.y],
    startDirection,
    endDirection
  );
  context.previewPath.visible = true;
  context.options.requestRender();
}

/**
 * 清理当前拖线预览线。
 *
 * @param context - 当前交互运行时上下文。
 * @returns 无返回值。
 */
export function clearLeaferGraphInteractionConnectionPreview<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>
): void {
  if (!context.previewPath.visible && !context.previewPath.path) {
    return;
  }

  context.previewPath.path = "";
  context.previewPath.visible = false;
  context.options.requestRender();
}

/**
 * 判断两个端口当前是否允许创建正式连线。
 *
 * @param context - 当前交互运行时上下文。
 * @param source - 当前来源端口。
 * @param target - 当前目标端口。
 * @returns 端口连接校验结果。
 */
export function canLeaferGraphInteractionCreateLink<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  source: LeaferGraphConnectionPortState,
  target: LeaferGraphConnectionPortState
): LeaferGraphConnectionValidationResult {
  // 先校验正式连线模型的基础约束，避免后续进入更重的场景查询。
  if (source.direction !== "output") {
    return {
      valid: false,
      reason: "当前只允许从输出端口开始连线"
    };
  }

  if (target.direction !== "input") {
    return {
      valid: false,
      reason: "连线目标必须是输入端口"
    };
  }

  const resolvedSource = resolveLeaferGraphInteractionPort(
    context,
    source.nodeId,
    source.direction,
    source.slot
  );
  if (!resolvedSource) {
    return {
      valid: false,
      reason: "未找到连线起点端口"
    };
  }

  const resolvedTarget = resolveLeaferGraphInteractionPort(
    context,
    target.nodeId,
    target.direction,
    target.slot
  );
  if (!resolvedTarget) {
    return {
      valid: false,
      reason: "未找到连线目标端口"
    };
  }

  // 再检查槽位类型与图内既有连线，确保当前连线提交具备正式落图条件。
  if (!areSlotTypesCompatible(resolvedSource.slotType, resolvedTarget.slotType)) {
    return {
      valid: false,
      reason: "端口类型不兼容"
    };
  }

  const existingLinks = context.options.sceneRuntime.findLinksByNode(source.nodeId);
  if (
    existingLinks.some(
      (link) =>
        link.source.nodeId === source.nodeId &&
        normalizeSlotIndex(link.source.slot) === source.slot &&
        link.target.nodeId === target.nodeId &&
        normalizeSlotIndex(link.target.slot) === target.slot
    )
  ) {
    return {
      valid: false,
      reason: "相同连线已存在"
    };
  }

  return { valid: true };
}

/**
 * 从两个合法端口创建一条正式连线。
 *
 * @param context - 当前交互运行时上下文。
 * @param source - 当前来源端口。
 * @param target - 当前目标端口。
 * @returns 是否成功创建正式连线。
 */
export function createLeaferGraphInteractionLink<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  source: LeaferGraphConnectionPortState,
  target: LeaferGraphConnectionPortState
): boolean {
  const validation = canLeaferGraphInteractionCreateLink(context, source, target);
  if (!validation.valid) {
    if (validation.reason) {
      console.warn(`[leafergraph] ${validation.reason}`, {
        source,
        target
      });
    }
    return false;
  }

  try {
    context.options.sceneRuntime.createLink({
      source: {
        nodeId: source.nodeId,
        slot: source.slot
      },
      target: {
        nodeId: target.nodeId,
        slot: target.slot
      }
    });
    return true;
  } catch (error) {
    console.error(
      "[leafergraph] 创建连线失败",
      {
        source,
        target
      },
      error
    );
    return false;
  }
}

/**
 * 读取当前起点端口对应的预览线颜色。
 *
 * @param context - 当前交互运行时上下文。
 * @param source - 当前来源端口。
 * @returns 预览线颜色。
 */
export function resolveLeaferGraphInteractionConnectionPreviewStroke<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends LeaferGraphInteractionRuntimeNodeViewState<TNodeState>
>(
  context: LeaferGraphInteractionRuntimeContext<TNodeState, TNodeViewState>,
  source: LeaferGraphConnectionPortState
): string {
  const node = context.options.nodeViews.get(source.nodeId)?.state;
  if (!node) {
    return context.options.resolveConnectionPreviewStrokeFallback();
  }

  return (
    resolveNodeSlotFill(node, source.direction, source.slot, {
      slotTypeFillMap: context.options.slotTypeFillMap,
      genericFill: context.options.genericPortFill
    }) ?? context.options.resolveConnectionPreviewStrokeFallback()
  );
}
