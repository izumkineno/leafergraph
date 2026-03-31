import type {
  ExecutionFeedbackAdapter,
  ExecutionFeedbackEvent,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent
} from "../types.js";

interface LeaferGraphLocalExecutionFeedbackAdapterOptions {
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void;
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void;
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void;
}

/**
 * 封装 LeaferGraphLocalExecutionFeedbackAdapter 的适配逻辑。
 */
export class LeaferGraphLocalExecutionFeedbackAdapter
  implements ExecutionFeedbackAdapter
{
  private readonly listeners = new Set<
    (event: ExecutionFeedbackEvent) => void
  >();

  private readonly disposers: Array<() => void>;

  /**
   * 初始化 LeaferGraphLocalExecutionFeedbackAdapter 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphLocalExecutionFeedbackAdapterOptions) {
    this.disposers = [
      options.subscribeNodeExecution((event) => {
        this.emit({
          type: "node.execution",
          event
        });
      }),
      options.subscribeGraphExecution((event) => {
        this.emit({
          type: "graph.execution",
          event
        });
      }),
      options.subscribeLinkPropagation((event) => {
        this.emit({
          type: "link.propagation",
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
  subscribe(listener: (event: ExecutionFeedbackEvent) => void): () => void {
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
    this.listeners.clear();
  }

  /**
   * 处理 `emit` 相关逻辑。
   *
   * @param event - 当前事件对象。
   * @returns 无返回值。
   */
  private emit(event: ExecutionFeedbackEvent): void {
    if (!this.listeners.size) {
      return;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
