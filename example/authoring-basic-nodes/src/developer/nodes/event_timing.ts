import { BaseNode } from "@leafergraph/extensions/authoring";

import {
  getExecutionContext,
  getTimerRuntimePayload,
  getTimerTickId,
  isGraphExecution,
  isTimerTickExecution,
  readWidgetBoolean,
  readWidgetNumber,
  readWidgetString,
  updateStatus
} from "../helpers";
import {
  AUTHORING_BASIC_NODE_TYPES,
  createStatusWidgetSpec
} from "../shared";
import { setNodeTitle } from "./shared";

const EVENT_TIMER_MAIN_ID = "loop";
const QUEUE_DEFAULT_CAPACITY = 16;
const INTERNAL_EXECUTION_STATE_OVERRIDE_KEY =
  "__leafergraphExecutionStateOverride";

let delayTicketSequence = 0;
let queueEntrySequence = 0;

interface DelayTicket {
  id: string;
  payload: unknown;
  delayMs: number;
  runId?: string;
}

interface QueueEntry {
  id: string;
  payload: unknown;
}

interface QueueDispatchTicket {
  id: string;
  entry: QueueEntry;
  runId?: string;
}

/**
 * 创建延迟票据 ID。
 *
 * @param nodeId - 目标节点 ID。
 * @returns 创建后的结果对象。
 */
function createDelayTicketId(nodeId: string): string {
  delayTicketSequence += 1;
  return `${nodeId}:delay:${delayTicketSequence}`;
}

/**
 * 创建队列条目 ID。
 *
 * @param nodeId - 目标节点 ID。
 * @returns 创建后的结果对象。
 */
function createQueueEntryId(nodeId: string): string {
  queueEntrySequence += 1;
  return `${nodeId}:queue:${queueEntrySequence}`;
}

/**
 * 创建 Queue 放行票据 ID。
 *
 * @param entryId - 队列条目 ID。
 * @returns 创建后的结果对象。
 */
function createQueueDispatchTicketId(entryId: string): string {
  return `${entryId}:release`;
}

/**
 * 解析延迟`Ms`。
 *
 * @param ctx - `ctx`。
 * @returns 处理后的结果。
 */
function resolveDelayMs(
  ctx: Parameters<DelayEventNode["onExecute"]>[0]
): number {
  const inputValue = ctx.getInput("time_in_ms");
  if (typeof inputValue === "number" && Number.isFinite(inputValue)) {
    const nextValue = Math.max(0, Math.floor(inputValue));
    ctx.setProp("time_in_ms", nextValue);
    return nextValue;
  }

  const widgetValue = Math.max(0, Math.floor(readWidgetNumber(ctx, "time_in_ms", 1000)));
  ctx.setProp("time_in_ms", widgetValue);
  return widgetValue;
}

/**
 * 解析定时器间隔`Ms`。
 *
 * @param ctx - `ctx`。
 * @returns 处理后的结果。
 */
function resolveTimerIntervalMs(
  ctx: Parameters<TimerEventNode["onExecute"]>[0]
): number {
  const inputValue = ctx.getInput("interval");
  if (typeof inputValue === "number" && Number.isFinite(inputValue)) {
    const nextValue = Math.max(1, Math.floor(inputValue));
    ctx.setProp("interval", nextValue);
    return nextValue;
  }

  const widgetValue = Math.max(1, Math.floor(readWidgetNumber(ctx, "interval", 1000)));
  ctx.setProp("interval", widgetValue);
  return widgetValue;
}

/**
 * 解析定时器事件`Name`。
 *
 * @param ctx - `ctx`。
 * @returns 处理后的结果。
 */
function resolveTimerEventName(
  ctx: Parameters<TimerEventNode["onExecute"]>[0]
): string {
  const eventName = readWidgetString(ctx, "event", "tick").trim() || "tick";
  ctx.setProp("event", eventName);
  return eventName;
}

/**
 * 格式化单飞 Delay 状态。
 *
 * @param options - 当前状态快照。
 * @returns 处理后的结果。
 */
