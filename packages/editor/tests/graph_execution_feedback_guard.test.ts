import { describe, expect, test } from "bun:test";

import type { RuntimeFeedbackEvent } from "leafergraph";
import { shouldIgnoreProjectedGraphExecutionFeedback } from "../src/ui/viewport/graph_execution_feedback_guard";

function createGraphExecutionFeedback(
  type: "started" | "advanced" | "drained" | "stopped",
  status: "idle" | "running" | "stepping"
): RuntimeFeedbackEvent {
  return {
    type: "graph.execution",
    event: {
      type,
      state: {
        status,
        queueSize: status === "idle" ? 0 : 1,
        stepCount: status === "idle" ? 3 : 4
      },
      runId: status === "idle" ? undefined : "graph:run-1",
      source: "graph-play",
      nodeId: status === "idle" ? undefined : "timer-node",
      timestamp: 1
    }
  };
}

describe("shouldIgnoreProjectedGraphExecutionFeedback", () => {
  test("远端 authority 投影期间应忽略本地 stopped 噪声", () => {
    expect(
      shouldIgnoreProjectedGraphExecutionFeedback({
        runtimeControlMode: "remote",
        feedback: createGraphExecutionFeedback("stopped", "idle"),
        isProjectingAuthorityDocument: true,
        isExternalRuntimeFeedback: false,
        latestRemoteGraphExecutionState: {
          status: "running",
          runId: "graph:run-1",
          queueSize: 0,
          stepCount: 4,
          startedAt: 1
        }
      })
    ).toBe(true);
  });

  test("真实远端 stopped 反馈不应被忽略", () => {
    expect(
      shouldIgnoreProjectedGraphExecutionFeedback({
        runtimeControlMode: "remote",
        feedback: createGraphExecutionFeedback("stopped", "idle"),
        isProjectingAuthorityDocument: true,
        isExternalRuntimeFeedback: true,
        latestRemoteGraphExecutionState: {
          status: "running",
          runId: "graph:run-1",
          queueSize: 0,
          stepCount: 4,
          startedAt: 1
        }
      })
    ).toBe(false);
  });

  test("远端已空闲时不应继续屏蔽本地执行态事件", () => {
    expect(
      shouldIgnoreProjectedGraphExecutionFeedback({
        runtimeControlMode: "remote",
        feedback: createGraphExecutionFeedback("stopped", "idle"),
        isProjectingAuthorityDocument: true,
        isExternalRuntimeFeedback: false,
        latestRemoteGraphExecutionState: {
          status: "idle",
          queueSize: 0,
          stepCount: 4,
          startedAt: 1,
          stoppedAt: 2
        }
      })
    ).toBe(false);
  });
});
