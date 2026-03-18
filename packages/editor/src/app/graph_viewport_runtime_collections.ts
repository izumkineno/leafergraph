import type { LeaferGraphNodeExecutionEvent } from "leafergraph";

export type GraphViewportRuntimeHistoryStatus =
  | LeaferGraphNodeExecutionEvent["state"]["status"]
  | "skipped";

export interface GraphViewportRuntimeHistoryEntry {
  id: string;
  chainId: string;
  rootNodeId: string;
  rootNodeTitle: string;
  rootNodeType: string | null;
  nodeId: string;
  nodeTitle: string;
  nodeType: string | null;
  depth: number;
  sequence: number;
  status: GraphViewportRuntimeHistoryStatus;
  source: LeaferGraphNodeExecutionEvent["source"];
  trigger: LeaferGraphNodeExecutionEvent["trigger"];
  summary: string;
  timestamp: number;
  runCount: number;
  errorMessage: string | null;
}

export interface GraphViewportRuntimeChainGroup {
  chainId: string;
  rootNodeId: string;
  rootNodeTitle: string;
  rootNodeType: string | null;
  source: LeaferGraphNodeExecutionEvent["source"];
  status: GraphViewportRuntimeHistoryStatus;
  startedAt: number;
  finishedAt: number;
  stepCount: number;
  maxDepth: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  directCount: number;
  propagatedCount: number;
  latestEntry: GraphViewportRuntimeHistoryEntry | null;
  entries: GraphViewportRuntimeHistoryEntry[];
}

export interface GraphViewportRuntimeFailureGroup {
  nodeId: string;
  nodeTitle: string;
  nodeType: string | null;
  failureCount: number;
  latestTimestamp: number;
  latestErrorMessage: string | null;
  latestSource: LeaferGraphNodeExecutionEvent["source"];
  latestTrigger: LeaferGraphNodeExecutionEvent["trigger"];
}

export interface GraphViewportRuntimeCollections {
  recentChains: readonly GraphViewportRuntimeChainGroup[];
  latestChain: GraphViewportRuntimeChainGroup | null;
  failures: readonly GraphViewportRuntimeFailureGroup[];
  latestErrorMessage: string | null;
}

const MAX_RUNTIME_HISTORY_ENTRIES = 8;
const MAX_RUNTIME_CHAIN_GROUPS = 4;
const MAX_RUNTIME_FAILURE_ENTRIES = 4;

function formatRuntimeTriggerLabel(
  trigger: LeaferGraphNodeExecutionEvent["trigger"]
): string {
  return trigger === "propagated" ? "链路传播" : "主动执行";
}

function formatRuntimeSourceLabel(
  source: LeaferGraphNodeExecutionEvent["source"] | null | undefined
): string {
  switch (source) {
    case "graph-play":
      return "图级 Play";
    case "graph-step":
      return "图级 Step";
    case "node-play":
      return "节点起跑";
    default:
      return "未知来源";
  }
}

function resolveRuntimeHistorySummary(
  source: LeaferGraphNodeExecutionEvent["source"],
  status: GraphViewportRuntimeHistoryStatus,
  trigger: LeaferGraphNodeExecutionEvent["trigger"],
  errorMessage: string | null
): string {
  const sourceLabel = formatRuntimeSourceLabel(source);
  const triggerLabel = formatRuntimeTriggerLabel(trigger);

  switch (status) {
    case "running":
      return `${sourceLabel}触发，${triggerLabel}已进入执行中。`;
    case "success":
      return `${sourceLabel}触发成功，${triggerLabel}结果已经写回运行时。`;
    case "error":
      return errorMessage
        ? `${sourceLabel}触发失败：${errorMessage}`
        : `${sourceLabel}触发失败，请查看控制台日志。`;
    case "skipped":
      return "这次执行没有命中可用的 onExecute(...)。";
    default:
      return "当前节点还没有执行记录。";
  }
}

export function createRuntimeHistoryEntryFromEvent(
  event: LeaferGraphNodeExecutionEvent
): GraphViewportRuntimeHistoryEntry {
  return {
    id: `${event.chainId}:${event.sequence}:${event.nodeId}:${event.state.status}`,
    chainId: event.chainId,
    rootNodeId: event.rootNodeId,
    rootNodeTitle: event.rootNodeTitle,
    rootNodeType: event.rootNodeType,
    nodeId: event.nodeId,
    nodeTitle: event.nodeTitle,
    nodeType: event.nodeType,
    depth: event.depth,
    sequence: event.sequence,
    status: event.state.status,
    source: event.source,
    trigger: event.trigger,
    summary: resolveRuntimeHistorySummary(
      event.source,
      event.state.status,
      event.trigger,
      event.state.lastErrorMessage ?? null
    ),
    timestamp: event.timestamp,
    runCount: event.state.runCount,
    errorMessage: event.state.lastErrorMessage ?? null
  };
}

export function appendRuntimeHistoryEntry(
  entries: readonly GraphViewportRuntimeHistoryEntry[],
  entry: GraphViewportRuntimeHistoryEntry
): GraphViewportRuntimeHistoryEntry[] {
  return [entry, ...entries].slice(0, MAX_RUNTIME_HISTORY_ENTRIES);
}

