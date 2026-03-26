import { describe, expect, test } from "bun:test";

import {
  createGraphViewportRuntimeCollectionsProjector,
  type GraphViewportRuntimeHistoryEntry
} from "../src/ui/viewport/runtime_collections";

function createHistoryEntry(
  overrides: Partial<GraphViewportRuntimeHistoryEntry> = {}
): GraphViewportRuntimeHistoryEntry {
  return {
    id: "chain-1:0:node-1:success",
    chainId: "chain-1",
    rootNodeId: "node-1",
    rootNodeTitle: "Node 1",
    rootNodeType: "template/node",
    nodeId: "node-1",
    nodeTitle: "Node 1",
    nodeType: "template/node",
    depth: 0,
    sequence: 0,
    status: "success",
    source: "graph-play",
    trigger: "direct",
    summary: "图级 Play 触发成功",
    timestamp: 1_000,
    runCount: 1,
    errorMessage: null,
    ...overrides
  };
}

describe("createGraphViewportRuntimeCollectionsProjector", () => {
  test("相同输入应复用同一份运行态摘要引用，避免 workspaceState 回写形成重渲染回环", () => {
    const projector = createGraphViewportRuntimeCollectionsProjector();
    const historyEntries = [createHistoryEntry()];

    const first = projector(historyEntries, null);
    const second = projector(historyEntries, null);

    expect(second).toBe(first);
    expect(second.recentChains).toBe(first.recentChains);
    expect(second.failures).toBe(first.failures);
    expect(second.latestChain).toBe(first.latestChain);
    expect(second.latestErrorMessage).toBeNull();
  });

  test("历史输入变化后应生成新的运行态摘要", () => {
    const projector = createGraphViewportRuntimeCollectionsProjector();
    const firstHistoryEntries = [createHistoryEntry()];
    const secondHistoryEntries = [
      createHistoryEntry({
        id: "chain-2:1:node-2:error",
        chainId: "chain-2",
        rootNodeId: "node-2",
        rootNodeTitle: "Node 2",
        nodeId: "node-2",
        nodeTitle: "Node 2",
        sequence: 1,
        depth: 1,
        status: "error",
        trigger: "propagated",
        timestamp: 2_000,
        errorMessage: "boom"
      }),
      createHistoryEntry()
    ];

    const first = projector(firstHistoryEntries, null);
    const second = projector(secondHistoryEntries, null);

    expect(second).not.toBe(first);
    expect(second.recentChains).not.toBe(first.recentChains);
    expect(second.failures).not.toBe(first.failures);
    expect(second.latestErrorMessage).toBe("boom");
  });

  test("当 history 本身没有 error 时，应回退到 inspector 提供的错误摘要", () => {
    const projector = createGraphViewportRuntimeCollectionsProjector();
    const historyEntries = [createHistoryEntry({ status: "success" })];

    const result = projector(historyEntries, "fallback error");

    expect(result.latestErrorMessage).toBe("fallback error");
  });
});
