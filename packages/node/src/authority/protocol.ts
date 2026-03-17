import type {
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint
} from "../graph.js";
import type {
  NodeFlags,
  NodePropertySpec,
  NodeSerializeResult,
  NodeSlotSpec
} from "../types.js";

/** Node authority 侧复用的最小槽位输入结构。 */
export type AuthorityNodeSlotInput = string | NodeSlotSpec;

/** Node authority 侧复用的节点 widget 列表。 */
export type AuthorityNodeWidgetList = NodeSerializeResult["widgets"];

/** Node authority 侧复用的创建节点输入。 */
export interface AuthorityCreateNodeInput {
  id?: string;
  type: string;
  title?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: AuthorityNodeSlotInput[];
  outputs?: AuthorityNodeSlotInput[];
  widgets?: AuthorityNodeWidgetList;
  data?: Record<string, unknown>;
  flags?: Partial<NodeFlags>;
}

/** Node authority 侧复用的更新节点输入。 */
export interface AuthorityUpdateNodeInput {
  id?: string;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: AuthorityNodeSlotInput[];
  outputs?: AuthorityNodeSlotInput[];
  widgets?: AuthorityNodeWidgetList;
  data?: Record<string, unknown>;
  flags?: Partial<NodeFlags>;
}

/** Node authority 侧复用的移动节点输入。 */
export interface AuthorityMoveNodeInput {
  x: number;
  y: number;
}

/** Node authority 侧复用的 resize 输入。 */
export interface AuthorityResizeNodeInput {
  width: number;
  height: number;
}

/** Node authority 侧复用的创建连线输入。 */
export interface AuthorityCreateLinkInput extends Omit<GraphLink, "id"> {
  id?: string;
}

/** 正式图操作的最小公共基类。 */
export interface AuthorityGraphOperationBase {
  operationId: string;
  timestamp: number;
  source: string;
}

/** 创建节点操作。 */
export interface AuthorityGraphNodeCreateOperation
  extends AuthorityGraphOperationBase {
  type: "node.create";
  input: AuthorityCreateNodeInput;
}

/** 更新节点操作。 */
export interface AuthorityGraphNodeUpdateOperation
  extends AuthorityGraphOperationBase {
  type: "node.update";
  nodeId: string;
  input: AuthorityUpdateNodeInput;
}

/** 移动节点操作。 */
export interface AuthorityGraphNodeMoveOperation
  extends AuthorityGraphOperationBase {
  type: "node.move";
  nodeId: string;
  input: AuthorityMoveNodeInput;
}

/** 调整节点尺寸操作。 */
export interface AuthorityGraphNodeResizeOperation
  extends AuthorityGraphOperationBase {
  type: "node.resize";
  nodeId: string;
  input: AuthorityResizeNodeInput;
}

/** 删除节点操作。 */
export interface AuthorityGraphNodeRemoveOperation
  extends AuthorityGraphOperationBase {
  type: "node.remove";
  nodeId: string;
}

/** 创建连线操作。 */
export interface AuthorityGraphLinkCreateOperation
  extends AuthorityGraphOperationBase {
  type: "link.create";
  input: AuthorityCreateLinkInput;
}

/** 删除连线操作。 */
export interface AuthorityGraphLinkRemoveOperation
  extends AuthorityGraphOperationBase {
  type: "link.remove";
  linkId: string;
}

/** 重连连线操作。 */
export interface AuthorityGraphLinkReconnectOperation
  extends AuthorityGraphOperationBase {
  type: "link.reconnect";
  linkId: string;
  input: {
    source?: GraphLinkEndpoint;
    target?: GraphLinkEndpoint;
  };
}

/** Node authority 当前支持的最小正式图操作集合。 */
export type AuthorityGraphOperation =
  | AuthorityGraphNodeCreateOperation
  | AuthorityGraphNodeUpdateOperation
  | AuthorityGraphNodeMoveOperation
  | AuthorityGraphNodeResizeOperation
  | AuthorityGraphNodeRemoveOperation
  | AuthorityGraphLinkCreateOperation
  | AuthorityGraphLinkRemoveOperation
  | AuthorityGraphLinkReconnectOperation;

/** authority 客户端提交操作时可见的最小上下文。 */
export interface AuthorityOperationContext {
  currentDocument: GraphDocument;
  pendingOperationIds: readonly string[];
}

/** authority 客户端替换整图时可见的最小上下文。 */
export interface AuthorityReplaceDocumentContext {
  currentDocument: GraphDocument;
}

/** authority 回给客户端的最小操作结果。 */
export interface AuthorityOperationResult {
  accepted: boolean;
  changed: boolean;
  revision: GraphDocument["revision"];
  reason?: string;
  document?: GraphDocument;
}

/** authority 侧节点执行状态快照。 */
export interface AuthorityNodeExecutionState {
  status: "idle" | "running" | "success" | "error";
  runCount: number;
  lastExecutedAt?: number;
  lastSucceededAt?: number;
  lastFailedAt?: number;
  lastErrorMessage?: string;
}

