import {
  RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY,
  type DemoBrowserStreamStats,
  type DemoStreamFrame,
  type RuntimeBridgeNodeDemoBrowserStreamStore
} from "../shared/stream";

const STREAM_RATE_WINDOW_MS = 1000;

/**
 * 创建浏览器侧 demo stream store。
 *
 * @returns 可供 app 和远端 widget 共用的 store。
 */
export function createRuntimeBridgeNodeDemoStreamStore(): RuntimeBridgeNodeDemoBrowserStreamStore {
  const listenersByNodeId = new Map<
    string,
    Set<(frame: DemoStreamFrame) => void>
  >();
  const statsListeners = new Set<(stats: DemoBrowserStreamStats) => void>();
  const latestFrameByNodeId = new Map<string, DemoStreamFrame>();
  const frameTimestamps: number[] = [];
  let totalFrames = 0;
  let lastFrameAt: number | null = null;
  let lastFrameKind: DemoStreamFrame["kind"] | null = null;

  const emitStats = () => {
    const now = Date.now();
    while (
      frameTimestamps.length > 0 &&
      now - frameTimestamps[0] > STREAM_RATE_WINDOW_MS
    ) {
      frameTimestamps.shift();
    }

    const snapshot: DemoBrowserStreamStats = {
      totalFrames,
      framesPerSecond: frameTimestamps.length,
      latestNodeCount: latestFrameByNodeId.size,
      lastFrameAt,
      lastFrameKind
    };

    for (const listener of statsListeners) {
      listener(snapshot);
    }
  };

  const store: RuntimeBridgeNodeDemoBrowserStreamStore = {
    publish(frame) {
      const snapshot = structuredClone(frame);
      latestFrameByNodeId.set(snapshot.nodeId, snapshot);
      totalFrames += 1;
      lastFrameAt = snapshot.emittedAt;
      lastFrameKind = snapshot.kind;
      frameTimestamps.push(Date.now());

      const listeners = listenersByNodeId.get(snapshot.nodeId);
      if (listeners) {
        for (const listener of listeners) {
          listener(snapshot);
        }
      }

      emitStats();
    },
    getLatestFrame(nodeId) {
      const frame = latestFrameByNodeId.get(nodeId);
      return frame ? structuredClone(frame) : undefined;
    },
    subscribe(nodeId, listener) {
      const listeners = listenersByNodeId.get(nodeId) ?? new Set();
      listeners.add(listener);
      listenersByNodeId.set(nodeId, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          listenersByNodeId.delete(nodeId);
        }
      };
    },
    clear() {
      latestFrameByNodeId.clear();
      frameTimestamps.length = 0;
      totalFrames = 0;
      lastFrameAt = null;
      lastFrameKind = null;
      emitStats();
    },
    getStats() {
      const now = Date.now();
      while (
        frameTimestamps.length > 0 &&
        now - frameTimestamps[0] > STREAM_RATE_WINDOW_MS
      ) {
        frameTimestamps.shift();
      }

      return {
        totalFrames,
        framesPerSecond: frameTimestamps.length,
        latestNodeCount: latestFrameByNodeId.size,
        lastFrameAt,
        lastFrameKind
      };
    },
    subscribeStats(listener) {
      statsListeners.add(listener);
      listener(store.getStats());
      return () => {
        statsListeners.delete(listener);
      };
    }
  };

  return store;
}

export function installRuntimeBridgeNodeDemoBrowserStreamStore(
  store: RuntimeBridgeNodeDemoBrowserStreamStore
): void {
  Object.defineProperty(globalThis, RUNTIME_BRIDGE_NODE_DEMO_BROWSER_STREAM_STORE_GLOBAL_KEY, {
    configurable: true,
    writable: true,
    value: store
  });
}

