/**
 * `@leafergraph/execution` 的公共执行契约模块。
 *
 * @remarks
 * 负责定义图级执行状态机、节点执行事件、传播元数据和统一执行反馈协议。
 * 这些类型既服务纯执行内核，也服务宿主和作者层的类型消费。
 */

import type { SlotType } from "@leafergraph/node";

/**
 * 单个节点在执行链中的运行状态。
 *
 * @remarks
 * 这组值描述的是“最近一次执行结果”，
 * 不直接等同于节点的序列化字段或宿主视觉样式。
 */
export type LeaferGraphNodeExecutionStatus =
  | "idle"
  | "running"
  | "success"
  | "error";

/**
 * 长任务的显示模式。
 */
export type LeaferGraphNodeLongTaskMode = "determinate" | "indeterminate";

/**
 * 单个节点的执行状态快照。
 */
export interface LeaferGraphNodeExecutionState {
  /** 当前节点最近一次已知执行状态。 */
  status: LeaferGraphNodeExecutionStatus;
  /** 当前节点在本次运行生命周期中的累计执行次数。 */
  runCount: number;
  /** 当前长任务进度，范围为 `0..1`。 */
  progress?: number;
  /** 最近一次进入执行的时间戳。 */
  lastExecutedAt?: number;
  /** 最近一次成功完成执行的时间戳。 */
  lastSucceededAt?: number;
  /** 最近一次失败结束执行的时间戳。 */
  lastFailedAt?: number;
  /** 最近一次执行失败时记录的错误消息。 */
  lastErrorMessage?: string;
}

/**
 * 执行请求的来源。
 *
 * @remarks
 * 这组值区分的是控制入口，而不是节点内的传播触发方式。
 */
export type LeaferGraphExecutionSource =
  | "graph-play"
  | "graph-step"
  | "node-play";

/**
 * 一次执行链的公共上下文。
 *
 * @remarks
 * 图级运行和单节点调试都会沿用这份结构，
 * 以便后续日志、调试面板和事件订阅拿到统一的上下文信息。
 */
export interface LeaferGraphExecutionContext {
  /** 本次执行链的控制来源。 */
  source: LeaferGraphExecutionSource;
  /** 所属图级运行的稳定 run ID；节点单独调试时可能不存在。 */
  runId?: string;
  /** 本次执行链的入口节点 ID。 */
  entryNodeId: string;
  /** 当前执行链中的步进序号。 */
  stepIndex: number;
  /** 本次执行链启动的时间戳。 */
  startedAt: number;
  /** 调用方附带的原始 payload。 */
  payload?: unknown;
  /** 启动一个长任务控制器。 */
  startLongTask(): LeaferGraphLongTaskController;
}

/**
 * 长任务控制器。
 */
export interface LeaferGraphLongTaskController {
  /** 更新当前进度。 */
  setProgress(progress: number): void;
  /** 标记长任务成功结束。 */
  complete(): void;
  /** 标记长任务失败结束。 */
  fail(error?: unknown): void;
}

/**
 * 一次输出传播的完整元数据。
 *
 * @remarks
 * 这份结构会跟随传播任务一起下传，
 * 供 `event` 输入命中 `onAction(...)` 时精确知道来源连线和目标槽位。
 */
export interface LeaferGraphPropagatedExecutionMetadata {
  /** 触发传播的正式连线 ID。 */
  linkId: string;
  /** 输出来源节点 ID。 */
  sourceNodeId: string;
  /** 输出来源节点类型。 */
  sourceNodeType: string;
  /** 输出来源槽位索引。 */
  sourceSlot: number;
  /** 输出来源槽位名称。 */
  sourceSlotName?: string;
  /** 输出来源槽位类型。 */
  sourceSlotType?: SlotType;
  /** 传播目标节点 ID。 */
  targetNodeId: string;
  /** 传播目标节点类型。 */
  targetNodeType: string;
  /** 传播目标槽位索引。 */
  targetSlot: number;
  /** 传播目标槽位名称。 */
  targetSlotName: string;
  /** 传播目标槽位类型。 */
  targetSlotType?: SlotType;
}

/**
 * 节点这次执行是如何被触发的。
 *
 * @remarks
 * `direct` 表示入口任务或显式动作触发，
 * `propagated` 表示由上游输出沿正式连线传播触发。
 */
export type LeaferGraphNodeExecutionTrigger = "direct" | "propagated";

/**
 * `onAction(...)` 等动作入口可读取的执行选项。
 *
 * @remarks
 * 该结构保持开放扩展，允许宿主透传额外调试或控制信息。
 */
export interface LeaferGraphActionExecutionOptions
  extends Record<string, unknown> {
  /** 当前动作是直接触发还是传播触发。 */
  trigger?: LeaferGraphNodeExecutionTrigger;
  /** 当前动作所属的执行上下文。 */
  executionContext?: LeaferGraphExecutionContext;
  /** 当前动作若来自传播，则附带完整传播元数据。 */
  propagation?: LeaferGraphPropagatedExecutionMetadata;
}

/**
 * 单次节点执行事件。
 */
