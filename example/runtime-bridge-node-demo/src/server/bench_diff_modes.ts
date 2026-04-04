import { performance } from "node:perf_hooks";
import { Buffer } from "node:buffer";
import { WebSocket, type RawData } from "ws";
import type { GraphOperation } from "@leafergraph/contracts";
import type {
  RuntimeBridgeCommand,
  RuntimeBridgeDiffMode,
  RuntimeBridgeInboundEvent
} from "@leafergraph/runtime-bridge/transport";
import type {
  DemoBridgeClientMessage,
  DemoBridgeServerMessage
} from "../shared/protocol";
import {
  parseDemoBridgeMessage,
  serializeDemoBridgeMessage
} from "../shared/protocol";
import { setRuntimeBridgeNodeDemoLoggingMuted } from "./logging";
import { startRuntimeBridgeNodeDemoServer } from "./websocket_server";

type BenchmarkConfig = {
  batchCount: number;
  batchSize: number;
  warmupBatches: number;
  blueprintEntryId: string;
  nodeId: string;
  widgetIndex: number;
};

type ModeMetrics = {
  mode: RuntimeBridgeDiffMode;
  submitCount: number;
  operationCount: number;
  acceptedCount: number;
  changedCount: number;
  failedCount: number;
  totalSubmitMs: number;
  avgSubmitMs: number;
  p50SubmitMs: number;
  p95SubmitMs: number;
  throughputOpsPerSec: number;
  diffEventCount: number;
  avgDiffWireBytes: number;
  avgDiffEventBytes: number;
  avgDiffOperationCount: number;
  sourceSet: string[];
  operationIdSample: string[];
  avgResponseWireBytes: number;
};

type BenchmarkComparison = {
  throughputGainPct: number;
  submitLatencyGainPct: number;
  diffWireSizeDeltaPct: number;
};

type BenchmarkInsights = {
  strengths: string[];
  tradeoffs: string[];
  recommendation: string;
  summary: string;
};

type PendingRequest = {
  startedAt: number;
  timer: ReturnType<typeof setTimeout>;
  resolve(value: {
    message: DemoBridgeServerMessage;
    wireBytes: number;
    roundtripMs: number;
  }): void;
  reject(error: unknown): void;
};

type DiffEventCapture = {
  diffEventWireBytes: number[];
  diffEventBytes: number[];
  diffOperationCounts: number[];
  sources: Set<string>;
  operationIds: string[];
};

type DemoBridgeClientRequest =
  DemoBridgeClientMessage extends infer T
    ? T extends { requestId: string }
      ? Omit<T, "requestId">
      : never
    : never;

class BenchmarkClient {
  private socket: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private requestSeed = 1;
  private onBridgeEvent: ((event: RuntimeBridgeInboundEvent, wireBytes: number) => void) | null =
    null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", (error) => reject(error));
    });

    socket.on("message", (payload) => {
      this.handleMessage(payload);
    });
    socket.on("error", (error) => {
      this.rejectAll(error);
    });
    socket.on("close", () => {
      this.rejectAll(new Error("benchmark websocket closed"));
    });
  }

  setBridgeEventListener(
    listener: ((event: RuntimeBridgeInboundEvent, wireBytes: number) => void) | null
  ): void {
    this.onBridgeEvent = listener;
  }

  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (!socket) {
      return;
    }
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("benchmark websocket closed"));
    }
    this.pending.clear();
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  async request(
    message: DemoBridgeClientRequest
  ): Promise<{
    message: DemoBridgeServerMessage;
    wireBytes: number;
    roundtripMs: number;
  }> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("benchmark websocket not connected");
    }

    const requestId = `bench:${Date.now()}:${this.requestSeed}`;
    this.requestSeed += 1;
    const startedAt = performance.now();

    const response = new Promise<{
      message: DemoBridgeServerMessage;
      wireBytes: number;
      roundtripMs: number;
    }>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`request timeout: ${message.type}`));
      }, 8000);
      this.pending.set(requestId, {
        startedAt,
        timer,
        resolve,
        reject
      });
    });

    socket.send(serializeDemoBridgeMessage({ ...message, requestId }));
    return response;
  }

  private handleMessage(payload: RawData): void {
    const wireBytes = toRawBytes(payload);
    const parsed = parseDemoBridgeMessage(payload) as DemoBridgeServerMessage;

    if (parsed.type === "bridge.event") {
      this.onBridgeEvent?.(parsed.event, wireBytes);
      return;
    }

    if (parsed.type === "bridge.error") {
      if (parsed.requestId) {
        const pending = this.pending.get(parsed.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(parsed.requestId);
          pending.reject(new Error(parsed.message));
          return;
        }
      }
      return;
    }

    const requestId = readResponseRequestId(parsed);
    if (!requestId) {
      return;
    }
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(requestId);
    pending.resolve({
      message: parsed,
      wireBytes,
      roundtripMs: performance.now() - pending.startedAt
    });
  }

  private rejectAll(error: unknown): void {
    for (const [requestId, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(requestId);
    }
  }
}

