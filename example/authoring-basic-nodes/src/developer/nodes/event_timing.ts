import { BaseNode } from "@leafergraph/authoring";

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

let delayTicketSequence = 0;

interface DelayTicket {
  id: string;
  payload: unknown;
  delayMs: number;
  runId?: string;
}

function createDelayTicketId(nodeId: string): string {
  delayTicketSequence += 1;
  return `${nodeId}:delay:${delayTicketSequence}`;
}

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

function resolveTimerEventName(
  ctx: Parameters<TimerEventNode["onExecute"]>[0]
): string {
  const eventName = readWidgetString(ctx, "event", "tick").trim() || "tick";
  ctx.setProp("event", eventName);
  return eventName;
}

function formatDelayStatus(pending: readonly DelayTicket[], delayMs: number): string {
  if (!pending.length) {
    return `READY\n${delayMs} ms\nQueue empty`;
  }

  return `QUEUED\n${delayMs} ms\n${pending.length} waiting`;
}

export class DelayEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventDelay,
    title: "Delay",
    category: "Events/Timing",
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

  createState() {
    return {
      deliveredCount: 0,
      pending: [] as DelayTicket[]
    };
  }

  onExecute(ctx) {
    const delayMs = resolveDelayMs(ctx);
    const execution = getExecutionContext(ctx);
    if (isTimerTickExecution(execution, ctx.node.id)) {
      const ticketId = getTimerTickId(execution);
      if (ticketId) {
        const ticketIndex = ctx.state.pending.findIndex((ticket) => ticket.id === ticketId);
        if (ticketIndex >= 0) {
          const [ticket] = ctx.state.pending.splice(ticketIndex, 1);
          ctx.state.deliveredCount += 1;
          ctx.setOutput("on_time", ticket.payload);
          updateStatus(
            ctx,
            `FIRED\n${ticket.delayMs} ms\n${ctx.state.pending.length} waiting`
          );
          setNodeTitle(ctx.node, `Delay ${delayMs}ms`);
          return;
        }
      }
    }

    setNodeTitle(ctx.node, `Delay ${delayMs}ms`);
    updateStatus(ctx, formatDelayStatus(ctx.state.pending, delayMs));
  }

  onAction(action, param, options, ctx) {
    if (action !== "event") {
      return;
    }

    const delayMs = resolveDelayMs(ctx);
    if (delayMs <= 0) {
      ctx.state.deliveredCount += 1;
      ctx.setOutput("on_time", param);
      updateStatus(ctx, "FIRED\n0 ms\nImmediate");
      return;
    }

    const execution = getExecutionContext(ctx, options);
    const runtimePayload = getTimerRuntimePayload(execution);
    if (
      !isGraphExecution(execution) ||
      !execution.runId ||
      !runtimePayload?.registerGraphTimer
    ) {
      updateStatus(ctx, `ARM\n${delayMs} ms\nUse graph Play / Step`);
      return;
    }

    ctx.state.pending = ctx.state.pending.filter(
      (ticket) => ticket.runId === undefined || ticket.runId === execution.runId
    );
    const ticketId = createDelayTicketId(ctx.node.id);
    ctx.state.pending.push({
      id: ticketId,
      payload: param,
      delayMs,
      runId: execution.runId
    });
    runtimePayload.registerGraphTimer({
      nodeId: ctx.node.id,
      runId: execution.runId,
      source: execution.source,
      startedAt: execution.startedAt,
      intervalMs: delayMs,
      immediate: false,
      timerId: ticketId,
      mode: "timeout"
    });
    updateStatus(ctx, formatDelayStatus(ctx.state.pending, delayMs));
  }
}

export class TimerEventNode extends BaseNode {
  static meta = {
    type: AUTHORING_BASIC_NODE_TYPES.eventTimer,
    title: "Timer",
    category: "Events/Timing",
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

  createState() {
    return {
      activeRunId: "",
      running: false,
      tickCount: 0
    };
  }

  onExecute(ctx) {
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

  onAction(action, _param, options, ctx) {
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
  TimerEventNode
] as const;
