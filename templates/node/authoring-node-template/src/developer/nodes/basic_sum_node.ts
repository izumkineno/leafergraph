import {
  BaseNode,
  defineAuthoringNode,
  type DevNodeContext
} from "@leafergraph/extensions/authoring";

import {
  AUTHORING_NODE_TEMPLATE_BASIC_SUM_LOCAL_TYPE,
  AUTHORING_NODE_TEMPLATE_NODE_MIN_HEIGHT,
  AUTHORING_NODE_TEMPLATE_NODE_WIDTH
} from "../shared";

/** `BasicSumNode` 运行时会读写的属性集合。 */
interface BasicSumProps {
  [key: string]: unknown;
  precision?: number;
  status?: string;
  subtitle?: string;
}

/**
 * 把任意输入收敛到合法精度位数。
 *
 * 模板默认把精度钳制在 `0..6`，
 * 这样既能演示属性读取，也能避免示例节点输出过长的小数串。
 *
 * @param value - 当前值。
 * @returns 限制`Precision`的结果。
 */
function clampPrecision(value: unknown): number {
  const precision = Number(value);
  if (!Number.isFinite(precision)) {
    return 2;
  }

  return Math.min(6, Math.max(0, Math.round(precision)));
}

/**
 * 最小计算节点。
 *
 * 它的职责很单纯：
 * - 读取两个数字输入
 * - 根据属性里的精度做四舍五入
 * - 把结果写回输出、状态和标题
 */
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

  /**
   *  每次执行时同步更新输出、说明文字和最近结果。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
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

/** `BasicSumNode` 对应的正式节点定义。 */
export const basicSumNodeDefinition = defineAuthoringNode(BasicSumNode);
