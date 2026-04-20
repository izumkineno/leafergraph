import { describe, expect, test } from "bun:test";

import { DelayEventNode, QueueEventNode } from "../src/developer/nodes/event_timing";

const INTERNAL_EXECUTION_STATE_OVERRIDE_KEY =
  "__leafergraphExecutionStateOverride";

type MockContext = ReturnType<typeof createMockNodeContext>["ctx"];

function createMockNodeContext(input: {
  nodeId: string;
  nodeType: string;
  title: string;
  widgetValues?: Record<string, unknown>;
  props?: Record<string, unknown>;
}) {
  const widgets = new Map<string, unknown>(
    Object.entries(input.widgetValues ?? {})
  );
  const inputs = new Map<string, unknown>();
  const outputs: Array<{ slot: string; value: unknown }> = [];
  const ctx = {
    node: {
      id: input.nodeId,
      type: input.nodeType,
      title: input.title,
      data: {} as Record<string, unknown>
    },
    state: {} as Record<string, unknown>,
    props: { ...(input.props ?? {}) } as Record<string, unknown>,
    execution: undefined as unknown,
    getInput(name: string) {
      return inputs.get(name);
    },
    getWidget(name: string) {
      return widgets.get(name);
    },
    setWidget(name: string, value: unknown) {
      widgets.set(name, value);
    },
    setProp(name: string, value: unknown) {
      ctx.props[name] = value;
    },
    setOutput(slot: string, value: unknown) {
      outputs.push({ slot, value });
    }
  };

  return {
    ctx,
    inputs,
    outputs,
    widgets
  };
}

describe("DelayEventNode", () => {
  test("drops busy inputs without registering a new timer", () => {
    const node = new DelayEventNode();
    const runtimeRegistrations: Array<Record<string, unknown>> = [];
    const { ctx, outputs } = createMockNodeContext({
      nodeId: "delay-1",
      nodeType: "events/delay",
      title: "Delay",
      widgetValues: {
        time_in_ms: "1600"
      }
    });
    ctx.state = node.createState();

    const executionContext = {
      source: "graph-play",
      runId: "run-1",
      startedAt: 1,
      payload: {
        registerGraphTimer(registration: Record<string, unknown>) {
          runtimeRegistrations.push(registration);
        }
      }
    };

    node.onAction("event", "first", { executionContext }, ctx as never);
    expect(runtimeRegistrations).toHaveLength(1);
    expect((ctx.state as { active: { payload: unknown } | null }).active?.payload).toBe(
      "first"
    );

    node.onAction("event", "second", { executionContext }, ctx as never);
    expect(runtimeRegistrations).toHaveLength(1);
    expect((ctx.state as { droppedCount: number }).droppedCount).toBe(1);
    expect(
      (ctx.node.data as Record<string, unknown>)[INTERNAL_EXECUTION_STATE_OVERRIDE_KEY]
    ).toEqual({
      status: "running"
    });

    ctx.execution = {
      source: "graph-play",
      runId: "run-1",
      startedAt: 1,
      payload: {
        timerTickNodeId: "delay-1",
        timerTickTimerId: runtimeRegistrations[0]?.timerId
      }
    };
    node.onExecute(ctx as never);

    expect(outputs.at(-1)).toEqual({
      slot: "on_time",
      value: "first"
    });
    expect((ctx.state as { active: unknown }).active).toBeNull();
  });
});

describe("QueueEventNode", () => {
  test("releases in FIFO order and sends overflow to the dedicated output", () => {
    const node = new QueueEventNode();
    const { ctx, outputs } = createMockNodeContext({
      nodeId: "queue-1",
      nodeType: "events/queue",
      title: "Queue",
      widgetValues: {
        capacity: "2"
      }
    });
    ctx.state = node.createState();

    node.onAction("push", "A", undefined, ctx as never);
    node.onAction("push", "B", undefined, ctx as never);
    node.onAction("push", "C", undefined, ctx as never);
    node.onAction("push", "D", undefined, ctx as never);

    expect(outputs[0]).toEqual({
      slot: "next",
      value: "A"
    });
    expect(outputs.at(-1)).toEqual({
      slot: "overflow",
      value: "D"
    });
    expect((ctx.state as { queue: unknown[] }).queue).toHaveLength(2);
    expect((ctx.state as { droppedCount: number }).droppedCount).toBe(1);

    node.onAction("release", null, undefined, ctx as never);
    expect(outputs.at(-1)).toEqual({
      slot: "next",
      value: "B"
    });
    expect((ctx.state as { queue: unknown[] }).queue).toHaveLength(1);
    expect((ctx.state as { awaitingRelease: boolean }).awaitingRelease).toBe(true);
  });

  test("defers release through a runtime timer so the next item can re-enter downstream work", () => {
    const node = new QueueEventNode();
    const runtimeRegistrations: Array<Record<string, unknown>> = [];
    const { ctx, outputs } = createMockNodeContext({
      nodeId: "queue-2",
      nodeType: "events/queue",
      title: "Queue",
      widgetValues: {
        capacity: "3"
      }
    });
    ctx.state = node.createState();

    node.onAction("push", "A", undefined, ctx as never);
    node.onAction("push", "B", undefined, ctx as never);
    expect(outputs[0]).toEqual({
      slot: "next",
      value: "A"
    });

    const executionContext = {
      source: "graph-play",
      runId: "run-2",
      startedAt: 1,
      payload: {
        registerGraphTimer(registration: Record<string, unknown>) {
          runtimeRegistrations.push(registration);
        }
      }
    };

    node.onAction("release", null, { executionContext }, ctx as never);
    expect(runtimeRegistrations).toHaveLength(1);
    expect(outputs).toHaveLength(1);
    expect(
      (ctx.state as { releasing: { id: string } | null }).releasing?.id
    ).toBe(runtimeRegistrations[0]?.timerId);

    ctx.execution = {
      source: "graph-play",
      runId: "run-2",
      startedAt: 1,
      payload: {
        timerTickNodeId: "queue-2",
        timerTickTimerId: runtimeRegistrations[0]?.timerId
      }
    };
    node.onExecute(ctx as never);

    expect(outputs.at(-1)).toEqual({
      slot: "next",
      value: "B"
    });
    expect((ctx.state as { releasing: unknown }).releasing).toBeNull();
  });
});
