import type { LeaferGraphNodePlugin } from "@leafergraph/contracts";
import type { NodeDefinition } from "@leafergraph/node";

export const EXAMPLE_EVENT_RELAY_NODE_TYPE = "example/event-relay";
export const EXAMPLE_TICK_MONITOR_NODE_TYPE = "example/tick-monitor";

type ExampleEventPayload = {
  source?: unknown;
  tick?: unknown;
  intervalMs?: unknown;
  timestamp?: unknown;
};

const eventRelayNodeDefinition: NodeDefinition = {
  type: EXAMPLE_EVENT_RELAY_NODE_TYPE,
  title: "Event Relay",
  category: "Example",
  description: "把输入事件原样转发，方便拉出持续可见的连线动画。",
  inputs: [
    {
      name: "In",
      type: "event",
      label: "In",
      shape: "box"
    }
  ],
  outputs: [
    {
      name: "Out",
      type: "event",
      label: "Out",
      shape: "box"
    }
  ],
  properties: [
    {
      name: "runCount",
      type: "number",
      default: 0
    },
    {
      name: "status",
      type: "string",
      default: "READY"
    }
  ],
  onExecute(node, _context, api) {
    const payload = readEventPayload(node.inputValues[0]);
    const nextRunCount = resolveNextRunCount(node.properties.runCount);

    node.properties.runCount = nextRunCount;
    node.properties.status = resolveEventStatus("RELAY", nextRunCount, payload);
    node.title = `Event Relay ${nextRunCount}`;

    api?.setOutputData(0, payload ?? createFallbackEventPayload(nextRunCount));
  }
};

const tickMonitorNodeDefinition: NodeDefinition = {
  type: EXAMPLE_TICK_MONITOR_NODE_TYPE,
  title: "Tick Monitor",
  category: "Example",
  description: "接收 Tick 事件并累积次数，方便观察持续传播反馈。",
  inputs: [
    {
      name: "Tick",
      type: "event",
      label: "Tick",
      shape: "box"
    }
  ],
  properties: [
    {
      name: "runCount",
      type: "number",
      default: 0
    },
    {
      name: "status",
      type: "string",
      default: "READY"
    }
  ],
  onExecute(node) {
    const payload = readEventPayload(node.inputValues[0]);
    const nextRunCount = resolveNextRunCount(node.properties.runCount);

    node.properties.runCount = nextRunCount;
    node.properties.status = resolveEventStatus("MONITOR", nextRunCount, payload);
    node.title = `Tick Monitor ${nextRunCount}`;
  }
};

export const miniGraphExampleDemoPlugin: LeaferGraphNodePlugin = {
  name: "mini-graph/example-demo",
  install(context) {
    context.registerNode(eventRelayNodeDefinition, { overwrite: true });
    context.registerNode(tickMonitorNodeDefinition, { overwrite: true });
  }
};

/**
 * 解析下一步运行`Count`。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
function resolveNextRunCount(value: unknown): number {
  const currentValue = Number(value);
  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return 1;
  }

  return Math.floor(currentValue) + 1;
}

/**
 * 读取事件载荷。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
function readEventPayload(value: unknown): ExampleEventPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as ExampleEventPayload;
}

/**
 * 创建回退事件载荷。
 *
 * @param runCount - 运行`Count`。
 * @returns 创建后的结果对象。
 */
function createFallbackEventPayload(runCount: number): ExampleEventPayload {
  return {
    source: EXAMPLE_EVENT_RELAY_NODE_TYPE,
    tick: runCount,
    timestamp: Date.now()
  };
}

/**
 * 解析事件状态。
 *
 * @param label - 标签。
 * @param runCount - 运行`Count`。
 * @param payload - 当前载荷。
 * @returns 处理后的结果。
 */
function resolveEventStatus(
  label: "RELAY" | "MONITOR",
  runCount: number,
  payload: ExampleEventPayload | null
): string {
  const tickLabel = formatFiniteNumber(payload?.tick);
  const intervalLabel = formatFiniteNumber(payload?.intervalMs);
  const sourceLabel =
    typeof payload?.source === "string" && payload.source.trim()
      ? payload.source.trim()
      : "unknown";

  const parts = [`${label} ${runCount}`];

  if (tickLabel) {
    parts.push(`tick=${tickLabel}`);
  }

  if (intervalLabel) {
    parts.push(`interval=${intervalLabel}ms`);
  }

  parts.push(`source=${sourceLabel}`);

  return parts.join(" · ");
}

/**
 * 格式化有限`Number`。
 *
 * @param value - 当前值。
 * @returns 处理后的结果。
 */
function formatFiniteNumber(value: unknown): string | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  return String(Math.floor(numericValue));
}
