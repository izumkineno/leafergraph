import {
  BaseNode,
  defineAuthoringNode,
  type DevNodeContext
} from "@leafergraph/authoring";

import {
  AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT,
  AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
  AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_LOCAL_TYPE
} from "../shared";

/** `PulseCounterNode` 运行时会读写的属性集合。 */
interface PulseCounterProps {
  [key: string]: unknown;
  runCount?: number;
  status?: string;
  subtitle?: string;
}

/**
 * 最小流程节点。
 *
 * 它专门用来演示：
 * - `system/on-play` 等执行源如何驱动普通节点
 * - 节点如何在每次运行后更新内部计数
 */
export class PulseCounterNode extends BaseNode<PulseCounterProps> {
  static meta = {
    type: AUTHORING_BROWSER_TEMPLATE_PULSE_COUNTER_LOCAL_TYPE,
    title: "Pulse Counter",
    description: "最小流程节点，可由 system/on-play 触发并向下游输出计数。",
    size: [
      AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
      AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT
    ] as [number, number],
    resize: {
      enabled: true,
      minWidth: AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
      minHeight: AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT,
      snap: 4
    },
    inputs: [{ name: "Start", type: "event" }],
    outputs: [{ name: "Count", type: "number" }],
    properties: [
      { name: "runCount", type: "number", default: 0 },
      {
        name: "subtitle",
        type: "string",
        default: "可由 system/on-play 直接触发"
      },
      { name: "status", type: "string", default: "READY" }
    ]
  };

  /**
   *  每次执行时把内部计数递增，并输出到下游。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx: DevNodeContext<PulseCounterProps>) {
    const previous = Number(ctx.props.runCount ?? 0);
    const nextCount = Number.isFinite(previous) ? previous + 1 : 1;

    ctx.setProp("runCount", nextCount);
    ctx.setProp("subtitle", "图级 on-play 可直接驱动这一条最小流程链");
    ctx.setProp("status", `PULSE ${nextCount}`);
    ctx.setOutputAt(0, nextCount);
    ctx.node.title = `Pulse ${nextCount}`;
  }
}

/** `PulseCounterNode` 对应的正式节点定义。 */
export const pulseCounterNodeDefinition =
  defineAuthoringNode(PulseCounterNode);