function resolveRuntimeChainStatus(
  entries: readonly GraphViewportRuntimeHistoryEntry[]
): GraphViewportRuntimeHistoryStatus {
  if (entries.some((entry) => entry.status === "error")) {
    return "error";
  }

  if (entries.some((entry) => entry.status === "running")) {
    return "running";
  }

  if (entries.some((entry) => entry.status === "success")) {
    return "success";
  }

  return "skipped";
}

export function groupRuntimeHistoryEntries(
  entries: readonly GraphViewportRuntimeHistoryEntry[]
): GraphViewportRuntimeChainGroup[] {
  const chainMap = new Map<string, GraphViewportRuntimeChainGroup>();
  const orderedChains: GraphViewportRuntimeChainGroup[] = [];

  for (const entry of entries) {
    let chain = chainMap.get(entry.chainId);

    if (!chain) {
      chain = {
        chainId: entry.chainId,
        rootNodeId: entry.rootNodeId,
        rootNodeTitle: entry.rootNodeTitle,
        rootNodeType: entry.rootNodeType,
        source: entry.source,
        status: entry.status,
        startedAt: entry.timestamp,
        finishedAt: entry.timestamp,
        stepCount: 0,
        maxDepth: entry.depth,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        directCount: 0,
        propagatedCount: 0,
        latestEntry: null,
        entries: []
      };
      chainMap.set(entry.chainId, chain);
      orderedChains.push(chain);
    }

    chain.startedAt = Math.min(chain.startedAt, entry.timestamp);
    chain.finishedAt = Math.max(chain.finishedAt, entry.timestamp);
    chain.stepCount += 1;
    chain.maxDepth = Math.max(chain.maxDepth, entry.depth);
    chain.entries.push(entry);
    chain.source = entry.source;

    if (entry.status === "success") {
      chain.successCount += 1;
    } else if (entry.status === "error") {
      chain.errorCount += 1;
    } else if (entry.status === "skipped") {
      chain.skippedCount += 1;
    }

    if (entry.trigger === "direct") {
      chain.directCount += 1;
    } else {
      chain.propagatedCount += 1;
    }
  }

  for (const chain of orderedChains) {
    chain.entries.sort(
      (left, right) =>
        left.sequence - right.sequence || left.timestamp - right.timestamp
    );
    chain.status = resolveRuntimeChainStatus(chain.entries);
    chain.latestEntry = chain.entries[chain.entries.length - 1] ?? null;
  }

  return orderedChains.slice(0, MAX_RUNTIME_CHAIN_GROUPS);
}

export function groupRuntimeFailureEntries(
  entries: readonly GraphViewportRuntimeHistoryEntry[]
): GraphViewportRuntimeFailureGroup[] {
  const groups = new Map<string, GraphViewportRuntimeFailureGroup>();

  for (const entry of entries) {
    if (entry.status !== "error") {
      continue;
    }

    const group = groups.get(entry.nodeId);
    if (!group) {
      groups.set(entry.nodeId, {
        nodeId: entry.nodeId,
        nodeTitle: entry.nodeTitle,
        nodeType: entry.nodeType,
        failureCount: 1,
        latestTimestamp: entry.timestamp,
        latestErrorMessage: entry.errorMessage,
        latestSource: entry.source,
        latestTrigger: entry.trigger
      });
      continue;
    }

    group.failureCount += 1;

    if (entry.timestamp >= group.latestTimestamp) {
      group.nodeTitle = entry.nodeTitle;
      group.nodeType = entry.nodeType;
      group.latestTimestamp = entry.timestamp;
      group.latestErrorMessage = entry.errorMessage;
      group.latestSource = entry.source;
      group.latestTrigger = entry.trigger;
    }
  }

  return [...groups.values()]
    .sort((left, right) => right.latestTimestamp - left.latestTimestamp)
    .slice(0, MAX_RUNTIME_FAILURE_ENTRIES);
}

/**
 * 为 GraphViewport 提供稳定的运行态摘要引用。
 *
 * @remarks
 * 首屏问题的根因之一是：
 * 在 history 没变化时重复产出新数组/新对象，导致父子组件之间形成
 * `workspaceState -> setState -> rerender -> new workspaceState` 的回写回环。
 * 这里用一个轻量 projector 把“相同输入返回同一引用”固定下来。
 */
export function createGraphViewportRuntimeCollectionsProjector(): (
  entries: readonly GraphViewportRuntimeHistoryEntry[],
  fallbackErrorMessage: string | null | undefined
) => GraphViewportRuntimeCollections {
  let previousEntries: readonly GraphViewportRuntimeHistoryEntry[] | null = null;
  let previousFallbackErrorMessage: string | null | undefined = undefined;
  let previousResult: GraphViewportRuntimeCollections | null = null;

  return (
    entries: readonly GraphViewportRuntimeHistoryEntry[],
    fallbackErrorMessage: string | null | undefined
  ): GraphViewportRuntimeCollections => {
    if (
      previousResult &&
      previousEntries === entries &&
      previousFallbackErrorMessage === fallbackErrorMessage
    ) {
      return previousResult;
    }

    const recentChains = groupRuntimeHistoryEntries(entries);
    const latestChain = recentChains[0] ?? null;
    const result: GraphViewportRuntimeCollections = {
      recentChains,
      latestChain,
      failures: groupRuntimeFailureEntries(entries),
      latestErrorMessage:
        latestChain?.latestEntry?.errorMessage ?? fallbackErrorMessage ?? null
    };

    previousEntries = entries;
    previousFallbackErrorMessage = fallbackErrorMessage;
    previousResult = result;
    return result;
  };
}
