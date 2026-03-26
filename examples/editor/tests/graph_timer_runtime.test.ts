import { describe, expect, test } from "bun:test";

import type { LeaferGraphExecutionContext } from "../../../packages/leafergraph/src/api/graph_api_types";
import { LeaferGraphExecutionRuntimeHost } from "../../../packages/leafergraph/src/graph/graph_execution_runtime_host";
import {
  LEAFER_GRAPH_TIMER_NODE_TYPE,
  leaferGraphTimerNodeDefinition
} from "../../../packages/leafergraph/src/node/builtin/timer_node";
import type { LeaferGraphNodeExecutionTask } from "../../../packages/leafergraph/src/node/node_runtime_host";

function createTask(input: {
  nodeId: string;
  source: "graph-play" | "graph-step";
  runId?: string;
  startedAt?: number;
  payload?: unknown;
}): LeaferGraphNodeExecutionTask {
  const startedAt = input.startedAt ?? Date.now();
  return {
    nodeId: input.nodeId,
    trigger: "direct",
    depth: 0,
    activeNodeIds: new Set<string>(),
    chain: {
      chainId: `chain:${input.nodeId}:${startedAt}`,
      rootNodeId: input.nodeId,
      entryNodeId: input.nodeId,
      source: input.source,
      runId: input.runId,
      startedAt,
      payload: input.payload,
      nextSequence: 0
    }
  };
}

