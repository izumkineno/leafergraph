import { describe, expect, test } from "bun:test";

import {
  createExampleAnimationFrameScheduler,
  resolveExampleMemoryControlOptions,
  type ExampleMemoryControlWindow
} from "../src/graph/lifecycle_diagnostics";

function createFakeAnimationFrameWindow(): Pick<
  Window,
  "requestAnimationFrame" | "cancelAnimationFrame"
> & {
  callbacks: Map<number, () => void>;
  canceledIds: number[];
  runFrame(frameId: number): void;
} {
  let nextFrameId = 1;
  const callbacks = new Map<number, () => void>();
  const canceledIds: number[] = [];

  return {
    callbacks,
    canceledIds,
    requestAnimationFrame(callback) {
      const frameId = nextFrameId;
      nextFrameId += 1;
      callbacks.set(frameId, () => callback(0));
      return frameId;
    },
    cancelAnimationFrame(frameId) {
      canceledIds.push(frameId);
      callbacks.delete(frameId);
    },
    runFrame(frameId) {
      const callback = callbacks.get(frameId);
      callbacks.delete(frameId);
      callback?.();
    }
  };
}

describe("mini-graph lifecycle diagnostics", () => {
  test("cancellable animation frame scheduler tracks and cancels pending fitView frames", () => {
    const ownerWindow = createFakeAnimationFrameWindow();
    const scheduler = createExampleAnimationFrameScheduler(ownerWindow);
    let callCount = 0;

    const firstFrameId = scheduler.schedule(() => {
      callCount += 1;
    });
    const secondFrameId = scheduler.schedule(() => {
      callCount += 1;
    });

    expect(scheduler.getSnapshot()).toEqual({
      pendingFitViewFrameCount: 2,
      fitViewScheduleCount: 2,
      fitViewCancelCount: 0
    });

    scheduler.cancel(firstFrameId ?? -1);
    ownerWindow.runFrame(secondFrameId ?? -1);

    expect(callCount).toBe(1);
    expect(ownerWindow.canceledIds).toEqual([firstFrameId]);
    expect(scheduler.getSnapshot()).toEqual({
      pendingFitViewFrameCount: 0,
      fitViewScheduleCount: 2,
      fitViewCancelCount: 1
    });
  });

  test("cancelAll is idempotent and prevents stale frame callbacks", () => {
    const ownerWindow = createFakeAnimationFrameWindow();
    const scheduler = createExampleAnimationFrameScheduler(ownerWindow);
    let callCount = 0;

    const frameId = scheduler.schedule(() => {
      callCount += 1;
    });

    scheduler.cancelAll();
    scheduler.cancelAll();
    ownerWindow.runFrame(frameId ?? -1);

    expect(callCount).toBe(0);
    expect(ownerWindow.canceledIds).toEqual([frameId]);
    expect(scheduler.getSnapshot()).toEqual({
      pendingFitViewFrameCount: 0,
      fitViewScheduleCount: 1,
      fitViewCancelCount: 1
    });
  });

  test("memory control flags normalize absent and enabled no-projection controls", () => {
    expect(resolveExampleMemoryControlOptions(undefined)).toEqual({
      disableRuntimeFeedbackProjection: false,
      disableDebugTestSurface: false
    });

    const ownerWindow = {
      __MINI_GRAPH_MEMORY_CONTROL__: {
        disableRuntimeFeedbackProjection: true,
        disableDebugTestSurface: true
      }
    } as Window & ExampleMemoryControlWindow;

    expect(resolveExampleMemoryControlOptions(ownerWindow)).toEqual({
      disableRuntimeFeedbackProjection: true,
      disableDebugTestSurface: true
    });
  });

  test("memory control flags can be persisted through localStorage for reload controls", () => {
    const ownerWindow = {
      localStorage: {
        getItem(key: string) {
          return key === "__MINI_GRAPH_MEMORY_CONTROL__"
            ? JSON.stringify({
                disableRuntimeFeedbackProjection: true,
                disableDebugTestSurface: true
              })
            : null;
        }
      }
    } as Window & ExampleMemoryControlWindow;

    expect(resolveExampleMemoryControlOptions(ownerWindow)).toEqual({
      disableRuntimeFeedbackProjection: true,
      disableDebugTestSurface: true
    });
  });
});