function formatSingleDelayStatus(options: {
  delayMs: number;
  active: DelayTicket | null;
  droppedCount: number;
  mode?: "ready" | "running" | "fired" | "dropped" | "armed";
}): string {
  const mode = options.mode ?? (options.active ? "running" : "ready");
  const droppedLine = `Dropped ${options.droppedCount}`;
  switch (mode) {
    case "armed":
      return `ARM\n${options.delayMs} ms\nUse graph Play / Step`;
    case "fired":
      return `FIRED\n${options.delayMs} ms\n${droppedLine}`;
    case "dropped":
      return `DROPPED\n${options.delayMs} ms\n${droppedLine}`;
    case "running":
      return `RUNNING\n${options.active?.delayMs ?? options.delayMs} ms\n${droppedLine}`;
    default:
      return `READY\n${options.delayMs} ms\n${droppedLine}`;
  }
}

/**
 * 解析 Queue 容量。
 *
 * @param ctx - `ctx`。
 * @returns 处理后的结果。
 */
function resolveQueueCapacity(
  ctx: Parameters<QueueEventNode["onExecute"]>[0]
): number {
  const inputValue = ctx.getInput("capacity");
  if (typeof inputValue === "number" && Number.isFinite(inputValue)) {
    const nextValue = Math.max(1, Math.floor(inputValue));
    ctx.setProp("capacity", nextValue);
    return nextValue;
  }

  const widgetValue = Math.max(
    1,
    Math.floor(readWidgetNumber(ctx, "capacity", QUEUE_DEFAULT_CAPACITY))
  );
  ctx.setProp("capacity", widgetValue);
  return widgetValue;
}

/**
 * 格式化 Queue 状态。
 *
 * @param options - 当前状态快照。
 * @returns 处理后的结果。
 */
function formatQueueStatus(options: {
  capacity: number;
  queuedCount: number;
  awaitingRelease: boolean;
  droppedCount: number;
  mode?: "ready" | "active" | "queued" | "overflow";
}): string {
  const mode =
    options.mode ??
    (options.awaitingRelease
      ? options.queuedCount > 0
        ? "queued"
        : "active"
      : "ready");
  const queueLine = `${options.queuedCount}/${options.capacity} queued`;
  switch (mode) {
    case "active":
      return `ACTIVE\n${queueLine}\nDropped ${options.droppedCount}`;
    case "queued":
      return `QUEUED\n${queueLine}\nDropped ${options.droppedCount}`;
    case "overflow":
      return `OVERFLOW\n${queueLine}\nDropped ${options.droppedCount}`;
    default:
      return `READY\n${queueLine}\nDropped ${options.droppedCount}`;
  }
}

/**
 * 对齐 Delay 节点在新 run 下的内部状态。
 *
 * @param ctx - `ctx`。
 * @param runId - 当前 runId。
 * @returns 是否发生了 reset。
 */
function syncDelayRunState(
  ctx: Parameters<DelayEventNode["onAction"]>[3],
  runId: string | undefined
): boolean {
  if (!runId) {
    return false;
  }

  const activeRunId = ctx.state.active?.runId;
  if (!activeRunId || activeRunId === runId) {
    return false;
  }

  ctx.state.active = null;
  return true;
}

/**
 * 对齐 Queue 节点在新 run 下的内部状态。
 *
 * @param ctx - `ctx`。
 * @param runId - 当前 runId。
 * @returns 是否发生了 reset。
 */
function syncQueueRunState(
  ctx: Parameters<QueueEventNode["onAction"]>[3],
  runId: string | undefined
): boolean {
  if (!runId) {
    return false;
  }

  if (!ctx.state.activeRunId || ctx.state.activeRunId === runId) {
    ctx.state.activeRunId = runId;
    return false;
  }

  ctx.state.activeRunId = runId;
  ctx.state.awaitingRelease = false;
  ctx.state.queue = [];
  ctx.state.releasing = null;
  return true;
}

/**
 * 请求本轮执行结束后继续保持 running 状态。
 *
 * @param ctx - `ctx`。
 * @returns 无返回值。
 */
function preserveRunningExecutionState(
  ctx: Parameters<DelayEventNode["onAction"]>[3]
): void {
  if (!ctx.node.data || typeof ctx.node.data !== "object") {
    ctx.node.data = {};
  }

  (ctx.node.data as Record<string, unknown>)[INTERNAL_EXECUTION_STATE_OVERRIDE_KEY] = {
    status: "running"
  };
}

/**
 * 封装 DelayEventNode 的节点行为。
 */
