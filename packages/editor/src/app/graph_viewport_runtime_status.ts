import type { LeaferGraphGraphExecutionState } from "leafergraph";

import type { GraphViewportRuntimeChainGroup } from "./graph_viewport_runtime_collections";

function formatRuntimeSourceLabel(
  source: GraphViewportRuntimeChainGroup["source"]
): string {
  switch (source) {
    case "graph-play":
      return "Play";
    case "graph-step":
      return "Step";
    case "node-play":
      return "节点运行";
    default:
      return "运行";
  }
}

function formatRuntimeHistoryStatusLabel(
  status: NonNullable<GraphViewportRuntimeChainGroup["latestEntry"]>["status"]
): string {
  switch (status) {
    case "running":
      return "执行中";
    case "success":
      return "已完成";
    case "error":
      return "失败";
    case "skipped":
      return "已跳过";
    default:
      return "已结束";
  }
}

/**
 * 生成 editor 壳层可直接展示的运行态补充摘要。
 *
 * @remarks
 * 这条摘要只补“最近一次推进到了哪里”，不改变底层运行语义。
 * 目标是让第一次 Step 命中入口节点时，也能在状态栏和控制台里看到
 * 明确反馈，而不是误判成“按钮没反应”。
 */
export function resolveGraphViewportRuntimeDetailLabel(
  executionState: LeaferGraphGraphExecutionState,
  latestChain: GraphViewportRuntimeChainGroup | null
): string | null {
  if (executionState.status === "running") {
    return `当前队列 ${executionState.queueSize}，已推进 ${executionState.stepCount} 步`;
  }

  if (executionState.status === "stepping") {
    return `当前单步已推进 ${executionState.stepCount} 步`;
  }

  const latestEntry = latestChain?.latestEntry;
  if (!latestEntry) {
    return null;
  }

  const nodeLabel = latestEntry.nodeTitle?.trim() || latestEntry.nodeId;
  if (
    latestEntry.source === "graph-step" &&
    latestChain?.stepCount === 1 &&
    latestEntry.depth === 0 &&
    latestEntry.trigger === "direct"
  ) {
    return `最近一次 Step 先命中入口节点 ${nodeLabel}`;
  }

  return `最近${formatRuntimeSourceLabel(latestEntry.source)}${formatRuntimeHistoryStatusLabel(
    latestEntry.status
  )}：${nodeLabel}`;
}
