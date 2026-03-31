/**
 * 主包本地运行时反馈 adapter。
 *
 * @remarks
 * 当前阶段它负责把纯执行反馈和主包 `node.state` 归一成统一 `RuntimeFeedbackEvent`。
 */

import type { ExecutionFeedbackAdapter } from "@leafergraph/execution";
import type {
  RuntimeAdapter,
  RuntimeFeedbackEvent,
  LeaferGraphNodeStateChangeEvent
} from "@leafergraph/contracts";

interface LeaferGraphLocalRuntimeAdapterOptions {
  executionAdapter: ExecutionFeedbackAdapter;
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void;
}

/**
 * 封装 LeaferGraphLocalRuntimeAdapter 的适配逻辑。
 */
export class LeaferGraphLocalRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();

  private readonly disposers: Array<() => void>;

  private readonly executionAdapter: ExecutionFeedbackAdapter;

  /**
   * 初始化 LeaferGraphLocalRuntimeAdapter 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphLocalRuntimeAdapterOptions) {
    this.executionAdapter = options.executionAdapter;
    this.disposers = [
      this.executionAdapter.subscribe((event) => {
        this.emit(event);
      }),
      options.subscribeNodeState((event) => {
        this.emit({
          type: "node.state",
          event
        });
      })
    ];
  }

  /**
   * 处理 `subscribe` 相关逻辑。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消当前订阅的清理函数。
   */
  subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 处理 `destroy` 相关逻辑。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.executionAdapter.destroy?.();
    this.listeners.clear();
  }

  /**
   * 处理 `emit` 相关逻辑。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  private emit(event: RuntimeFeedbackEvent): void {
    if (!this.listeners.size) {
      return;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
