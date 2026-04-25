/**
 * mini-graph 生命周期诊断与可取消调度辅助工具。
 *
 * 这些工具只服务于 demo 层：暴露内存泄漏验证所需的最小状态，
 * 不引入生产依赖，也不改变核心运行时 API。
 */

export interface ExampleMemoryControlOptions {
  disableRuntimeFeedbackProjection?: boolean;
  disableDebugTestSurface?: boolean;
}

export interface ExampleLifecycleDiagnosticsSnapshot {
  pendingFitViewFrameCount: number;
  fitViewScheduleCount: number;
  fitViewCancelCount: number;
}

export interface ExampleAnimationFrameScheduler {
  schedule(callback: () => void): number | null;
  cancel(frameId: number): void;
  cancelAll(): void;
  getSnapshot(): ExampleLifecycleDiagnosticsSnapshot;
}

export interface ExampleMemoryControlWindow {
  __MINI_GRAPH_MEMORY_CONTROL__?: ExampleMemoryControlOptions;
  localStorage?: Pick<Storage, "getItem">;
}

/**
 * 从浏览器窗口解析可选的“关闭日志 / 关闭投影”控制开关。
 *
 * @param ownerWindow - demo 使用的类 Window 宿主。
 * @returns 归一化后的控制开关。
 */
export function resolveExampleMemoryControlOptions(
  ownerWindow: (Window & ExampleMemoryControlWindow) | undefined
): Required<ExampleMemoryControlOptions> {
  const control =
    ownerWindow?.__MINI_GRAPH_MEMORY_CONTROL__ ??
    parseExampleMemoryControlOptions(
      ownerWindow?.localStorage?.getItem("__MINI_GRAPH_MEMORY_CONTROL__")
    );

  return {
    disableRuntimeFeedbackProjection: Boolean(
      control?.disableRuntimeFeedbackProjection
    ),
    disableDebugTestSurface: Boolean(control?.disableDebugTestSurface)
  };
}

/**
 * 解析持久化的内存控制开关，供刷新页面后的手动验证复用。
 *
 * @param rawValue - localStorage 中的原始值。
 * @returns 解析后的控制选项；不存在或格式错误时返回 undefined。
 */
function parseExampleMemoryControlOptions(
  rawValue: string | null | undefined
): ExampleMemoryControlOptions | undefined {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as ExampleMemoryControlOptions;
    if (!parsedValue || typeof parsedValue !== "object") {
      return undefined;
    }

    return parsedValue;
  } catch {
    return undefined;
  }
}

/**
 * 创建一个可取消的 RAF 调度器，供 demo 层延迟执行 fitView 使用。
 *
 * @param ownerWindow - 持有 requestAnimationFrame / cancelAnimationFrame 的 Window。
 * @returns 带最小诊断快照的调度器。
 */
export function createExampleAnimationFrameScheduler(
  ownerWindow: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">
): ExampleAnimationFrameScheduler {
  const pendingFrameIds = new Set<number>();
  let fitViewScheduleCount = 0;
  let fitViewCancelCount = 0;

  return {
    schedule(callback) {
      const frameId = ownerWindow.requestAnimationFrame(() => {
        pendingFrameIds.delete(frameId);
        callback();
      });
      pendingFrameIds.add(frameId);
      fitViewScheduleCount += 1;
      return frameId;
    },
    cancel(frameId) {
      if (!pendingFrameIds.delete(frameId)) {
        return;
      }

      ownerWindow.cancelAnimationFrame(frameId);
      fitViewCancelCount += 1;
    },
    cancelAll() {
      for (const frameId of pendingFrameIds) {
        ownerWindow.cancelAnimationFrame(frameId);
        fitViewCancelCount += 1;
      }
      pendingFrameIds.clear();
    },
    getSnapshot() {
      return {
        pendingFitViewFrameCount: pendingFrameIds.size,
        fitViewScheduleCount,
        fitViewCancelCount
      };
    }
  };
}