async function run(): Promise<void> {
  const restoreConsole = muteConsoleLogs(process.env.BENCH_VERBOSE !== "1");
  const config = readConfig();
  let server:
    | Awaited<ReturnType<typeof startRuntimeBridgeNodeDemoServer>>
    | null = null;
  let client: BenchmarkClient | null = null;
  try {
    server = await startRuntimeBridgeNodeDemoServer({
      host: "127.0.0.1",
      port: 0
    });
    setRuntimeBridgeNodeDemoLoggingMuted(true);
    client = new BenchmarkClient(`ws://${server.host}:${server.port}`);
    await client.connect();
    await requestCommand(client, {
      type: "blueprint.load",
      entryId: config.blueprintEntryId
    });

    const diffMetrics = await benchmarkMode(client, config, "diff");
    const legacyMetrics = await benchmarkMode(client, config, "legacy");
    const comparison: BenchmarkComparison = {
      throughputGainPct: toPercentDelta(
        legacyMetrics.throughputOpsPerSec,
        diffMetrics.throughputOpsPerSec
      ),
      submitLatencyGainPct: toPercentDelta(
        legacyMetrics.avgSubmitMs,
        diffMetrics.avgSubmitMs
      ),
      diffWireSizeDeltaPct: toPercentDelta(
        legacyMetrics.avgDiffWireBytes,
        diffMetrics.avgDiffWireBytes
      )
    };

    const report = {
      config,
      diff: diffMetrics,
      legacy: legacyMetrics,
      comparison,
      insights: buildInsights(diffMetrics, legacyMetrics, comparison)
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await client?.close().catch(() => undefined);
    await server?.stop().catch(() => undefined);
    setRuntimeBridgeNodeDemoLoggingMuted(false);
    restoreConsole();
  }
}

async function benchmarkMode(
  client: BenchmarkClient,
  config: BenchmarkConfig,
  mode: RuntimeBridgeDiffMode
): Promise<ModeMetrics> {
  await requestCommand(client, {
    type: "diff.mode.set",
    mode
  });

  const capture: DiffEventCapture = {
    diffEventWireBytes: [],
    diffEventBytes: [],
    diffOperationCounts: [],
    sources: new Set<string>(),
    operationIds: []
  };
  client.setBridgeEventListener((event, wireBytes) => {
    if (event.type !== "document.diff") {
      return;
    }
    capture.diffEventWireBytes.push(wireBytes);
    capture.diffEventBytes.push(Buffer.byteLength(JSON.stringify(event), "utf8"));
    capture.diffOperationCounts.push(event.diff.operations.length);
    for (const operation of event.diff.operations) {
      capture.sources.add(operation.source || "unknown");
      if (capture.operationIds.length < 6) {
        capture.operationIds.push(operation.operationId);
      }
    }
  });

  let valueSeed = mode === "diff" ? 1000 : 5000;

  for (let index = 0; index < config.warmupBatches; index += 1) {
    valueSeed = await submitBatch(client, config, mode, valueSeed);
  }

  capture.diffEventWireBytes.length = 0;
  capture.diffEventBytes.length = 0;
  capture.diffOperationCounts.length = 0;
  capture.sources.clear();
  capture.operationIds.length = 0;

  const submitLatencies: number[] = [];
  const responseWireBytes: number[] = [];
  let acceptedCount = 0;
  let changedCount = 0;
  let failedCount = 0;

  for (let batchIndex = 0; batchIndex < config.batchCount; batchIndex += 1) {
    const operations = createBatchOperations(
      mode,
      config,
      valueSeed,
      batchIndex
    );
    valueSeed += operations.length;

    const startedAt = performance.now();
    const response = await client.request({
      type: "operations.submit",
      operations
    });
    const latencyMs = performance.now() - startedAt;
    submitLatencies.push(latencyMs);
    responseWireBytes.push(response.wireBytes);

    if (response.message.type !== "operations.response") {
      throw new Error(`unexpected response: ${response.message.type}`);
    }

    for (const result of response.message.results) {
      if (result.accepted) {
        acceptedCount += 1;
      } else {
        failedCount += 1;
      }
      if (result.changed) {
        changedCount += 1;
      }
    }
  }

  await sleep(40);
  client.setBridgeEventListener(null);

  const totalSubmitMs = sum(submitLatencies);
  const operationCount = config.batchCount * config.batchSize;
  return {
    mode,
    submitCount: config.batchCount,
    operationCount,
    acceptedCount,
    changedCount,
    failedCount,
    totalSubmitMs: roundNumber(totalSubmitMs),
    avgSubmitMs: roundNumber(average(submitLatencies)),
    p50SubmitMs: roundNumber(percentile(submitLatencies, 0.5)),
    p95SubmitMs: roundNumber(percentile(submitLatencies, 0.95)),
    throughputOpsPerSec: roundNumber(
      totalSubmitMs > 0 ? (changedCount / totalSubmitMs) * 1000 : 0
    ),
    diffEventCount: capture.diffEventWireBytes.length,
    avgDiffWireBytes: roundNumber(average(capture.diffEventWireBytes)),
    avgDiffEventBytes: roundNumber(average(capture.diffEventBytes)),
    avgDiffOperationCount: roundNumber(average(capture.diffOperationCounts)),
    sourceSet: [...capture.sources],
    operationIdSample: capture.operationIds.slice(0, 3),
    avgResponseWireBytes: roundNumber(average(responseWireBytes))
  };
}

async function submitBatch(
  client: BenchmarkClient,
  config: BenchmarkConfig,
  mode: RuntimeBridgeDiffMode,
  valueSeed: number
): Promise<number> {
  const operations = createBatchOperations(mode, config, valueSeed, -1);
  const response = await client.request({
    type: "operations.submit",
    operations
  });
  if (response.message.type !== "operations.response") {
    throw new Error(`unexpected response: ${response.message.type}`);
  }
  return valueSeed + operations.length;
}

function createBatchOperations(
  mode: RuntimeBridgeDiffMode,
  config: BenchmarkConfig,
  valueSeed: number,
  batchIndex: number
): GraphOperation[] {
  const operations: GraphOperation[] = [];
  for (let index = 0; index < config.batchSize; index += 1) {
    const value = valueSeed + index;
    operations.push({
      type: "node.widget.value.set",
      nodeId: config.nodeId,
      widgetIndex: config.widgetIndex,
      value,
      operationId: `bench:${mode}:${batchIndex}:${index}:${Date.now()}`,
      timestamp: Date.now(),
      source: `bench.${mode}`
    });
  }
  return operations;
}

async function requestCommand(
  client: BenchmarkClient,
  command: RuntimeBridgeCommand
): Promise<void> {
  const response = await client.request({
    type: "command.request",
    command
  });
  if (response.message.type !== "command.response") {
    throw new Error(`unexpected command response: ${response.message.type}`);
  }
}

function readConfig(): BenchmarkConfig {
  return {
    batchCount: readPositiveInt("BENCH_BATCH_COUNT", 120),
    batchSize: readPositiveInt("BENCH_BATCH_SIZE", 10),
    warmupBatches: readNonNegativeInt("BENCH_WARMUP_BATCHES", 10),
    blueprintEntryId:
      process.env.BENCH_BLUEPRINT_ENTRY_ID ?? "demo/blueprint/frequency-lab",
    nodeId: process.env.BENCH_NODE_ID ?? "frequency-timer",
    widgetIndex: readNonNegativeInt("BENCH_WIDGET_INDEX", 0)
  };
}

function readPositiveInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readNonNegativeInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readResponseRequestId(message: DemoBridgeServerMessage): string | null {
  switch (message.type) {
    case "snapshot.response":
    case "operations.response":
    case "command.response":
      return message.requestId;
    default:
      return null;
  }
}

function toRawBytes(payload: RawData): number {
  if (typeof payload === "string") {
    return Buffer.byteLength(payload, "utf8");
  }
  if (payload instanceof ArrayBuffer) {
    return payload.byteLength;
  }
  if (ArrayBuffer.isView(payload)) {
    return payload.byteLength;
  }
  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values: readonly number[], ratio: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio))
  );
  return sorted[index];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: readonly number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function roundNumber(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function toPercentDelta(base: number, next: number): number {
  if (!Number.isFinite(base) || base === 0) {
    return 0;
  }
  return roundNumber(((next - base) / base) * 100);
}

function buildInsights(
  diff: ModeMetrics,
  legacy: ModeMetrics,
  comparison: BenchmarkComparison
): BenchmarkInsights {
  const strengths: string[] = [];
  const tradeoffs: string[] = [];

  if (comparison.diffWireSizeDeltaPct < 0) {
    strengths.push(
      `Diff事件网络传输大小比传统模式小 ${Math.abs(comparison.diffWireSizeDeltaPct).toFixed(
        2
      )}%。`
    );
  } else if (comparison.diffWireSizeDeltaPct > 0) {
    tradeoffs.push(
      `Diff事件网络传输大小比传统模式大 ${comparison.diffWireSizeDeltaPct.toFixed(
        2
      )}%。`
    );
  } else {
    tradeoffs.push("Diff事件网络传输大小基本不变。");
  }

  if (comparison.throughputGainPct > 0) {
    strengths.push(
      `变更操作吞吐量比传统模式高 ${comparison.throughputGainPct.toFixed(
        2
      )}%。`
    );
  } else if (comparison.throughputGainPct < 0) {
    tradeoffs.push(
      `变更操作吞吐量比传统模式低 ${Math.abs(comparison.throughputGainPct).toFixed(
        2
      )}%。`
    );
  }

  if (comparison.submitLatencyGainPct < 0) {
    strengths.push(
      `平均提交延迟比传统模式低 ${Math.abs(comparison.submitLatencyGainPct).toFixed(
        2
      )}%。`
    );
  } else if (comparison.submitLatencyGainPct > 0) {
    tradeoffs.push(
      `平均提交延迟比传统模式高 ${comparison.submitLatencyGainPct.toFixed(
        2
      )}%。`
    );
  }

  const operationAggregationRatio =
    legacy.avgDiffOperationCount > 0
      ? roundNumber(diff.avgDiffOperationCount / legacy.avgDiffOperationCount)
      : 0;
  if (
    Number.isFinite(operationAggregationRatio) &&
    operationAggregationRatio > 0 &&
    operationAggregationRatio < 1
  ) {
    strengths.push(
      `Diff操作扇出减少到传统模式的 ${(operationAggregationRatio * 100).toFixed(
        2
      )}%（每事件）。`
    );
  } else if (operationAggregationRatio > 1) {
    tradeoffs.push(
      `Diff操作扇出为传统模式的 ${(operationAggregationRatio * 100).toFixed(
        2
      )}%（每事件，高于传统模式）。`
    );
  }

  const canonicalSource = "authority.documentDiff";
  if (diff.sourceSet.includes(canonicalSource)) {
    strengths.push(
      "Diff模式会为下游归因发出规范的源标签。"
    );
  } else {
    tradeoffs.push(
      "Diff模式未发出规范的源标签；请检查规范化路径。"
    );
  }

  if (!strengths.length) {
    strengths.push("本次运行未观察到明显优势。");
  }
  if (!tradeoffs.length) {
    tradeoffs.push("本次运行未观察到明显回归。");
  }

  const hasMajorPerfRegression =
    comparison.throughputGainPct <= -10 || comparison.submitLatencyGainPct >= 10;
  const hasClearWireAndStructureWins =
    comparison.diffWireSizeDeltaPct <= -10 && diff.sourceSet.includes(canonicalSource);

  let recommendation =
    "保留传统模式作为后备方案，并在部署前使用真实工作负载进行分析。";
  if (hasMajorPerfRegression) {
    recommendation =
      "Diff模式在负载/归因方面有明显优势，但当前运行显示性能回归；请保持开关开启并在默认部署前进行优化。";
  } else if (hasClearWireAndStructureWins) {
    recommendation =
      "如果此模式与您的工作负载匹配，建议在类生产环境同步中使用diff模式。";
  }

  return {
    strengths,
    tradeoffs,
    recommendation,
    summary: `吞吐量=${comparison.throughputGainPct.toFixed(
      2
    )}%, 延迟=${comparison.submitLatencyGainPct.toFixed(
      2
    )}%, 网络传输=${comparison.diffWireSizeDeltaPct.toFixed(2)}%`
  };
}

function muteConsoleLogs(shouldMute: boolean): () => void {
  if (!shouldMute) {
    return () => undefined;
  }

  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => undefined;
  console.error = () => undefined;
  return () => {
    console.log = originalLog;
    console.error = originalError;
  };
}

void run().catch((error) => {
  process.stderr.write("[bench:diff-modes] failed\n");
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
