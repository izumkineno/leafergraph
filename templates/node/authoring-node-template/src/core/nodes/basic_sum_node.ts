import {
  BaseNode,
  defineAuthoringNode,
  type DevNodeContext
} from "@leafergraph/authoring";

import {
  AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE,
  AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT,
  AUTHORING_NODE_TEMPLATE_NODE_WIDTH
} from "../shared";

interface BasicSumProps {
  [key: string]: unknown;
  precision?: number;
  status?: string;
  subtitle?: string;
}

function clampPrecision(value: unknown): number {
  const precision = Number(value);
  if (!Number.isFinite(precision)) {
    return 2;
  }

  return Math.min(6, Math.max(0, Math.round(precision)));
}

export class BasicSumNode extends BaseNode<BasicSumProps> {
  static meta = {
    type: AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE,
    title: "Basic Sum",
    description: "最小计算节点模板，演示输入、输出、属性默认值和 onExecute。",
    size: [
      AUTHORING_NODE_TEMPLATE_NODE_WIDTH,
      AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT
    ] as [number, number],
    resize: {
      enabled: true,
      minWidth: AUTHORING_NODE_TEMPLATE_NODE_WIDTH,
      minHeight: AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT,
      snap: 4
    },
    inputs: [
      { name: "A", type: "number" },
      { name: "B", type: "number" }
    ],
    outputs: [{ name: "Result", type: "number" }],
    properties: [
      { name: "precision", type: "number", default: 2 },
      { name: "status", type: "string", default: "READY" },
      { name: "subtitle", type: "string", default: "等待数值输入" }
    ]
  };

  onExecute(ctx: DevNodeContext<BasicSumProps>) {
    const a = Number(ctx.getInputAt(0) ?? 0);
    const b = Number(ctx.getInputAt(1) ?? 0);
    const precision = clampPrecision(ctx.props.precision);
    const factor = 10 ** precision;
    const result = Math.round((a + b) * factor) / factor;

    ctx.setOutputAt(0, result);
    ctx.setProp("subtitle", `A=${a}，B=${b}`);
    ctx.setProp("status", `SUM ${result}`);
    ctx.setData("lastResult", result);
    ctx.node.title = `Sum ${result}`;
  }
}

export const basicSumNodeDefinition = defineAuthoringNode(BasicSumNode);
