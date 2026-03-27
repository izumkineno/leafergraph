/**
 * Tauri authority demo 运行反馈格式化模块。
 *
 * @remarks
 * 负责把 `RuntimeFeedbackEvent` 收敛成适合 UI 日志展示的短文本，
 * 不承担日志存储和订阅职责。
 */
import type { RuntimeFeedbackEvent } from "leafergraph";

/** 把任意运行值格式化成短文本。 */
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

/** 把统一运行反馈事件映射成日志面板可直接展示的一行文案。 */
export function formatRuntimeFeedback(event: RuntimeFeedbackEvent): string {
  switch (event.type) {
    case "graph.execution":
      return `图执行 ${event.event.type}，状态=${event.event.state.status}，步数=${event.event.state.stepCount}`;
    case "node.execution":
      return `节点执行 ${event.event.nodeTitle}，来源=${event.event.source}，序号=${event.event.sequence}`;
    case "link.propagation":
      return `连线传播 ${event.event.sourceNodeId} -> ${event.event.targetNodeId}，值=${formatRuntimeValue(event.event.payload)}`;
    case "node.state":
      return `节点状态 ${event.event.nodeId} -> ${event.event.reason}，exists=${event.event.exists}`;
    default:
      return "收到未知运行反馈";
  }
}