export class DelayEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventDelay,
    title: "Delay",
    category: "Events/Timing",
    shell: {
      longTask: true
    },
    inputs: [
      { name: "event", type: "event" },
      { name: "time_in_ms", type: "number", optional: true }
    ],
    outputs: [{ name: "on_time", type: "event" }],
    properties: [{ name: "time_in_ms", type: "number", default: 1000 }],
    widgets: [
      {
        type: "input",
        name: "time_in_ms",
        value: "1000",
        options: {
          label: "Delay",
          placeholder: "1000"
        }
      },
      createStatusWidgetSpec({
        label: "Delay",
        description: "Schedules one-shot event release through graph timers"
      })
    ]
  };

  /**
   * 创建状态。
   *
   * @returns 创建后的结果对象。
   */
  createState() {
    return {
      deliveredCount: 0,
      droppedCount: 0,
      active: null as DelayTicket | null
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const delayMs = resolveDelayMs(ctx);
    const execution = getExecutionContext(ctx);
    if (isTimerTickExecution(execution, ctx.node.id)) {
      const ticketId = getTimerTickId(execution);
      if (ticketId && ctx.state.active?.id === ticketId) {
        const ticket = ctx.state.active;
        ctx.state.active = null;
        ctx.state.deliveredCount += 1;
        ctx.setOutput("on_time", ticket.payload);
        updateStatus(
          ctx,
          formatSingleDelayStatus({
            delayMs: ticket.delayMs,
            active: null,
            droppedCount: ctx.state.droppedCount,
            mode: "fired"
          })
        );
        setNodeTitle(ctx.node, `Delay ${delayMs}ms`);
        return;
      }
    }

    setNodeTitle(ctx.node, `Delay ${delayMs}ms`);
    updateStatus(
      ctx,
      formatSingleDelayStatus({
        delayMs,
        active: ctx.state.active,
        droppedCount: ctx.state.droppedCount
      })
    );
  }

  /**
   * 处理 `onAction` 相关逻辑。
   *
   * @param action - 动作。
   * @param param - 解构后的输入参数。
   * @param options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onAction(action, param, options, ctx) {
    if (action !== "event") {
      return;
    }

    const delayMs = resolveDelayMs(ctx);
    const execution = getExecutionContext(ctx, options);
    syncDelayRunState(ctx, execution?.runId);
    setNodeTitle(ctx.node, `Delay ${delayMs}ms`);

    if (ctx.state.active) {
      preserveRunningExecutionState(ctx);
      ctx.state.droppedCount += 1;
      updateStatus(
        ctx,
        formatSingleDelayStatus({
          delayMs,
          active: ctx.state.active,
          droppedCount: ctx.state.droppedCount,
          mode: "dropped"
        })
      );
      return;
    }

    if (delayMs <= 0) {
      ctx.state.deliveredCount += 1;
      ctx.setOutput("on_time", param);
      updateStatus(
        ctx,
        formatSingleDelayStatus({
          delayMs: 0,
          active: null,
          droppedCount: ctx.state.droppedCount,
          mode: "fired"
        })
      );
      return;
    }

    const runtimePayload = getTimerRuntimePayload(execution);
    if (
      !isGraphExecution(execution) ||
      !execution.runId ||
      !runtimePayload?.registerGraphTimer
    ) {
      updateStatus(
        ctx,
        formatSingleDelayStatus({
          delayMs,
          active: null,
          droppedCount: ctx.state.droppedCount,
          mode: "armed"
        })
      );
      return;
    }

    const ticketId = createDelayTicketId(ctx.node.id);
    ctx.state.active = {
      id: ticketId,
      payload: param,
      delayMs,
      runId: execution.runId
    };
    runtimePayload.registerGraphTimer({
      nodeId: ctx.node.id,
      runId: execution.runId,
      source: execution.source,
      startedAt: execution.startedAt,
      intervalMs: delayMs,
      immediate: false,
      timerId: ticketId,
      mode: "timeout",
      trackProgress: true
    });
    updateStatus(
      ctx,
      formatSingleDelayStatus({
        delayMs,
        active: ctx.state.active,
        droppedCount: ctx.state.droppedCount,
        mode: "running"
      })
    );
  }
}

/**
 * 封装 QueueEventNode 的节点行为。
 */
export class QueueEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventQueue,
    title: "Queue",
    category: "Events/Flow",
    inputs: [
      { name: "push", type: "event", optional: true },
      { name: "release", type: "event", optional: true },
      { name: "capacity", type: "number", optional: true }
    ],
    outputs: [
      { name: "next", type: "event" },
      { name: "overflow", type: "event" }
    ],
    properties: [{ name: "capacity", type: "number", default: QUEUE_DEFAULT_CAPACITY }],
    widgets: [
      {
        type: "input",
        name: "capacity",
        value: String(QUEUE_DEFAULT_CAPACITY),
        options: {
          label: "Capacity",
          placeholder: String(QUEUE_DEFAULT_CAPACITY)
        }
      },
      createStatusWidgetSpec({
        label: "Queue",
        description: "FIFO event gate that releases the next item after an explicit ack"
      })
    ]
  };

  /**
   * 创建状态。
   *
   * @returns 创建后的结果对象。
   */
  createState() {
    return {
      activeRunId: "",
      awaitingRelease: false,
      queue: [] as QueueEntry[],
      releasing: null as QueueDispatchTicket | null,
      droppedCount: 0,
      releasedCount: 0
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    const capacity = resolveQueueCapacity(ctx);
    const execution = getExecutionContext(ctx);
    if (isTimerTickExecution(execution, ctx.node.id)) {
      const ticketId = getTimerTickId(execution);
      if (ticketId && ctx.state.releasing?.id === ticketId) {
        const dispatchTicket = ctx.state.releasing;
        ctx.state.releasing = null;
        ctx.state.awaitingRelease = true;
        ctx.state.releasedCount += 1;
        ctx.setOutput("next", dispatchTicket.entry.payload);
        setNodeTitle(ctx.node, `Queue ${ctx.state.queue.length}/${capacity}`);
        updateStatus(
          ctx,
          formatQueueStatus({
            capacity,
            queuedCount: ctx.state.queue.length,
            awaitingRelease: true,
            droppedCount: ctx.state.droppedCount,
            mode: ctx.state.queue.length ? "queued" : "active"
          })
        );
        return;
      }
    }

    setNodeTitle(ctx.node, `Queue ${ctx.state.queue.length}/${capacity}`);
    updateStatus(
      ctx,
      formatQueueStatus({
        capacity,
        queuedCount: ctx.state.queue.length,
        awaitingRelease: ctx.state.awaitingRelease,
        droppedCount: ctx.state.droppedCount
      })
    );
  }

  /**
   * 处理 `onAction` 相关逻辑。
   *
   * @param action - 动作。
   * @param param - 参数。
   * @param options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onAction(action, param, options, ctx) {
    if (action !== "push" && action !== "release") {
      return;
    }

    const capacity = resolveQueueCapacity(ctx);
    const execution = getExecutionContext(ctx, options);
    syncQueueRunState(ctx, execution?.runId);
    setNodeTitle(ctx.node, `Queue ${ctx.state.queue.length}/${capacity}`);

    if (action === "release") {
      if (ctx.state.releasing) {
        updateStatus(
          ctx,
          formatQueueStatus({
            capacity,
            queuedCount: ctx.state.queue.length,
            awaitingRelease: true,
            droppedCount: ctx.state.droppedCount,
            mode: ctx.state.queue.length ? "queued" : "active"
          })
        );
        return;
      }

      if (!ctx.state.queue.length) {
        ctx.state.awaitingRelease = false;
        ctx.state.releasing = null;
        updateStatus(
          ctx,
          formatQueueStatus({
            capacity,
            queuedCount: 0,
            awaitingRelease: false,
            droppedCount: ctx.state.droppedCount,
            mode: "ready"
          })
        );
        return;
      }

      const nextEntry = ctx.state.queue.shift();
      if (!nextEntry) {
        ctx.state.awaitingRelease = false;
        updateStatus(
          ctx,
          formatQueueStatus({
            capacity,
            queuedCount: 0,
            awaitingRelease: false,
            droppedCount: ctx.state.droppedCount,
            mode: "ready"
          })
        );
        return;
      }

      ctx.state.awaitingRelease = true;
      const runtimePayload = getTimerRuntimePayload(execution);
      if (
        isGraphExecution(execution) &&
        execution.runId &&
        runtimePayload?.registerGraphTimer
      ) {
        const ticketId = createQueueDispatchTicketId(nextEntry.id);
        ctx.state.releasing = {
          id: ticketId,
          entry: nextEntry,
          runId: execution.runId
        };
        runtimePayload.registerGraphTimer({
          nodeId: ctx.node.id,
          runId: execution.runId,
          source: execution.source,
          startedAt: execution.startedAt,
          intervalMs: 0,
          immediate: false,
          timerId: ticketId,
          mode: "timeout"
        });
        updateStatus(
          ctx,
          formatQueueStatus({
            capacity,
            queuedCount: ctx.state.queue.length,
            awaitingRelease: true,
            droppedCount: ctx.state.droppedCount,
            mode: ctx.state.queue.length ? "queued" : "active"
          })
        );
        setNodeTitle(ctx.node, `Queue ${ctx.state.queue.length}/${capacity}`);
        return;
      }

      ctx.state.releasedCount += 1;
      ctx.setOutput("next", nextEntry.payload);
      updateStatus(
        ctx,
        formatQueueStatus({
          capacity,
          queuedCount: ctx.state.queue.length,
          awaitingRelease: true,
          droppedCount: ctx.state.droppedCount,
          mode: ctx.state.queue.length ? "queued" : "active"
        })
      );
      setNodeTitle(ctx.node, `Queue ${ctx.state.queue.length}/${capacity}`);
      return;
    }

    if (!ctx.state.awaitingRelease && ctx.state.queue.length === 0) {
      ctx.state.awaitingRelease = true;
      ctx.state.releasedCount += 1;
      ctx.setOutput("next", param);
      updateStatus(
        ctx,
        formatQueueStatus({
          capacity,
          queuedCount: 0,
          awaitingRelease: true,
          droppedCount: ctx.state.droppedCount,
          mode: "active"
        })
      );
      return;
    }

    if (ctx.state.queue.length >= capacity) {
      ctx.state.droppedCount += 1;
      ctx.setOutput("overflow", param);
      updateStatus(
        ctx,
        formatQueueStatus({
          capacity,
          queuedCount: ctx.state.queue.length,
          awaitingRelease: ctx.state.awaitingRelease,
          droppedCount: ctx.state.droppedCount,
          mode: "overflow"
        })
      );
      return;
    }

    ctx.state.queue.push({
      id: createQueueEntryId(ctx.node.id),
      payload: param
    });
    setNodeTitle(ctx.node, `Queue ${ctx.state.queue.length}/${capacity}`);
    updateStatus(
      ctx,
      formatQueueStatus({
        capacity,
        queuedCount: ctx.state.queue.length,
        awaitingRelease: ctx.state.awaitingRelease,
        droppedCount: ctx.state.droppedCount,
        mode: "queued"
      })
    );
  }
}

/**
 * 封装 TimerEventNode 的节点行为。
 */
export class TimerEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventTimer,
    title: "Timer",
    category: "Events/Timing",
    shell: {
      longTask: true
    },
    inputs: [
      { name: "start", type: "event", optional: true },
      { name: "interval", type: "number", optional: true }
    ],
    outputs: [
      { name: "on_tick", type: "event" },
      { name: "tick", type: "boolean" }
    ],
    properties: [
      { name: "interval", type: "number", default: 1000 },
      { name: "event", type: "string", default: "tick" },
      { name: "immediate", type: "boolean", default: true }
    ],
    widgets: [
      {
        type: "input",
        name: "interval",
        value: "1000",
        options: {
          label: "Interval",
          placeholder: "1000"
        }
      },
      {
        type: "input",
        name: "event",
        value: "tick",
        options: {
          label: "Event"
        }
      },
      {
        type: "toggle",
        name: "immediate",
        value: true,
        options: {
          label: "Immediate",
          onText: "ON",
          offText: "WAIT"
        }
      },
      {
        type: "button",
        name: "preview_tick",
        value: null,
        options: {
          label: "Preview",
          text: "Fire Once"
        }
      },
      createStatusWidgetSpec({
        label: "Timer",
        description: "Recurring graph timer that survives step chains and stops cleanly"
      })
    ]
  };

  /**
   * 创建状态。
   *
   * @returns 创建后的结果对象。
   */
  createState() {
    return {
      activeRunId: "",
      running: false,
      tickCount: 0
    };
  }

  /**
   * 处理 `onExecute` 相关逻辑。
   *
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onExecute(ctx) {
    // 先整理当前阶段需要的输入、状态与依赖。
    const intervalMs = resolveTimerIntervalMs(ctx);
    const eventName = resolveTimerEventName(ctx);
    const immediate = readWidgetBoolean(ctx, "immediate", true);
    ctx.setProp("immediate", immediate);
    setNodeTitle(ctx.node, `Timer: ${intervalMs}ms`);

    const execution = getExecutionContext(ctx);
    if (isTimerTickExecution(execution, ctx.node.id, EVENT_TIMER_MAIN_ID)) {
      ctx.state.activeRunId = execution?.runId ?? "";
      ctx.state.running = true;
      ctx.state.tickCount += 1;

      const runtimePayload = getTimerRuntimePayload(execution);
      if (
        isGraphExecution(execution) &&
        execution.runId &&
        runtimePayload?.registerGraphTimer
      ) {
        // 再执行核心逻辑，并把结果或副作用统一收口。
        runtimePayload.registerGraphTimer({
          nodeId: ctx.node.id,
          runId: execution.runId,
          source: execution.source,
          startedAt: execution.startedAt,
          intervalMs,
          immediate: false,
          timerId: EVENT_TIMER_MAIN_ID,
          mode: "interval"
        });
      }

      ctx.setOutput("on_tick", eventName);
      ctx.setOutput("tick", true);
      updateStatus(ctx, `TICK\n${eventName}\n#${ctx.state.tickCount}`);
      return;
    }

    if (execution?.source === "node-play") {
      ctx.state.tickCount += 1;
      ctx.setOutput("on_tick", eventName);
      ctx.setOutput("tick", true);
      updateStatus(ctx, `PREVIEW\n${eventName}\nDirect run`);
      return;
    }

    ctx.setOutput("tick", false);
    updateStatus(
      ctx,
      ctx.state.running
        ? `ARMED\n${eventName}\n${intervalMs} ms`
        : `READY\n${eventName}\n${intervalMs} ms`
    );
  }

  /**
   * 处理 `onAction` 相关逻辑。
   *
   * @param action - 动作。
   * @param _param - 参数。
   * @param options - 可选配置项。
   * @param ctx - `ctx`。
   * @returns 无返回值。
   */
  onAction(action, _param, options, ctx) {
    // 先整理当前阶段需要的输入、状态与依赖。
    const intervalMs = resolveTimerIntervalMs(ctx);
    const eventName = resolveTimerEventName(ctx);
    const immediate = readWidgetBoolean(ctx, "immediate", true);
    ctx.setProp("immediate", immediate);
    setNodeTitle(ctx.node, `Timer: ${intervalMs}ms`);

    if (action === "preview_tick") {
      ctx.state.tickCount += 1;
      ctx.setOutput("on_tick", eventName);
      ctx.setOutput("tick", true);
      updateStatus(ctx, `PREVIEW\n${eventName}\nWidget fired`);
      return;
    }

    if (action !== "start") {
      return;
    }

    const execution = getExecutionContext(ctx, options);
    const runtimePayload = getTimerRuntimePayload(execution);
    // 再执行核心逻辑，并把结果或副作用统一收口。
    if (
      isGraphExecution(execution) &&
      execution.runId &&
      runtimePayload?.registerGraphTimer
    ) {
      runtimePayload.registerGraphTimer({
        nodeId: ctx.node.id,
        runId: execution.runId,
        source: execution.source,
        startedAt: execution.startedAt,
        intervalMs,
        immediate: false,
        timerId: EVENT_TIMER_MAIN_ID,
        mode: "interval"
      });
      ctx.state.activeRunId = execution.runId;
      ctx.state.running = true;
      if (immediate) {
        ctx.state.tickCount += 1;
        ctx.setOutput("on_tick", eventName);
        ctx.setOutput("tick", true);
        updateStatus(ctx, `TICK\n${eventName}\n#${ctx.state.tickCount}`);
        return;
      }

      ctx.setOutput("tick", false);
      updateStatus(ctx, `ARMED\n${eventName}\n${intervalMs} ms`);
      return;
    }

    ctx.state.running = false;
    updateStatus(ctx, `READY\n${eventName}\nUse graph Play / Step`);
  }
}

export const authoringBasicEventTimingNodeClasses = [
  DelayEventNode,
  QueueEventNode,
  TimerEventNode
] as const;
