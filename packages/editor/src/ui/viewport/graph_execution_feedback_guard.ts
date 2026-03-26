/**
 * 图执行反馈过滤模块。
 *
 * @remarks
 * 负责在 remote authority 模式下过滤由文档投影带来的执行态重置噪声，
 * 让 run console 和状态栏只展示真正的 runtime 反馈。
 */
import type {
  LeaferGraphGraphExecutionState,
  RuntimeFeedbackEvent
} from "leafergraph";

/**
 * 判断当前图执行反馈是否属于 authority 文档投影期间的本地噪声。
 *
 * @remarks
 * remote mode 下，`graph.replaceGraphDocument(...)` 会触发主包 restore，
 * restore 又会把本地图执行态重置为 `stopped/idle`。
 * 当 authority 自己仍处于 `running/stepping` 时，这条本地事件不应覆盖 UI。
 */
export function shouldIgnoreProjectedGraphExecutionFeedback(input: {
  runtimeControlMode: "local" | "remote";
  feedback: RuntimeFeedbackEvent;
  isProjectingAuthorityDocument: boolean;
  hasPendingProjectedReset: boolean;
  isExternalRuntimeFeedback: boolean;
  latestRemoteGraphExecutionState: LeaferGraphGraphExecutionState | null;
}): boolean {
  if (
    input.runtimeControlMode !== "remote" ||
    input.isExternalRuntimeFeedback ||
    input.feedback.type !== "graph.execution"
  ) {
    return false;
  }

  const latestRemoteStatus = input.latestRemoteGraphExecutionState?.status;
  if (latestRemoteStatus !== "running" && latestRemoteStatus !== "stepping") {
    return false;
  }

  if (
    !input.isProjectingAuthorityDocument &&
    !input.hasPendingProjectedReset
  ) {
    return false;
  }

  return (
    input.feedback.event.type === "stopped" &&
    input.feedback.event.state.status === "idle"
  );
}
