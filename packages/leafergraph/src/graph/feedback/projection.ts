import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  RuntimeFeedbackEvent
} from "@leafergraph/core/contracts";

/** 外部 runtime feedback 投影到主包运行时宿主所需的最小壳面。 */
export interface LeaferGraphExternalRuntimeFeedbackProjectionHost {
  projectExternalGraphExecution(
    event: LeaferGraphGraphExecutionEvent
  ): void;
  projectExternalNodeExecution(
    event: LeaferGraphNodeExecutionEvent
  ): void;
  projectExternalNodeState(
    event: LeaferGraphNodeStateChangeEvent
  ): void;
  projectExternalLinkPropagation(
    event: LeaferGraphLinkPropagationEvent
  ): void;
}

/**
 * 把 authority 或其他外部 runtime 的反馈投影回当前图运行时。
 *
 * @remarks
 * 这层只负责做事件分发，不直接承载具体的节点壳刷新或动画逻辑；
 * 真正的视觉更新仍由各自的 runtime host 负责。
 *
 * @param host - 当前宿主实现。
 * @param feedback - 反馈。
 * @returns 无返回值。
 */
export function projectExternalRuntimeFeedback(
  host: LeaferGraphExternalRuntimeFeedbackProjectionHost,
  feedback: RuntimeFeedbackEvent
): void {
  switch (feedback.type) {
    case "graph.execution":
      host.projectExternalGraphExecution(feedback.event);
      return;
    case "node.execution":
      host.projectExternalNodeExecution(feedback.event);
      return;
    case "node.state":
      host.projectExternalNodeState(feedback.event);
      return;
    case "link.propagation":
      host.projectExternalLinkPropagation(feedback.event);
      return;
  }
}
