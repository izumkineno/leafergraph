/**
 * Tauri authority demo 运行日志组件。
 *
 * @remarks
 * 负责把 hook 产出的日志记录渲染成可滚动时间线，
 * 不承担日志收集和运行反馈格式化职责。
 */
import type { JSX } from "preact";

import type { DemoLogEntry } from "../graph/use_tauri_sync_graph";

/** 运行日志组件的最小输入。 */
export interface DemoRuntimeLogProps {
  /** 当前全部日志。 */
  logs: readonly DemoLogEntry[];
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
 * @param props - 当前日志和空态文案。
 * @returns 运行反馈时间线。
 */
export function DemoRuntimeLog(
  props: DemoRuntimeLogProps
): JSX.Element {
  if (!props.logs.length) {
    return (
      <p class="demo-log-empty">
        {props.emptyText ?? "还没有收到后端反馈。点击 Play 或 Step 开始。"}
      </p>
    );
  }

  return (
    <div class="demo-log">
      {props.logs.map((entry, index) => (
        <article
          key={`${entry.timestamp}:${index}`}
          class="demo-log-item"
        >
          <div class="demo-log-time">{formatTimeLabel(entry.timestamp)}</div>
          <div class="demo-log-message">{entry.message}</div>
        </article>
      ))}
    </div>
  );
}
