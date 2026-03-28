/**
 * 运行反馈格式化工具。
 *
 * 这个文件只负责把运行时事件转成适合 UI 展示的短文本，
 * 不负责订阅、存储或渲染日志。
 */
import type { RuntimeFeedbackEvent } from "leafergraph";

/** 把任意运行值格式化成适合日志和标题展示的短文本。 */
export function formatRuntimeValue(value: unknown): string {
  if (value === undefined) {
    return "EMPTY";
  }

  if (value === null) {
    return "null";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    const text = JSON.stringify(value);
    return text.length > 96 ? `${text.slice(0, 93)}...` : text;
  } catch {
    return String(value);
  }
}

/** 把统一运行反馈事件压缩成一行简洁中文日志。 */
export function formatRuntimeFeedback(event: RuntimeFeedbackEvent): string {
  switch (event.type) {
    case "graph.execution":
      return `图执行 ${event.event.type}，状态=${event.event.state.status}，步数=${event.event.state.stepCount}`;
    case "node.execution":
      return `节点执行 ${event.event.nodeTitle}，来源=${event.event.source}，序号=${event.event.sequence}`;
    case "node.state":
      return `节点状态 ${event.event.nodeId} -> ${event.event.reason}，exists=${event.event.exists}`;
    case "link.propagation":
      return `连线传播 ${event.event.sourceNodeId} -> ${event.event.targetNodeId}`;
    default:
      return "收到未知运行反馈";
  }
}
