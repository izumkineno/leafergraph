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

export class LeaferGraphLocalExecutionFeedbackAdapter
  implements ExecutionFeedbackAdapter
{
  private readonly listeners = new Set<
    (event: ExecutionFeedbackEvent) => void
  >();

  private readonly disposers: Array<() => void>;

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

  subscribe(listener: (event: ExecutionFeedbackEvent) => void): () => void {
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

  private emit(event: ExecutionFeedbackEvent): void {
    if (!this.listeners.size) {
      return;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
