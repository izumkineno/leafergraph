/**
 * 本地运行时反馈 adapter。
 *
 * @remarks
 * 当前阶段它只负责把本地执行器和节点状态宿主归一成统一 `RuntimeFeedbackEvent`，
 * 让 UI 与未来外部 runtime 桥接可以共享同一条订阅入口。
 */

import type {
  RuntimeAdapter,
  RuntimeFeedbackEvent,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent
} from "../api/graph_api_types";

interface LeaferGraphLocalRuntimeAdapterOptions {
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void;
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void;
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void;
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void;
}

export class LeaferGraphLocalRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();

  private readonly disposers: Array<() => void>;

  constructor(options: LeaferGraphLocalRuntimeAdapterOptions) {
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
      options.subscribeNodeState((event) => {
        this.emit({
          type: "node.state",
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

  subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.listeners.clear();
  }

  private emit(event: RuntimeFeedbackEvent): void {
    if (!this.listeners.size) {
      return;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