/** authority 侧节点执行反馈事件。 */
export interface AuthorityNodeExecutionEvent {
  chainId: string;
  rootNodeId: string;
  rootNodeType: string;
  rootNodeTitle: string;
  nodeId: string;
  nodeType: string;
  nodeTitle: string;
  depth: number;
  sequence: number;
  source: "node-play" | "graph-play" | "graph-step";
  trigger: "direct" | "propagated";
  timestamp: number;
  executionContext: {
    source: "node-play" | "graph-play" | "graph-step";
    runId?: string;
    entryNodeId: string;
    stepIndex: number;
    startedAt: number;
    payload?: unknown;
  };
  state: AuthorityNodeExecutionState;
}

/** authority 侧节点状态变化原因。 */
export type AuthorityNodeStateChangeReason =
  | "created"
  | "updated"
  | "removed"
  | "moved"
  | "resized"
  | "connections"
  | "execution";

/** authority 侧节点状态变化事件。 */
export interface AuthorityNodeStateChangeEvent {
  nodeId: string;
  exists: boolean;
  reason: AuthorityNodeStateChangeReason;
  timestamp: number;
}

/** authority 侧连线传播事件。 */
export interface AuthorityLinkPropagationEvent {
  linkId: string;
  chainId: string;
  sourceNodeId: string;
  sourceSlot: number;
  targetNodeId: string;
  targetSlot: number;
  payload: unknown;
  timestamp: number;
}

/** authority 侧节点执行反馈事件包装。 */
export interface AuthorityNodeExecutionRuntimeFeedbackEvent {
  type: "node.execution";
  event: AuthorityNodeExecutionEvent;
}

/** authority 侧节点状态反馈事件包装。 */
export interface AuthorityNodeStateRuntimeFeedbackEvent {
  type: "node.state";
  event: AuthorityNodeStateChangeEvent;
}

/** authority 侧连线传播反馈事件包装。 */
export interface AuthorityLinkPropagationRuntimeFeedbackEvent {
  type: "link.propagation";
  event: AuthorityLinkPropagationEvent;
}

/** authority 侧统一运行反馈事件。 */
export type AuthorityRuntimeFeedbackEvent =
  | AuthorityNodeExecutionRuntimeFeedbackEvent
  | AuthorityNodeStateRuntimeFeedbackEvent
  | AuthorityLinkPropagationRuntimeFeedbackEvent;

/** authority transport 获取整图快照请求。 */
export interface AuthorityGetDocumentRequest {
  action: "getDocument";
}

/** authority transport 提交操作请求。 */
export interface AuthoritySubmitOperationRequest {
  action: "submitOperation";
  operation: AuthorityGraphOperation;
  context: AuthorityOperationContext;
}

/** authority transport 替换文档请求。 */
export interface AuthorityReplaceDocumentRequest {
  action: "replaceDocument";
  document: GraphDocument;
  context: AuthorityReplaceDocumentContext;
}

/** authority transport 最小请求联合。 */
export type AuthorityTransportRequest =
  | AuthorityGetDocumentRequest
  | AuthoritySubmitOperationRequest
  | AuthorityReplaceDocumentRequest;

/** authority transport 获取整图快照响应。 */
export interface AuthorityGetDocumentResponse {
  action: "getDocument";
  document: GraphDocument;
}

/** authority transport 提交操作响应。 */
export interface AuthoritySubmitOperationResponse {
  action: "submitOperation";
  result: AuthorityOperationResult;
}

/** authority transport 替换文档响应。 */
export interface AuthorityReplaceDocumentResponse {
  action: "replaceDocument";
  document?: GraphDocument;
}

/** authority transport 最小响应联合。 */
export type AuthorityTransportResponse =
  | AuthorityGetDocumentResponse
  | AuthoritySubmitOperationResponse
  | AuthorityReplaceDocumentResponse;

/** authority transport 运行反馈事件。 */
export interface AuthorityRuntimeFeedbackTransportEvent {
  type: "runtimeFeedback";
  event: AuthorityRuntimeFeedbackEvent;
}

/** authority transport 当前支持的最小事件集合。 */
export type AuthorityTransportEvent = AuthorityRuntimeFeedbackTransportEvent;

/** authority 请求 envelope。 */
export interface AuthorityRequestEnvelope {
  channel: "authority.request";
  requestId: string;
  request: AuthorityTransportRequest;
}

/** authority 成功响应 envelope。 */
export interface AuthoritySuccessEnvelope {
  channel: "authority.response";
  requestId: string;
  ok: true;
  response: AuthorityTransportResponse;
}

/** authority 失败响应 envelope。 */
export interface AuthorityFailureEnvelope {
  channel: "authority.response";
  requestId: string;
  ok: false;
  error: string;
}

/** authority 事件 envelope。 */
export interface AuthorityEventEnvelope {
  channel: "authority.event";
  event: AuthorityTransportEvent;
}

/** authority 请求入站 envelope。 */
export type AuthorityRequestInboundEnvelope = AuthorityRequestEnvelope;

/** authority 响应 / 事件出站 envelope。 */
export type AuthorityOutboundEnvelope =
  | AuthoritySuccessEnvelope
  | AuthorityFailureEnvelope
  | AuthorityEventEnvelope;
