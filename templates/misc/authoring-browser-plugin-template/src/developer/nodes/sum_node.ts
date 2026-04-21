import {
  BaseNode,
  defineAuthoringNode,
  type DevNodeContext
} from "@leafergraph/extensions/authoring";

import {
  AUTHORING_BROWSER_TEMPLATE_NODE_MIN_HEIGHT,
  AUTHORING_BROWSER_TEMPLATE_NODE_WIDTH,
  AUTHORING_BROWSER_TEMPLATE_SUM_LOCAL_TYPE
} from "../shared";

/** `SumNode` 运行时会读写的属性集合。 */
interface SumNodeProps {
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
export class SumNode extends BaseNode<SumNodeProps> {
  static meta = {
    type: AUTHORING_BROWSER_TEMPLATE_SUM_LOCAL_TYPE,
    title: "Sum",
    description: "最小计算节点，演示作者层输入、输出与属性默认值。",
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
    inputs: [
      { name: "A", type: "number" },
      { name: "B", type: "number" }
    ],
    outputs: [{ name: "Result", type: "number" }],
    properties: [
      { name: "precision", type: "number", default: 2 },
      { name: "status", type: "string", default: "READY" },
      { name: "subtitle", type: "string", default: "等待输入" }
    ]
  };

  /**
   *  每次执行时同步更新输出、说明文字和标题。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx: DevNodeContext<SumNodeProps>) {
    const a = Number(ctx.getInputAt(0) ?? 0);
    const b = Number(ctx.getInputAt(1) ?? 0);
    const precision = clampPrecision(ctx.props.precision);
    const factor = 10 ** precision;
    const result = Math.round((a + b) * factor) / factor;

    ctx.setOutputAt(0, result);
    ctx.setProp("subtitle", `A=${a}，B=${b}`);
    ctx.setProp("status", `SUM ${result}`);
    ctx.node.title = `Sum ${result}`;
  }
}

/** `SumNode` 对应的正式节点定义。 */
export const sumNodeDefinition = defineAuthoringNode(SumNode);
