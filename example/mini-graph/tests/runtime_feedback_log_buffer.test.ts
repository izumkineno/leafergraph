import { describe, expect, test } from "bun:test";

import {
  createRuntimeFeedbackLogBuffer,
  type RuntimeFeedbackLogBuffer,
  type RuntimeFeedbackLogBufferScheduler
} from "../src/graph/runtime_feedback_log_buffer";

interface TestLogEntry {
  id: number;
  message: string;
}

interface ScheduledTask {
  token: number;
  callback: () => void;
  delayMs: number;
  canceled: boolean;
}

function createFakeScheduler(): {
  scheduler: RuntimeFeedbackLogBufferScheduler<number>;
  tasks: ScheduledTask[];
  cancelCalls: number[];
} {
  let nextToken = 1;
  const tasks: ScheduledTask[] = [];
  const cancelCalls: number[] = [];

  return {
    scheduler: {
      schedule(callback, delayMs) {
        const task = {
          token: nextToken,
          callback,
          delayMs,
          canceled: false
        };
        nextToken += 1;
        tasks.push(task);
        return task.token;
      },
      cancel(token) {
        cancelCalls.push(token);
        const task = tasks.find((candidate) => candidate.token === token);
        if (task) {
          task.canceled = true;
        }
      }
    },
    tasks,
    cancelCalls
  };
}

function createBufferedLogHarness(maxEntries = 60): {
  entries: () => readonly TestLogEntry[];
  applyCallCount: () => number;
  nextId: () => number;
  schedulerHarness: ReturnType<typeof createFakeScheduler>;
  buffer: RuntimeFeedbackLogBuffer;
} {
  let entries: TestLogEntry[] = [];
  let applyCallCount = 0;
  let nextId = 1;
  const schedulerHarness = createFakeScheduler();
  const buffer = createRuntimeFeedbackLogBuffer<TestLogEntry, number>({
    maxEntries,
    flushDelayMs: 120,
    scheduler: schedulerHarness.scheduler,
    createEntry(message) {
      const entry = { id: nextId, message };
      nextId += 1;
      return entry;
    },
    applyEntries(createNextEntries) {
      applyCallCount += 1;
      entries = createNextEntries(entries);
    }
  });

  return {
    entries: () => entries,
    applyCallCount: () => applyCallCount,
    nextId: () => nextId,
    schedulerHarness,
    buffer
  };
}

describe("mini-graph runtime feedback log buffer", () => {
  test("batches many messages into one scheduled flush", () => {
    const harness = createBufferedLogHarness();

    for (let index = 0; index < 100; index += 1) {
      harness.buffer.enqueue(`message-${index}`);
    }

    expect(harness.applyCallCount()).toBe(0);
    expect(harness.schedulerHarness.tasks).toHaveLength(1);
    expect(harness.schedulerHarness.tasks[0]?.delayMs).toBe(120);
    expect(harness.buffer.getSnapshot()).toEqual({
      pendingCount: 60,
      scheduled: true,
      flushCount: 0,
      disposed: false
    });

    harness.schedulerHarness.tasks[0]?.callback();

    expect(harness.applyCallCount()).toBe(1);
    expect(harness.entries()).toHaveLength(60);
    expect(harness.buffer.getSnapshot()).toEqual({
      pendingCount: 0,
      scheduled: false,
      flushCount: 1,
      disposed: false
    });
  });

  test("retains newest entries up to the configured cap in newest-first order", () => {
    const harness = createBufferedLogHarness(5);

    for (let index = 1; index <= 10; index += 1) {
      harness.buffer.enqueue(`message-${index}`);
    }

    harness.schedulerHarness.tasks[0]?.callback();

    expect(harness.entries().map((entry) => entry.message)).toEqual([
      "message-10",
      "message-9",
      "message-8",
      "message-7",
      "message-6"
    ]);
    expect(harness.entries()).toHaveLength(5);
    expect(harness.nextId()).toBe(6);
  });

  test("clear cancels a pending flush and prevents stale callbacks from applying", () => {
    const harness = createBufferedLogHarness();

    harness.buffer.enqueue("message-before-clear");
    const staleCallback = harness.schedulerHarness.tasks[0]?.callback;
    const scheduledToken = harness.schedulerHarness.tasks[0]?.token;

    harness.buffer.clear();

    expect(harness.schedulerHarness.cancelCalls).toEqual([scheduledToken]);
    expect(harness.buffer.getSnapshot()).toEqual({
      pendingCount: 0,
      scheduled: false,
      flushCount: 0,
      disposed: false
    });

    staleCallback?.();

    expect(harness.applyCallCount()).toBe(0);
    expect(harness.entries()).toEqual([]);
  });

  test("dispose is idempotent and prevents future writes", () => {
    const harness = createBufferedLogHarness();

    harness.buffer.enqueue("message-before-dispose");
    const staleCallback = harness.schedulerHarness.tasks[0]?.callback;

    harness.buffer.dispose();
    harness.buffer.dispose();
    staleCallback?.();
    harness.buffer.enqueue("message-after-dispose");
    harness.buffer.flushNow();

    expect(harness.applyCallCount()).toBe(0);
    expect(harness.entries()).toEqual([]);
    expect(harness.buffer.getSnapshot()).toEqual({
      pendingCount: 0,
      scheduled: false,
      flushCount: 0,
      disposed: true
    });
  });
});
