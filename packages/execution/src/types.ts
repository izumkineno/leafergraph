import type { SlotType } from "@leafergraph/node";

export type LeaferGraphNodeExecutionStatus =
  | "idle"
  | "running"
  | "success"
  | "error";

export interface LeaferGraphNodeExecutionState {
  status: LeaferGraphNodeExecutionStatus;
  runCount: number;
  lastExecutedAt?: number;
  lastSucceededAt?: number;
  lastFailedAt?: number;
  lastErrorMessage?: string;
}

export type LeaferGraphExecutionSource =
  | "graph-play"
  | "graph-step"
  | "node-play";

export interface LeaferGraphExecutionContext {
  source: LeaferGraphExecutionSource;
  runId?: string;
  entryNodeId: string;
  stepIndex: number;
  startedAt: number;
  payload?: unknown;
}

export interface LeaferGraphPropagatedExecutionMetadata {
  linkId: string;
  sourceNodeId: string;
  sourceNodeType: string;
  sourceSlot: number;
  sourceSlotName?: string;
  sourceSlotType?: SlotType;
  targetNodeId: string;
  targetNodeType: string;
  targetSlot: number;
  targetSlotName: string;
  targetSlotType?: SlotType;
}

export type LeaferGraphNodeExecutionTrigger = "direct" | "propagated";

export interface LeaferGraphActionExecutionOptions
  extends Record<string, unknown> {
  trigger?: LeaferGraphNodeExecutionTrigger;
  executionContext?: LeaferGraphExecutionContext;
  propagation?: LeaferGraphPropagatedExecutionMetadata;
}

export interface LeaferGraphNodeExecutionEvent {
  chainId: string;
  rootNodeId: string;
  rootNodeType: string;
  rootNodeTitle: string;
  nodeId: string;
  nodeType: string;
  nodeTitle: string;
  depth: number;
  sequence: number;
  source: LeaferGraphExecutionSource;
  trigger: LeaferGraphNodeExecutionTrigger;
  timestamp: number;
  executionContext: LeaferGraphExecutionContext;
  state: LeaferGraphNodeExecutionState;
}

export type LeaferGraphGraphExecutionStatus = "idle" | "running" | "stepping";

export interface LeaferGraphGraphExecutionState {
  status: LeaferGraphGraphExecutionStatus;
  runId?: string;
  queueSize: number;
  stepCount: number;
  startedAt?: number;
  stoppedAt?: number;
  lastSource?: Extract<LeaferGraphExecutionSource, "graph-play" | "graph-step">;
}

export type LeaferGraphGraphExecutionEventType =
  | "started"
  | "advanced"
  | "drained"
  | "stopped";

export interface LeaferGraphGraphExecutionEvent {
  type: LeaferGraphGraphExecutionEventType;
  state: LeaferGraphGraphExecutionState;
  runId?: string;
  source?: Extract<LeaferGraphExecutionSource, "graph-play" | "graph-step">;
  nodeId?: string;
  timestamp: number;
}

export interface LeaferGraphLinkPropagationEvent {
  linkId: string;
  chainId: string;
  sourceNodeId: string;
  sourceSlot: number;
  targetNodeId: string;
  targetSlot: number;
  payload: unknown;
  timestamp: number;
}

export interface NodeExecutionFeedbackEvent {
  type: "node.execution";
  event: LeaferGraphNodeExecutionEvent;
}

export interface GraphExecutionFeedbackEvent {
  type: "graph.execution";
  event: LeaferGraphGraphExecutionEvent;
}

export interface LinkPropagationFeedbackEvent {
  type: "link.propagation";
  event: LeaferGraphLinkPropagationEvent;
}

export type ExecutionFeedbackEvent =
  | NodeExecutionFeedbackEvent
  | GraphExecutionFeedbackEvent
  | LinkPropagationFeedbackEvent;

export interface ExecutionFeedbackAdapter {
  subscribe(listener: (event: ExecutionFeedbackEvent) => void): () => void;
  destroy?(): void;
}
