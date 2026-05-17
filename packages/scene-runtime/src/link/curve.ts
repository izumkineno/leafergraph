/**
 * 连线共享曲线模块。
 *
 * @remarks
 * 负责把正式连线与数据流动画都依赖的锚点和贝塞尔曲线求解规则集中到一处。
 */

import type { NodeRuntimeState } from "@leafergraph/core/node";
import {
  PORT_DIRECTION_LEFT,
  PORT_DIRECTION_RIGHT,
  resolveLinkCurve,
  type LinkBezierCurve
} from "./link";
import type { NodeShellLayoutMetrics } from "../node/shell/layout";
import { resolveNodePortAnchorYForNode } from "../node/shell/ports";

/**
 * 连线求解阶段只依赖节点布局和槽位结构。
 */
export type LeaferGraphLinkNodeState = Pick<
  NodeRuntimeState,
  "layout" | "inputs" | "outputs" | "flags"
>;

/**
 * 根据节点与槽位解析正式连线曲线时需要的输入。
 *
 * @remarks
 * 连线渲染与数据流动画都应复用这份输入，避免两边各自维护锚点规则。
 */
export interface ResolveGraphLinkCurveInput<
  TNodeState extends LeaferGraphLinkNodeState
> {
  source: TNodeState;
  target: TNodeState;
  sourceSlot: number;
  targetSlot: number;
  layoutMetrics: NodeShellLayoutMetrics;
  defaultNodeWidth: number;
  portSize: number;
}

/**
 * 根据节点与槽位解析一条正式连线的共享三次贝塞尔曲线。
 *
 * @param input - 曲线求解输入。
 * @returns 解析后的三次贝塞尔曲线。
 */
export function resolveGraphLinkCurve<
  TNodeState extends LeaferGraphLinkNodeState
>(input: ResolveGraphLinkCurveInput<TNodeState>): LinkBezierCurve {
  const sourceWidth = input.source.layout.width ?? input.defaultNodeWidth;

  return resolveLinkCurve(
    {
      sourceX: input.source.layout.x,
      sourceY: input.source.layout.y,
      sourceWidth,
      targetX: input.target.layout.x,
      targetY: input.target.layout.y,
      sourcePortY: resolveNodePortAnchorYForNode(
        input.source,
        "output",
        input.sourceSlot,
        input.layoutMetrics
      ),
      targetPortY: resolveNodePortAnchorYForNode(
        input.target,
        "input",
        input.targetSlot,
        input.layoutMetrics
      ),
      portSize: input.portSize
    },
    PORT_DIRECTION_RIGHT,
    PORT_DIRECTION_LEFT
  );
}