describe("graph timer runtime", () => {
  test("graph.play 命中 timer 后应保持 running 并持续推进", async () => {
    const host = new LeaferGraphExecutionRuntimeHost({
      nodeRuntimeHost: {
        listNodeIdsByType: () => ["on-play"],
        createEntryExecutionTask: (nodeId, options) =>
          createTask({
            nodeId,
            source: options.source,
            runId: options.runId,
            startedAt: options.startedAt,
            payload: options.payload
          }),
        executeExecutionTask: (task) => {
          if (task.nodeId === "on-play") {
            return {
              handled: true,
              nextTasks: [
                createTask({
                  nodeId: "timer",
                  source: task.chain.source as "graph-play" | "graph-step",
                  runId: task.chain.runId,
                  startedAt: task.chain.startedAt,
                  payload: task.chain.payload
                })
              ]
            };
          }

          if (task.nodeId === "timer") {
            const payload = task.chain.payload as {
              registerGraphTimer?: (input: {
                nodeId: string;
                source: "graph-play" | "graph-step";
                runId: string;
                startedAt: number;
                intervalMs: number;
                immediate: boolean;
              }) => void;
            };
            payload.registerGraphTimer?.({
              nodeId: "timer",
              source: task.chain.source as "graph-play" | "graph-step",
              runId: task.chain.runId ?? "run",
              startedAt: task.chain.startedAt,
              intervalMs: 10,
              immediate: false
            });
          }

          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });

    expect(host.play()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 60));

    const runningState = host.getGraphExecutionState();
    expect(runningState.status).toBe("running");
    expect(runningState.stepCount).toBeGreaterThan(2);
    expect(host.stop()).toBe(true);
    expect(host.getGraphExecutionState().status).toBe("idle");
  });

  test("graph.step 命中 timer 后应升级为 running", async () => {
    const host = new LeaferGraphExecutionRuntimeHost({
      nodeRuntimeHost: {
        listNodeIdsByType: () => ["on-play"],
        createEntryExecutionTask: (nodeId, options) =>
          createTask({
            nodeId,
            source: options.source,
            runId: options.runId,
            startedAt: options.startedAt,
            payload: options.payload
          }),
        executeExecutionTask: (task) => {
          if (task.nodeId === "on-play") {
            return {
              handled: true,
              nextTasks: [
                createTask({
                  nodeId: LEAFER_GRAPH_TIMER_NODE_TYPE,
                  source: task.chain.source as "graph-play" | "graph-step",
                  runId: task.chain.runId,
                  startedAt: task.chain.startedAt,
                  payload: task.chain.payload
                })
              ]
            };
          }

          if (task.nodeId === LEAFER_GRAPH_TIMER_NODE_TYPE) {
            const payload = task.chain.payload as {
              registerGraphTimer?: (input: {
                nodeId: string;
                source: "graph-play" | "graph-step";
                runId: string;
                startedAt: number;
                intervalMs: number;
                immediate: boolean;
              }) => void;
            };
            payload.registerGraphTimer?.({
              nodeId: LEAFER_GRAPH_TIMER_NODE_TYPE,
              source: task.chain.source as "graph-play" | "graph-step",
              runId: task.chain.runId ?? "run",
              startedAt: task.chain.startedAt,
              intervalMs: 10,
              immediate: true
            });
          }

          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });

    expect(host.step()).toBe(true);
    expect(host.getGraphExecutionState().status).toBe("stepping");
    expect(host.step()).toBe(true);
    expect(host.getGraphExecutionState().status).toBe("running");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(host.getGraphExecutionState().stepCount).toBeGreaterThanOrEqual(3);
    expect(host.stop()).toBe(true);
  });

  test("timer 节点在 node.play 下只执行一次", () => {
    const node = {
      id: "timer-1",
      type: LEAFER_GRAPH_TIMER_NODE_TYPE,
      title: "Timer",
      layout: {
        x: 0,
        y: 0,
        width: 240,
        height: 140
      },
      properties: {
        intervalMs: 1000,
        immediate: true,
        runCount: 0
      },
      propertySpecs: [],
      inputs: [{ name: "Start", type: "event" }],
      outputs: [{ name: "Tick", type: "event" }],
      widgets: [],
      flags: {},
      data: {},
      inputValues: [],
      outputValues: []
    };
    const outputs: unknown[] = [];
    const context: LeaferGraphExecutionContext = {
      source: "node-play",
      entryNodeId: node.id,
      startedAt: Date.now(),
      stepIndex: 0
    };

    leaferGraphTimerNodeDefinition.onExecute?.(node as never, context, {
      setOutputData(_slot, payload) {
        outputs.push(payload);
      }
    } as never);

    expect(outputs).toHaveLength(1);
    expect(node.properties.runCount).toBe(1);
    expect(node.properties.status).toBe("TICK 1");
  });

  test("timer immediate=false 首次 Start 不应立刻发 Tick，周期触发应发 Tick", () => {
    const node = {
      id: "timer-1",
      type: LEAFER_GRAPH_TIMER_NODE_TYPE,
      title: "Timer",
      layout: {
        x: 0,
        y: 0,
        width: 240,
        height: 140
      },
      properties: {
        intervalMs: 25,
        immediate: false,
        runCount: 0
      },
      propertySpecs: [],
      inputs: [{ name: "Start", type: "event" }],
      outputs: [{ name: "Tick", type: "event" }],
      widgets: [],
      flags: {},
      data: {},
      inputValues: [],
      outputValues: []
    };
    const firstOutputs: unknown[] = [];
    const registrations: unknown[] = [];

    leaferGraphTimerNodeDefinition.onExecute?.(
      node as never,
      {
        source: "graph-play",
        runId: "run-1",
        entryNodeId: "on-play",
        startedAt: Date.now(),
        stepIndex: 1,
        payload: {
          registerGraphTimer(input: unknown): void {
            registrations.push(input);
          }
        }
      } satisfies LeaferGraphExecutionContext,
      {
        setOutputData(_slot, payload) {
          firstOutputs.push(payload);
        }
      } as never
    );

    expect(firstOutputs).toHaveLength(0);
    expect(registrations).toHaveLength(1);
    expect(node.properties.status).toBe("WAIT 25ms");

    const periodicOutputs: unknown[] = [];
    leaferGraphTimerNodeDefinition.onExecute?.(
      node as never,
      {
        source: "graph-play",
        runId: "run-1",
        entryNodeId: "timer-1",
        startedAt: Date.now(),
        stepIndex: 2,
        payload: {
          registerGraphTimer(): void {},
          timerTickNodeId: "timer-1"
        }
      } satisfies LeaferGraphExecutionContext,
      {
        setOutputData(_slot, payload) {
          periodicOutputs.push(payload);
        }
      } as never
    );

    expect(periodicOutputs).toHaveLength(1);
    expect(node.properties.runCount).toBe(1);
  });

  test("timer 应优先使用 widget 配置 interval/immediate", () => {
    const node = {
      id: "timer-1",
      type: LEAFER_GRAPH_TIMER_NODE_TYPE,
      title: "Timer",
      layout: {
        x: 0,
        y: 0,
        width: 240,
        height: 140
      },
      properties: {
        intervalMs: 1000,
        immediate: true,
        runCount: 0
      },
      propertySpecs: [],
      inputs: [{ name: "Start", type: "event" }],
      outputs: [{ name: "Tick", type: "event" }],
      widgets: [
        {
          type: "input",
          name: "intervalMs",
          value: "2500",
          options: { label: "Interval (ms)" }
        },
        {
          type: "toggle",
          name: "immediate",
          value: false,
          options: { label: "Immediate" }
        }
      ],
      flags: {},
      data: {},
      inputValues: [],
      outputValues: []
    };
    const outputs: unknown[] = [];
    const registrations: unknown[] = [];

    leaferGraphTimerNodeDefinition.onExecute?.(
      node as never,
      {
        source: "graph-play",
        runId: "run-1",
        entryNodeId: "on-play",
        startedAt: Date.now(),
        stepIndex: 1,
        payload: {
          registerGraphTimer(input: unknown): void {
            registrations.push(input);
          }
        }
      } satisfies LeaferGraphExecutionContext,
      {
        setOutputData(_slot, payload) {
          outputs.push(payload);
        }
      } as never
    );

    expect(outputs).toHaveLength(0);
    expect(registrations).toHaveLength(1);
    expect(node.properties.intervalMs).toBe(2500);
    expect(node.properties.immediate).toBe(false);
    expect(node.properties.status).toBe("WAIT 2500ms");
    expect(node.widgets[0]?.value).toBe(2500);
    expect(node.widgets[1]?.value).toBe(false);
  });
});
