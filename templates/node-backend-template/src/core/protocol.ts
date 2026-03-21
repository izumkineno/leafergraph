import type {
  AdapterBinding,
  CapabilityProfile,
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint,
  NodeFlags,
  NodePropertySpec,
  NodeSerializeResult,
  NodeSlotSpec
} from "@leafergraph/node";

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

/** Node authority 侧复用的文档根字段补丁。 */
export interface AuthorityUpdateDocumentInput {
  appKind?: string;
  meta?: Record<string, unknown>;
  capabilityProfile?: CapabilityProfile | null;
  adapterBinding?: AdapterBinding | null;
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

/** 更新文档根字段操作。 */
export interface AuthorityGraphDocumentUpdateOperation
  extends AuthorityGraphOperationBase {
  type: "document.update";
  input: AuthorityUpdateDocumentInput;
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
  | AuthorityGraphDocumentUpdateOperation
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

/** authority 图级执行状态快照。 */
export interface AuthorityGraphExecutionState {
  status: "idle" | "running" | "stepping";
  runId?: string;
  queueSize: number;
  stepCount: number;
  startedAt?: number;
  stoppedAt?: number;
  lastSource?: "graph-play" | "graph-step";
}

/** authority 图级执行事件类型。 */
export type AuthorityGraphExecutionEventType =
  | "started"
  | "advanced"
  | "drained"
  | "stopped";

/** authority 图级执行反馈事件。 */
export interface AuthorityGraphExecutionEvent {
  type: AuthorityGraphExecutionEventType;
  state: AuthorityGraphExecutionState;
  runId?: string;
  source?: "graph-play" | "graph-step";
  nodeId?: string;
  timestamp: number;
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

/** authority 侧图级执行反馈事件包装。 */
export interface AuthorityGraphExecutionRuntimeFeedbackEvent {
  type: "graph.execution";
  event: AuthorityGraphExecutionEvent;
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
  | AuthorityGraphExecutionRuntimeFeedbackEvent
  | AuthorityNodeStateRuntimeFeedbackEvent
  | AuthorityLinkPropagationRuntimeFeedbackEvent;

/** authority 运行控制请求。 */
export type AuthorityRuntimeControlRequest =
  | {
      type: "node.play";
      nodeId: string;
    }
  | {
      type: "graph.play";
    }
  | {
      type: "graph.step";
    }
  | {
      type: "graph.stop";
    };

/** authority 运行控制结果。 */
export interface AuthorityRuntimeControlResult {
  accepted: boolean;
  changed: boolean;
  reason?: string;
  state?: AuthorityGraphExecutionState;
}

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

/** authority transport 运行控制请求。 */
export interface AuthorityControlRuntimeRequest {
  action: "controlRuntime";
  request: AuthorityRuntimeControlRequest;
}

/** authority transport 最小请求联合。 */
export type AuthorityTransportRequest =
  | AuthorityGetDocumentRequest
  | AuthoritySubmitOperationRequest
  | AuthorityReplaceDocumentRequest
  | AuthorityControlRuntimeRequest;

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

/** authority transport 运行控制响应。 */
export interface AuthorityControlRuntimeResponse {
  action: "controlRuntime";
  result: AuthorityRuntimeControlResult;
}

/** authority transport 最小响应联合。 */
export type AuthorityTransportResponse =
  | AuthorityGetDocumentResponse
  | AuthoritySubmitOperationResponse
  | AuthorityReplaceDocumentResponse
  | AuthorityControlRuntimeResponse;

/** authority transport 运行反馈事件。 */
export interface AuthorityRuntimeFeedbackTransportEvent {
  type: "runtimeFeedback";
  event: AuthorityRuntimeFeedbackEvent;
}

/** 后端推送前端 bundle 源码时，单个 bundle 的最小描述。 */
export interface AuthorityFrontendBundleSource {
  bundleId: string;
  slot: "demo" | "node" | "widget";
  fileName: string;
  sourceCode: string;
  enabled: boolean;
  requires?: string[];
  sha256: string;
}

/** 后端推送前端 bundle 源码时，单个节点包的最小描述。 */
export interface AuthorityFrontendBundlePackage {
  packageId: string;
  version: string;
  nodeTypes: string[];
  bundles: AuthorityFrontendBundleSource[];
}

/** 后端推送前端 bundle 的同步事件。 */
export interface AuthorityFrontendBundlesSyncEvent {
  type: "frontendBundles.sync";
  mode: "full" | "upsert" | "remove";
  packages?: AuthorityFrontendBundlePackage[];
  removedPackageIds?: string[];
  emittedAt: number;
}

/** authority transport 前端 bundle 同步事件。 */
export interface AuthorityFrontendBundlesSyncTransportEvent {
  type: "frontendBundles.sync";
  event: AuthorityFrontendBundlesSyncEvent;
}

/** authority transport 主动回推整图快照事件。 */
export interface AuthorityDocumentTransportEvent {
  type: "document";
  document: GraphDocument;
}

/** authority transport 当前支持的最小事件集合。 */
export type AuthorityTransportEvent =
  | AuthorityRuntimeFeedbackTransportEvent
  | AuthorityDocumentTransportEvent
  | AuthorityFrontendBundlesSyncTransportEvent;

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

/** Node authority 协议适配器。 */
export interface AuthorityProtocolAdapter {
  /** 构造一条 authority request envelope。 */
  createRequestEnvelope(
    requestId: string,
    request: AuthorityTransportRequest
  ): AuthorityRequestEnvelope;
  /** 构造一条 authority 成功响应 envelope。 */
  createSuccessEnvelope(
    requestId: string,
    response: AuthorityTransportResponse
  ): AuthoritySuccessEnvelope;
  /** 构造一条 authority 失败响应 envelope。 */
  createFailureEnvelope(
    requestId: string,
    error: string
  ): AuthorityFailureEnvelope;
  /** 构造一条 authority 事件 envelope。 */
  createEventEnvelope(event: AuthorityTransportEvent): AuthorityEventEnvelope;
  /** 从未知消息里解析 request envelope。 */
  parseRequestEnvelope(value: unknown): AuthorityRequestInboundEnvelope | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRequestEnvelope(value: unknown): value is AuthorityRequestInboundEnvelope {
  return (
    isRecord(value) &&
    value.channel === "authority.request" &&
    typeof value.requestId === "string" &&
    isRecord(value.request) &&
    typeof value.request.action === "string"
  );
}

/** 当前默认 authority envelope 协议适配器。 */
export function createDefaultAuthorityProtocolAdapter(): AuthorityProtocolAdapter {
  return {
    createRequestEnvelope(requestId, request) {
      return {
        channel: "authority.request",
        requestId,
        request
      };
    },

    createSuccessEnvelope(requestId, response) {
      return {
        channel: "authority.response",
        requestId,
        ok: true,
        response
      };
    },

    createFailureEnvelope(requestId, error) {
      return {
        channel: "authority.response",
        requestId,
        ok: false,
        error
      };
    },

    createEventEnvelope(event) {
      return {
        channel: "authority.event",
        event
      };
    },

    parseRequestEnvelope(value) {
      return isRequestEnvelope(value) ? value : null;
    }
  };
}

/** Node authority 当前默认复用的协议适配器实例。 */
export const DEFAULT_AUTHORITY_PROTOCOL_ADAPTER =
  createDefaultAuthorityProtocolAdapter();
