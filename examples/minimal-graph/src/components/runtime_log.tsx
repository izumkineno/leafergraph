/**
 * 最小图示例运行日志组件。
 *
 * @remarks
 * 负责把 hook 产出的运行反馈列表渲染成可滚动的时间线，
 * 不承担日志格式化和图实例订阅职责。
 */
import type { JSX } from "preact";

import type { ExampleLogEntry } from "../graph/use_example_graph";

/** 运行日志组件的最小输入。 */
export interface ExampleRuntimeLogProps {
  /** 当前所有已收集的运行日志。 */
  logs: readonly ExampleLogEntry[];
  /** 日志为空时的占位文案。 */
  emptyText?: string;
}

function formatTimeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour12: false
  });
}

/**
 * 运行日志列表。
 *
 * @param props - 当前日志列表和空态文案。
 * @returns 运行反馈可视化结果。
 */
export function ExampleRuntimeLog(
  props: ExampleRuntimeLogProps
): JSX.Element {
  if (!props.logs.length) {
    return (
      <p class="example-log-empty">
        {props.emptyText ?? "还没有运行反馈。点击左侧 Play 或 Step 开始。"}
      </p>
    );
  }

  return (
    <div class="example-log">
      {props.logs.map((entry, index) => (
        <article
          key={`${entry.timestamp}:${index}`}
          class="example-log-item"
        >
          <div class="example-log-time">
            {formatTimeLabel(entry.timestamp)}
          </div>
          <div class="example-log-message">{entry.message}</div>
        </article>
      ))}
    </div>
  );
}
