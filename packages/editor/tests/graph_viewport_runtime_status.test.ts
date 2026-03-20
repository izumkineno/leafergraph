import { describe, expect, test } from "bun:test";

import type { LeaferGraphGraphExecutionState } from "leafergraph";

import type { GraphViewportRuntimeChainGroup } from "../src/app/graph_viewport_runtime_collections";
import { resolveGraphViewportRuntimeDetailLabel } from "../src/app/graph_viewport_runtime_status";

function createExecutionState(
  overrides: Partial<LeaferGraphGraphExecutionState> = {}
): LeaferGraphGraphExecutionState {
  return {
    status: "idle",
    queueSize: 0,
    stepCount: 0,
    ...overrides
  };
}

function createLatestChain(
  overrides: Partial<GraphViewportRuntimeChainGroup> = {}
): GraphViewportRuntimeChainGroup {
  return {
    chainId: "chain-1",
    rootNodeId: "node-on-play",
    rootNodeTitle: "On Play",
    rootNodeType: "system/on-play",
    source: "graph-step",
    status: "success",
    startedAt: 1_000,
    finishedAt: 1_010,
    stepCount: 1,
    maxDepth: 0,
    successCount: 1,
    errorCount: 0,
    skippedCount: 0,
    directCount: 1,
    propagatedCount: 0,
    latestEntry: {
      id: "chain-1:0:node-on-play:success",
      chainId: "chain-1",
      rootNodeId: "node-on-play",
      rootNodeTitle: "On Play",
      rootNodeType: "system/on-play",
      nodeId: "node-on-play",
      nodeTitle: "On Play",
      nodeType: "system/on-play",
      depth: 0,
      sequence: 0,
      status: "success",
      source: "graph-step",
      trigger: "direct",
      summary: "图级 Step 触发成功",
      timestamp: 1_010,
      runCount: 1,
      errorMessage: null
    },
    entries: [],
    ...overrides
  };
}

describe("resolveGraphViewportRuntimeDetailLabel", () => {
  test("图空闲且最近一次 step 只命中入口节点时，应给出明确提示", () => {
    expect(
      resolveGraphViewportRuntimeDetailLabel(
        createExecutionState(),
        createLatestChain()
      )
    ).toBe("最近一次 Step 先命中入口节点 On Play");
  });

  test("图运行中时，应优先展示当前队列推进摘要", () => {
    expect(
      resolveGraphViewportRuntimeDetailLabel(
        createExecutionState({
          status: "running",
          queueSize: 2,
          stepCount: 3
        }),
        null
      )
    ).toBe("当前队列 2，已推进 3 步");
  });

  test("普通成功链结束后，应回落到最近执行摘要", () => {
    expect(
      resolveGraphViewportRuntimeDetailLabel(
        createExecutionState(),
        createLatestChain({
          source: "graph-play",
          stepCount: 2,
          maxDepth: 1,
          propagatedCount: 1,
          latestEntry: {
            ...createLatestChain().latestEntry!,
            nodeId: "node-display",
            nodeTitle: "Display",
            depth: 1,
            sequence: 1,
            source: "graph-play",
            trigger: "propagated"
          }
        })
      )
    ).toBe("最近Play已完成：Display");
  });
});
