import type { NodeDefinition } from "@leafergraph/node";
import type { LeaferGraphExecutionContext } from "../../api/graph_api_types";

/** 图级运行的内建定时器节点类型。 */
export const LEAFER_GRAPH_TIMER_NODE_TYPE = "system/timer";

/** `system/timer` 的默认间隔（毫秒）。 */
export const LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS = 1000;
const LEAFER_GRAPH_TIMER_INTERVAL_WIDGET_NAME = "intervalMs";
const LEAFER_GRAPH_TIMER_IMMEDIATE_WIDGET_NAME = "immediate";

interface LeaferGraphTimerRegistration {
  nodeId: string;
  runId: string;
  source: "graph-play" | "graph-step";
  startedAt: number;
  intervalMs: number;
  immediate: boolean;
}

/** 图级执行宿主注入给 `system/timer` 的最小运行时 payload。 */
export interface LeaferGraphTimerRuntimePayload {
  registerGraphTimer?: (input: LeaferGraphTimerRegistration) => void;
  timerTickNodeId?: string;
}

function resolveNormalizedIntervalMs(value: unknown): number {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS;
  }

  return Math.max(1, Math.floor(nextValue));
}

function resolveImmediate(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return true;
}

function isTimerRuntimePayload(value: unknown): value is LeaferGraphTimerRuntimePayload {
  return typeof value === "object" && value !== null;
}

function isGraphExecutionSource(
  value: unknown
): value is LeaferGraphTimerRegistration["source"] {
  return value === "graph-play" || value === "graph-step";
}

function resolveTimerWidgetValue(
  node: {
    widgets?: Array<{
      name?: string;
      value?: unknown;
    }>;
  },
  widgetName: string
): unknown {
  for (const widget of node.widgets ?? []) {
    if (widget.name === widgetName) {
      return widget.value;
    }
  }

  return undefined;
}

function syncTimerWidgetValue(
  node: {
    widgets?: Array<{
      name?: string;
      value?: unknown;
    }>;
  },
  widgetName: string,
  value: unknown
): void {
  for (const widget of node.widgets ?? []) {
    if (widget.name === widgetName) {
      widget.value = value;
      return;
    }
  }
}

function resolveTimerConfig(node: {
  properties: {
    intervalMs?: unknown;
    immediate?: unknown;
  };
  widgets?: Array<{
    name?: string;
    value?: unknown;
  }>;
}): {
  intervalMs: number;
  immediate: boolean;
} {
  const intervalFromWidget = resolveTimerWidgetValue(
    node,
    LEAFER_GRAPH_TIMER_INTERVAL_WIDGET_NAME
  );
  const immediateFromWidget = resolveTimerWidgetValue(
    node,
    LEAFER_GRAPH_TIMER_IMMEDIATE_WIDGET_NAME
  );

  return {
    intervalMs: resolveNormalizedIntervalMs(
      intervalFromWidget ?? node.properties.intervalMs
    ),
    immediate: resolveImmediate(immediateFromWidget ?? node.properties.immediate)
  };
}

/**
 * 内建 `Timer` 节点定义。
 *
 * @remarks
 * - 需要上游 `Start` 才会建立图级循环。
 * - `node.play` 下仅执行一次，不建立循环。
 * - `immediate=false` 时，首次 `Start` 只布置定时器，不立即输出 Tick。
 */
export const leaferGraphTimerNodeDefinition: NodeDefinition = {
  type: LEAFER_GRAPH_TIMER_NODE_TYPE,
  title: "Timer",
  category: "System",
  description: "图级定时触发节点（Start -> Tick）",
  properties: [
    {
      name: "intervalMs",
      type: "number",
      default: LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS
    },
    {
      name: "immediate",
      type: "boolean",
      default: true
    },
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
  widgets: [
    {
      type: "input",
      name: LEAFER_GRAPH_TIMER_INTERVAL_WIDGET_NAME,
      value: LEAFER_GRAPH_TIMER_DEFAULT_INTERVAL_MS,
      options: {
        label: "Interval (ms)",
        placeholder: "1000"
      }
    },
    {
      type: "toggle",
      name: LEAFER_GRAPH_TIMER_IMMEDIATE_WIDGET_NAME,
      value: true,
      options: {
        label: "Immediate",
        onText: "ON",
        offText: "WAIT"
      }
    }
  ],
  inputs: [
    {
      name: "Start",
      type: "event"
    }
  ],
  outputs: [
    {
      name: "Tick",
      type: "event",
      label: "Tick"
    }
  ],
  onExecute(node, context, api) {
    const executionContext = context as LeaferGraphExecutionContext | undefined;
    const source = executionContext?.source;
    const runId = executionContext?.runId;
    const startedAt = executionContext?.startedAt ?? Date.now();
    const { intervalMs, immediate } = resolveTimerConfig(node);
    const runtimePayload = isTimerRuntimePayload(executionContext?.payload)
      ? executionContext.payload
      : undefined;
    const isGraphSource = isGraphExecutionSource(source);
    const isPeriodicTick = runtimePayload?.timerTickNodeId === node.id;

    if (isGraphSource && runId && runtimePayload?.registerGraphTimer) {
      runtimePayload.registerGraphTimer({
        nodeId: node.id,
        runId,
        source,
        startedAt,
        intervalMs,
        immediate
      });
    }

    const shouldEmitTick =
      source === "node-play" ||
      isPeriodicTick ||
      immediate ||
      !isGraphSource ||
      !runId ||
      !runtimePayload?.registerGraphTimer;

    if (!shouldEmitTick) {
      node.properties.intervalMs = intervalMs;
      node.properties.immediate = immediate;
      node.properties.status = `WAIT ${intervalMs}ms`;
      syncTimerWidgetValue(
        node,
        LEAFER_GRAPH_TIMER_INTERVAL_WIDGET_NAME,
        intervalMs
      );
      syncTimerWidgetValue(
        node,
        LEAFER_GRAPH_TIMER_IMMEDIATE_WIDGET_NAME,
        immediate
      );
      node.title = "Timer";
      return;
    }

    const previousTick = Number(node.properties.runCount ?? 0);
    const nextTick = Number.isFinite(previousTick) ? previousTick + 1 : 1;
    const timestamp = Date.now();

    node.properties.intervalMs = intervalMs;
    node.properties.immediate = immediate;
    node.properties.runCount = nextTick;
    node.properties.status = `TICK ${nextTick}`;
    syncTimerWidgetValue(node, LEAFER_GRAPH_TIMER_INTERVAL_WIDGET_NAME, intervalMs);
    syncTimerWidgetValue(node, LEAFER_GRAPH_TIMER_IMMEDIATE_WIDGET_NAME, immediate);
    node.title = `Timer ${nextTick}`;
    api?.setOutputData(0, {
      timerNodeId: node.id,
      tick: nextTick,
      intervalMs,
      timestamp,
      source: source ?? "node-play",
      runId
    });
  }
};
