/**
 * 主包本地运行时反馈 adapter。
 *
 * @remarks
 * 当前阶段它负责把纯执行反馈和主包 `node.state` 归一成统一 `RuntimeFeedbackEvent`。
 */

import {
  LeaferGraphLocalExecutionFeedbackAdapter,
  type ExecutionFeedbackAdapter
} from "@leafergraph/core/execution";
import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  RuntimeAdapter,
  RuntimeFeedbackEvent,
  LeaferGraphNodeStateChangeEvent
} from "@leafergraph/core/contracts";
import {
  projectExternalRuntimeFeedback,
  type LeaferGraphExternalRuntimeFeedbackProjectionHost
} from "./projection";

export interface LeaferGraphRuntimeFeedbackEventSource {
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void;
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void;
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void;
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void;
}

export interface LeaferGraphRuntimeFeedbackHost
  extends RuntimeAdapter {
  projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void;
}

interface LeaferGraphLocalRuntimeAdapterOptions {
  executionAdapter: ExecutionFeedbackAdapter;
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void;
  projectionHost: LeaferGraphExternalRuntimeFeedbackProjectionHost;
}

/**
 * 封装 LeaferGraphLocalRuntimeAdapter 的适配逻辑。
 */
export class LeaferGraphLocalRuntimeAdapter
  implements LeaferGraphRuntimeFeedbackHost
{
  private readonly listeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();

  private readonly disposers: Array<() => void>;

  private readonly executionAdapter: ExecutionFeedbackAdapter;

  private readonly projectionHost: LeaferGraphExternalRuntimeFeedbackProjectionHost;

  /**
   * 初始化 LeaferGraphLocalRuntimeAdapter 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphLocalRuntimeAdapterOptions) {
    this.executionAdapter = options.executionAdapter;
    this.projectionHost = options.projectionHost;
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
   * 把外部 runtime feedback 投影回当前图运行时。
   *
   * @param feedback - 需要投影的运行反馈。
   * @returns 无返回值。
   */
  projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void {
    projectExternalRuntimeFeedback(this.projectionHost, feedback);
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

/**
 * 创建主包本地 runtime feedback 宿主。
 *
 * @param options - feedback 事件源与投影宿主。
 * @returns 统一运行反馈宿主。
 */
export function createLeaferGraphLocalRuntimeFeedbackHost(
  options: LeaferGraphRuntimeFeedbackEventSource &
    LeaferGraphExternalRuntimeFeedbackProjectionHost
): LeaferGraphRuntimeFeedbackHost {
  const executionAdapter = new LeaferGraphLocalExecutionFeedbackAdapter({
    subscribeNodeExecution: (listener) =>
      options.subscribeNodeExecution(listener),
    subscribeGraphExecution: (listener) =>
      options.subscribeGraphExecution(listener),
    subscribeLinkPropagation: (listener) =>
      options.subscribeLinkPropagation(listener)
  });

  return new LeaferGraphLocalRuntimeAdapter({
    executionAdapter,
    subscribeNodeState: (listener) => options.subscribeNodeState(listener),
    projectionHost: options
  });
}
