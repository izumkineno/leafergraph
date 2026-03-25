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

interface PulseCounterProps {
  [key: string]: unknown;
  runCount?: number;
  status?: string;
  subtitle?: string;
}

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

export const pulseCounterNodeDefinition =
  defineAuthoringNode(PulseCounterNode);
