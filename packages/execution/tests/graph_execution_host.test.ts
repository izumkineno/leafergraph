import { afterEach, describe, expect, it } from "bun:test";

import {
  LEAFER_GRAPH_ON_PLAY_NODE_TYPE,
  LeaferGraphGraphExecutionHost,
  type LeaferGraphCreateEntryExecutionTaskOptions,
  type LeaferGraphNodeExecutionTask,
  type LeaferGraphNodeExecutionTaskResult
} from "../src";
import { ManualTimerScheduler } from "./test_helpers";

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

afterEach(() => {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
});

function createExecutionTask(
  nodeId: string,
  options: LeaferGraphCreateEntryExecutionTaskOptions
): LeaferGraphNodeExecutionTask {
  return {
    nodeId,
    trigger: "direct",
    depth: 0,
    activeNodeIds: new Set<string>(),
    chain: {
      chainId: `chain:${nodeId}`,
      rootNodeId: nodeId,
      entryNodeId: nodeId,
      source: options.source,
      runId: options.runId,
      startedAt: options.startedAt ?? 0,
      payload: options.payload,
      nextSequence: 0
    }
  };
}

describe("@leafergraph/execution LeaferGraphGraphExecutionHost", () => {
  it("没有 on-play 入口节点时 play 会返回 false", () => {
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType() {
          return [];
        },
        createEntryExecutionTask() {
          return undefined;
        },
        executeExecutionTask() {
          return {
            handled: false,
            nextTasks: []
          };
        }
      }
    });

    expect(host.play()).toBe(false);
    expect(host.getGraphExecutionState()).toEqual({
      status: "idle",
      queueSize: 0,
      stepCount: 0
    });
  });

  it("step 会逐步推进队列，并在最后一次 step 后回到 idle", () => {
    const executionCalls: string[] = [];
    const events: string[] = [];
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["entry-1"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task, stepIndex): LeaferGraphNodeExecutionTaskResult {
          executionCalls.push(`${task.nodeId}:${stepIndex}`);
          if (task.nodeId === "entry-1") {
            return {
              handled: true,
              nextTasks: [
                {
                  ...createExecutionTask("next-1", {
                    source: task.chain.source,
                    runId: task.chain.runId,
                    startedAt: task.chain.startedAt,
                    payload: task.chain.payload
                  }),
                  trigger: "propagated",
                  depth: 1,
                  chain: task.chain
                }
              ]
            };
          }

          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });
    host.subscribeGraphExecution((event) => events.push(event.type));

    expect(host.step()).toBe(true);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "stepping",
      queueSize: 1,
      stepCount: 1,
      lastSource: "graph-step"
    });

    expect(host.step()).toBe(true);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "idle",
      queueSize: 0,
      stepCount: 2,
      lastSource: "graph-step"
    });
    expect(executionCalls).toEqual(["entry-1:0", "next-1:1"]);
    expect(events).toEqual(["started", "advanced", "advanced", "drained"]);
  });

  it("stop 会中断一个仍在运行中的定时执行", () => {
    const timers = new ManualTimerScheduler();
    globalThis.setTimeout = timers.setTimeout;
    globalThis.clearTimeout = timers.clearTimeout;

    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["timer-1"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task) {
          const payload = task.chain.payload as {
            registerGraphTimer?(input: {
              nodeId: string;
              runId: string;
              source: "graph-play" | "graph-step";
              startedAt: number;
              intervalMs: number;
              immediate: boolean;
              mode?: "interval" | "timeout";
            }): void;
          };
          payload.registerGraphTimer?.({
            nodeId: task.nodeId,
            runId: task.chain.runId!,
            source: task.chain.source,
            startedAt: task.chain.startedAt,
            intervalMs: 5,
            immediate: false,
            mode: "timeout"
          });
          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });

    expect(host.play()).toBe(true);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "running",
      queueSize: 0,
      stepCount: 1,
      lastSource: "graph-play"
    });

    expect(host.stop()).toBe(true);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "idle",
      queueSize: 0,
      stepCount: 1,
      lastSource: "graph-play"
    });
  });

  it("timeout timer 触发后会重新入队，并在无后续任务时自动结束运行", () => {
    const timers = new ManualTimerScheduler();
    globalThis.setTimeout = timers.setTimeout;
    globalThis.clearTimeout = timers.clearTimeout;

    let executionCount = 0;
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["timer-2"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task) {
          executionCount += 1;

          if (executionCount === 1) {
            const payload = task.chain.payload as {
              registerGraphTimer?(input: {
                nodeId: string;
                runId: string;
                source: "graph-play" | "graph-step";
                startedAt: number;
                intervalMs: number;
                immediate: boolean;
                mode?: "interval" | "timeout";
              }): void;
            };
            payload.registerGraphTimer?.({
              nodeId: task.nodeId,
              runId: task.chain.runId!,
              source: task.chain.source,
              startedAt: task.chain.startedAt,
              intervalMs: 5,
              immediate: false,
              mode: "timeout"
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
    expect(host.getGraphExecutionState().status).toBe("running");

    timers.tick(5);

    expect(executionCount).toBe(2);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "idle",
      queueSize: 0,
      stepCount: 2,
      lastSource: "graph-play"
    });
  });

  it("resetState 会清空正在 step 中的 run 并回到 idle", () => {
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["entry-reset"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task) {
          if (task.nodeId === "entry-reset") {
            return {
              handled: true,
              nextTasks: [
                {
                  ...createExecutionTask("next-reset", {
                    source: task.chain.source,
                    runId: task.chain.runId,
                    startedAt: task.chain.startedAt,
                    payload: task.chain.payload
                  }),
                  chain: task.chain
                }
              ]
            };
          }

          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });

    host.step();
    expect(host.getGraphExecutionState().status).toBe("stepping");

    host.resetState();

    expect(host.getGraphExecutionState()).toMatchObject({
      status: "idle",
      queueSize: 0,
      stepCount: 1,
      lastSource: "graph-step"
    });
  });
});