export interface LeaferGraphNodeExecutionEvent {
  /** 本条执行链的稳定链路 ID。 */
  chainId: string;
  /** 本条执行链的根节点 ID。 */
  rootNodeId: string;
  /** 根节点类型。 */
  rootNodeType: string;
  /** 根节点标题快照。 */
  rootNodeTitle: string;
  /** 当前事件对应的节点 ID。 */
  nodeId: string;
  /** 当前事件对应的节点类型。 */
  nodeType: string;
  /** 当前事件对应的节点标题。 */
  nodeTitle: string;
  /** 当前节点相对入口节点的传播深度。 */
  depth: number;
  /** 当前节点在整条链中的顺序号。 */
  sequence: number;
  /** 本次执行链的控制来源。 */
  source: LeaferGraphExecutionSource;
  /** 当前节点是如何被触发的。 */
  trigger: LeaferGraphNodeExecutionTrigger;
  /** 事件发出的时间戳。 */
  timestamp: number;
  /** 当前节点所属的执行上下文。 */
  executionContext: LeaferGraphExecutionContext;
  /** 当前节点执行后的状态快照。 */
  state: LeaferGraphNodeExecutionState;
}

/**
 * 图级执行状态机的总体状态。
 */
export type LeaferGraphGraphExecutionStatus = "idle" | "running" | "stepping";

/**
 * 图级执行状态快照。
 */
export interface LeaferGraphGraphExecutionState {
  /** 当前图执行状态机所处状态。 */
  status: LeaferGraphGraphExecutionStatus;
  /** 当前活动运行的稳定 ID。 */
  runId?: string;
  /** 当前待执行任务队列长度。 */
  queueSize: number;
  /** 当前图级运行累计已推进的步数。 */
  stepCount: number;
  /** 当前活动运行开始的时间戳。 */
  startedAt?: number;
  /** 最近一次停止运行的时间戳。 */
  stoppedAt?: number;
  /** 最近一次图级运行的来源。 */
  lastSource?: Extract<LeaferGraphExecutionSource, "graph-play" | "graph-step">;
}

/**
 * 图级执行事件类型。
 */
export type LeaferGraphGraphExecutionEventType =
  | "started"
  | "advanced"
  | "drained"
  | "stopped";

/**
 * 图级执行事件。
 */
export interface LeaferGraphGraphExecutionEvent {
  /** 当前图级事件类型。 */
  type: LeaferGraphGraphExecutionEventType;
  /** 事件发出时的图级状态快照。 */
  state: LeaferGraphGraphExecutionState;
  /** 当前关联的运行 ID。 */
  runId?: string;
  /** 当前事件若由控制入口触发，则记录对应来源。 */
  source?: Extract<LeaferGraphExecutionSource, "graph-play" | "graph-step">;
  /** 当前事件若与具体节点推进相关，则记录对应节点 ID。 */
  nodeId?: string;
  /** 事件发出的时间戳。 */
  timestamp: number;
}

/**
 * 连线传播事件。
 *
 * @remarks
 * 它表达的是“某次输出 payload 沿正式连线流向下游”的事实，
 * 供动画层、调试面板和宿主反馈投影统一消费。
 */
export interface LeaferGraphLinkPropagationEvent {
  /** 被命中的正式连线 ID。 */
  linkId: string;
  /** 所属执行链 ID。 */
  chainId: string;
  /** 传播来源节点 ID。 */
  sourceNodeId: string;
  /** 传播来源槽位索引。 */
  sourceSlot: number;
  /** 传播目标节点 ID。 */
  targetNodeId: string;
  /** 传播目标槽位索引。 */
  targetSlot: number;
  /** 本次传播携带的原始 payload。 */
  payload: unknown;
  /** 传播事件发出的时间戳。 */
  timestamp: number;
}

/** 节点执行反馈事件包装。 */
export interface NodeExecutionFeedbackEvent {
  /** 反馈事件固定类型。 */
  type: "node.execution";
  /** 节点执行事件正文。 */
  event: LeaferGraphNodeExecutionEvent;
}

/** 图执行反馈事件包装。 */
export interface GraphExecutionFeedbackEvent {
  /** 反馈事件固定类型。 */
  type: "graph.execution";
  /** 图级执行事件正文。 */
  event: LeaferGraphGraphExecutionEvent;
}

/** 连线传播反馈事件包装。 */
export interface LinkPropagationFeedbackEvent {
  /** 反馈事件固定类型。 */
  type: "link.propagation";
  /** 连线传播事件正文。 */
  event: LeaferGraphLinkPropagationEvent;
}

/**
 * 执行包统一对外暴露的反馈事件。
 */
export type ExecutionFeedbackEvent =
  | NodeExecutionFeedbackEvent
  | GraphExecutionFeedbackEvent
  | LinkPropagationFeedbackEvent;

/**
 * 执行反馈适配器协议。
 *
 * @remarks
 * 宿主或桥接层只需要实现这组最小订阅能力，
 * 就能把执行内核事件投影到日志、UI 或远端传输通道。
 */
export interface ExecutionFeedbackAdapter {
  /** 订阅统一执行反馈流。 */
  subscribe(listener: (event: ExecutionFeedbackEvent) => void): () => void;
  /** 释放适配器占用的外部资源。 */
  destroy?(): void;
}
