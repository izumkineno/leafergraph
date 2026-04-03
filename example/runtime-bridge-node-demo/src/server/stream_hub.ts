import {
  RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY,
  type DemoStreamFrame,
  type RuntimeBridgeNodeDemoAuthorityStreamBridge
} from "../shared/stream";

/**
 * demo authority 使用的高频流 hub。
 *
 * @remarks
 * 只保留每个节点的 latest frame，供新连接立即回放；
 * 不承担正式 bridge 协议或持久化职责。
 */
export class RuntimeBridgeNodeDemoStreamHub {
  private readonly listeners = new Set<(frame: DemoStreamFrame) => void>();
  private readonly latestFrameByNodeId = new Map<string, DemoStreamFrame>();

  publish(frame: DemoStreamFrame): void {
    const snapshot = structuredClone(frame);
    this.latestFrameByNodeId.set(snapshot.nodeId, snapshot);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  clear(): void {
    this.latestFrameByNodeId.clear();
  }

  listLatestFrames(): DemoStreamFrame[] {
    return [...this.latestFrameByNodeId.values()].map((frame) =>
      structuredClone(frame)
    );
  }

  subscribe(listener: (frame: DemoStreamFrame) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * 把 authority stream bridge 安装到全局，供远端 authority artifact 发布高频帧。
 *
 * @param hub - stream hub。
 * @returns 已安装的 bridge。
 */
export function installRuntimeBridgeNodeDemoAuthorityStreamBridge(
  hub: RuntimeBridgeNodeDemoStreamHub
): RuntimeBridgeNodeDemoAuthorityStreamBridge {
  const bridge: RuntimeBridgeNodeDemoAuthorityStreamBridge = {
    publish(frame) {
      hub.publish(frame);
    },
    clear() {
      hub.clear();
    }
  };

  Object.defineProperty(globalThis, RUNTIME_BRIDGE_NODE_DEMO_AUTHORITY_STREAM_BRIDGE_GLOBAL_KEY, {
    configurable: true,
    writable: true,
    value: bridge
  });

  return bridge;
}

