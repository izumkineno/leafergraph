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
} from "../api/graph_api_types";

interface LeaferGraphLocalRuntimeAdapterOptions {
  executionAdapter: ExecutionFeedbackAdapter;
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void;
}

export class LeaferGraphLocalRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<
    (event: RuntimeFeedbackEvent) => void
  >();

  private readonly disposers: Array<() => void>;

  private readonly executionAdapter: ExecutionFeedbackAdapter;

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
    this.executionAdapter.destroy?.();
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
