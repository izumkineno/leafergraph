import { afterEach, describe, expect, it } from "bun:test";

import {
  LEAFER_GRAPH_ON_PLAY_NODE_TYPE,
  LeaferGraphGraphExecutionHost,
  type LeaferGraphCreateEntryExecutionTaskOptions,
  type LeaferGraphNodeExecutionState,
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

describe("@leafergraph/core/execution LeaferGraphGraphExecutionHost", () => {
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

  it("stepping 状态下切回 play 不应在 drain 后访问空 activeRun", () => {
    const executionCalls: string[] = [];
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["entry-play-resume"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task, stepIndex): LeaferGraphNodeExecutionTaskResult {
          executionCalls.push(`${task.nodeId}:${stepIndex}`);
          if (task.nodeId === "entry-play-resume") {
            return {
              handled: true,
              nextTasks: [
                {
                  ...createExecutionTask("next-play-resume", {
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

    expect(host.step()).toBe(true);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "stepping",
      queueSize: 1,
      stepCount: 1,
      lastSource: "graph-step"
    });

    expect(() => host.play()).not.toThrow();
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "idle",
      queueSize: 0,
      stepCount: 2,
      lastSource: "graph-step"
    });
    expect(executionCalls).toEqual([
      "entry-play-resume:0",
      "next-play-resume:1"
    ]);
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

  it("interval timer 在定时回调中重复注册相同配置时，不应把执行耗时叠加到下一次触发", () => {
    const timers = new ManualTimerScheduler();
    globalThis.setTimeout = timers.setTimeout;
    globalThis.clearTimeout = timers.clearTimeout;

    let executionCount = 0;
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["timer-interval"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task) {
          executionCount += 1;
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

          if (executionCount >= 2) {
            timers.elapse(3);
          }

          payload.registerGraphTimer?.({
            nodeId: task.nodeId,
            runId: task.chain.runId!,
            source: task.chain.source,
            startedAt: task.chain.startedAt,
            intervalMs: 5,
            immediate: false,
            mode: "interval"
          });

          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });

    expect(host.play()).toBe(true);
    expect(executionCount).toBe(1);

    timers.tick(5);
    expect(executionCount).toBe(2);

    timers.tick(2);
    expect(executionCount).toBe(3);
  });

  it("trackProgress timeout 会投影 waiting progress，并在 stop 时恢复 idle", async () => {
    const timers = new ManualTimerScheduler();
    globalThis.setTimeout = timers.setTimeout;
    globalThis.clearTimeout = timers.clearTimeout;

    let projectedState: LeaferGraphNodeExecutionState | undefined;
    const projectedEvents: Array<{
      status?: string;
      progress?: number;
    }> = [];
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["delay-progress"] : [];
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
              trackProgress?: boolean;
            }): void;
          };
          payload.registerGraphTimer?.({
            nodeId: task.nodeId,
            runId: task.chain.runId!,
            source: task.chain.source,
            startedAt: task.chain.startedAt,
            intervalMs: 600,
            immediate: false,
            mode: "timeout",
            trackProgress: true
          });
          return {
            handled: true,
            nextTasks: []
          };
        },
        getNodeExecutionState() {
          return projectedState;
        },
        getNodeSnapshot(nodeId) {
          return {
            id: nodeId,
            type: "authoring-basic/event-delay",
            title: "Delay 600ms"
          };
        },
        projectExternalNodeExecution(event) {
          projectedState = event.state;
          projectedEvents.push({
            status: event.state.status,
            progress: event.state.progress
          });
        }
      }
    });

    expect(host.play()).toBe(true);
    await Promise.resolve();

    expect(projectedEvents[0]).toMatchObject({
      status: "running",
      progress: 0
    });

    timers.tick(100);
    expect(projectedEvents.at(-1)).toMatchObject({
      status: "running"
    });
    expect(projectedEvents.at(-1)?.progress).toBeGreaterThan(0);
    expect(projectedEvents.at(-1)?.progress).toBeLessThan(1);

    expect(host.stop()).toBe(true);
    expect(projectedEvents.at(-1)).toMatchObject({
      status: "idle"
    });
    expect(projectedEvents.at(-1)?.progress).toBeUndefined();
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

  it("play 遇到 async 节点时，会在 Promise 完成后继续推进下游任务", async () => {
    const executionCalls: string[] = [];
    const events: string[] = [];
    const host = new LeaferGraphGraphExecutionHost({
      nodeExecutionHost: {
        listNodeIdsByType(type) {
          return type === LEAFER_GRAPH_ON_PLAY_NODE_TYPE ? ["entry-async"] : [];
        },
        createEntryExecutionTask(nodeId, options) {
          return createExecutionTask(nodeId, options);
        },
        executeExecutionTask(task, stepIndex) {
          executionCalls.push(`${task.nodeId}:${stepIndex}`);

          if (task.nodeId === "entry-async") {
            return Promise.resolve({
              handled: true,
              nextTasks: [
                {
                  ...createExecutionTask("next-async", {
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
            });
          }

          return {
            handled: true,
            nextTasks: []
          };
        }
      }
    });
    host.subscribeGraphExecution((event) => events.push(event.type));

    expect(host.play()).toBe(true);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "running",
      stepCount: 1,
      lastSource: "graph-play"
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(executionCalls).toEqual(["entry-async:0", "next-async:1"]);
    expect(host.getGraphExecutionState()).toMatchObject({
      status: "idle",
      queueSize: 0,
      stepCount: 2,
      lastSource: "graph-play"
    });
    expect(events).toEqual(["started", "advanced", "advanced", "drained"]);
  });
});
