/**
 * 公共图 API 类型模块。
 *
 * @remarks
 * 负责定义节点创建、更新、移动、缩放和连线操作使用的公共输入类型，
 * 以及运行反馈、交互提交和宿主适配相关契约。
 */

import type {
  AdapterBinding,
  CapabilityProfile,
  GraphDocument,
  GraphLink,
  GraphLinkEndpoint,
  NodeFlags,
  NodeLayout,
  NodePropertySpec,
  NodeRuntimeState,
  NodeSlotSpec,
  SlotDirection,
  SlotType
} from "@leafergraph/node";
import type {
  ExecutionFeedbackEvent,
  GraphExecutionFeedbackEvent,
  LinkPropagationFeedbackEvent,
  LeaferGraphNodeExecutionState,
  NodeExecutionFeedbackEvent
} from "@leafergraph/execution";

export type {
  ExecutionFeedbackAdapter,
  ExecutionFeedbackEvent,
  GraphExecutionFeedbackEvent,
  LeaferGraphActionExecutionOptions,
  LeaferGraphExecutionContext,
  LeaferGraphExecutionSource,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionEventType,
  LeaferGraphGraphExecutionState,
  LeaferGraphGraphExecutionStatus,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeExecutionStatus,
  LeaferGraphNodeExecutionTrigger,
  LeaferGraphPropagatedExecutionMetadata,
  LinkPropagationFeedbackEvent,
  NodeExecutionFeedbackEvent
} from "@leafergraph/execution";

/**
 * 节点展示层对外可见的保留属性。
 *
 * @remarks
 * 这组字段描述的是节点在宿主层常用的展示属性，
 * 同时允许外层在 `properties` 中继续补充任意业务字段。
 */
export interface GraphNodeDisplayProperties {
  subtitle?: string;
  accent?: string;
  category?: string;
  status?: string;
}

/**
 * 宿主允许的槽位输入结构。
 * 既兼容旧的字符串数组，也兼容正式 `NodeSlotSpec`。
 *
 * @remarks
 * 对外 API 仍然允许使用最轻量的字符串声明槽位名称，
 * 但进入运行时前都会被统一转换成正式槽位结构。
 */
export type LeaferGraphNodeSlotInput = string | NodeSlotSpec;

/**
 * 宿主创建节点时使用的输入结构。
 * 这里保留 editor 友好的顶层 `x / y / width / height` 写法，
 * 但不再继承 demo 输入类型。
 *
 * @remarks
 * 这份输入专门服务宿主对外的交互型 API，
 * 在真正进入 `@leafergraph/node` 之前会被转换为正式节点状态创建参数。
 */
export interface LeaferGraphCreateNodeInput extends GraphNodeDisplayProperties {
  /** 节点 ID；未提供时由底层节点创建链路生成。 */
  id?: string;
  /** 节点类型；必须指向当前注册表里已存在的节点定义。 */
  type: string;
  /** 节点标题；未提供时回退到节点定义默认标题。 */
  title?: string;
  /** 节点左上角的图坐标 X。 */
  x: number;
  /** 节点左上角的图坐标 Y。 */
  y: number;
  /** 显式宽度；未提供时交给节点定义或布局默认值决定。 */
  width?: number;
  /** 显式高度；未提供时交给节点定义或布局默认值决定。 */
  height?: number;
  /** 节点的正式业务属性。 */
  properties?: Record<string, unknown>;
  /** 节点属性面板或序列化可见的属性规格。 */
  propertySpecs?: NodePropertySpec[];
  /** 输入槽位声明。 */
  inputs?: LeaferGraphNodeSlotInput[];
  /** 输出槽位声明。 */
  outputs?: LeaferGraphNodeSlotInput[];
  /** 节点内部 Widget 列表。 */
  widgets?: NodeRuntimeState["widgets"];
  /** 节点的扩展数据载荷。 */
  data?: Record<string, unknown>;
  /** 节点初始运行时标记。 */
  flags?: Partial<NodeFlags>;
}

/**
 * 宿主更新节点时使用的输入结构。
 * 这一轮先聚焦“内容与布局更新”，不支持在 `updateNode(...)` 中直接修改节点 ID。
 *
 * @remarks
 * 这份输入和创建输入一样保留了扁平坐标字段，
 * 方便 editor 命令系统在不构造嵌套 layout 的前提下完成局部补丁更新。
 */
export interface LeaferGraphUpdateNodeInput
  extends Partial<GraphNodeDisplayProperties> {
  /** 预留给一致性校验；当前不支持真正修改节点 ID。 */
  id?: string;
  /** 待更新的标题。 */
  title?: string;
  /** 待更新的图坐标 X。 */
  x?: number;
  /** 待更新的图坐标 Y。 */
  y?: number;
  /** 待更新的宽度。 */
  width?: number;
  /** 待更新的高度。 */
  height?: number;
  /** 待合并进节点的正式属性补丁。 */
  properties?: Record<string, unknown>;
  /** 待替换的属性规格。 */
  propertySpecs?: NodePropertySpec[];
  /** 待替换的输入槽位声明。 */
  inputs?: LeaferGraphNodeSlotInput[];
  /** 待替换的输出槽位声明。 */
  outputs?: LeaferGraphNodeSlotInput[];
  /** 待替换的 Widget 列表。 */
  widgets?: NodeRuntimeState["widgets"];
  /** 待替换的扩展数据。 */
  data?: Record<string, unknown>;
  /** 待合并到节点上的运行时标记补丁。 */
  flags?: Partial<NodeFlags>;
}

/**
 * 宿主更新文档根字段时使用的输入结构。
 *
 * @remarks
 * 这条补丁只服务正式文档根元信息同步，
 * 不允许修改 `documentId` 和 `revision` 这类 authority 持有字段。
 */
export interface LeaferGraphUpdateDocumentInput {
  /** 待更新的应用类型。 */
  appKind?: string;
  /** 待替换的文档级扩展元数据。 */
  meta?: Record<string, unknown>;
  /** 待替换的能力画像；传 `null` 表示清空。 */
  capabilityProfile?: CapabilityProfile | null;
  /** 待替换的 adapter 绑定信息；传 `null` 表示清空。 */
  adapterBinding?: AdapterBinding | null;
}

/**
 * 宿主移动节点时使用的位置结构。
 * 之所以单独定义成对象，而不是直接传 `(x, y)`，
 * 是为了给后续扩展吸附、来源信息、批量移动等元数据预留空间。
 */
export interface LeaferGraphMoveNodeInput {
  /** 节点移动后的目标 X 坐标。 */
  x: number;
  /** 节点移动后的目标 Y 坐标。 */
  y: number;
}

/**
 * 宿主调整节点尺寸时使用的输入结构。
 * 当前阶段只开放显式宽高，后续如需保留锚点或按比例缩放，再扩展额外元数据。
 */
export interface LeaferGraphResizeNodeInput {
  /** 节点目标宽度。 */
  width: number;
  /** 节点目标高度。 */
  height: number;
}

/**
 * 节点选区更新模式。
 *
 * @remarks
 * 宿主把多选语义统一为三种最小操作：
 * - `replace`：完全替换当前选区
 * - `add`：并入当前选区
 * - `remove`：从当前选区移除
 */
export type LeaferGraphSelectionUpdateMode = "replace" | "add" | "remove";

/**
 * 宿主对外暴露的节点 resize 约束。
 * 它已经把节点定义中的默认值、兼容字段和宿主默认值统一解析完成，
 * 适合 editor、命令层或调试工具直接读取。
 */
export interface LeaferGraphNodeResizeConstraint {
  enabled: boolean;
  lockRatio: boolean;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  snap?: number;
  defaultWidth: number;
  defaultHeight: number;
}

/**
 * 宿主对外暴露的最小交互活跃模式。
 *
 * @remarks
 * editor 只需要知道“当前是否存在会被整图 restore 打断的交互”，
 * 不需要感知拖拽节点集合或内部指针引用。
 */
export type LeaferGraphInteractionActivityMode =
  | "idle"
  | "node-drag"
  | "node-resize"
  | "link-connect"
  | "selection-box";

/**
 * 当前交互活跃态快照。
 *
 * @remarks
 * 这份快照专门服务 editor 的 authority 文档投影保护链，
 * 保持只读、最小且稳定。
 */
export interface LeaferGraphInteractionActivityState {
  active: boolean;
  mode: LeaferGraphInteractionActivityMode;
}

/**
 * 节点 IO 槽位的运行时值快照。
 *
 * @remarks
 * 右侧信息面板和未来调试面板都可以直接消费这份结构，
 * 不需要再自己把槽位定义和运行值数组重新拼接。
 */
export interface LeaferGraphNodeIoValueEntry {
  slot: number;
  name: string;
  label?: string;
  type?: SlotType;
  value: unknown;
}

/**
 * 宿主对外暴露的节点检查快照。
 */
export interface LeaferGraphNodeInspectorState {
  id: string;
  type: string;
  title: string;
  layout: NodeLayout;
  flags: NodeFlags;
  properties: Record<string, unknown>;
  data?: Record<string, unknown>;
  inputs: LeaferGraphNodeIoValueEntry[];
  outputs: LeaferGraphNodeIoValueEntry[];
  executionState: LeaferGraphNodeExecutionState;
}

export type LeaferGraphNodeStateChangeReason =
  | "created"
  | "updated"
  | "removed"
  | "moved"
  | "resized"
  | "collapsed"
  | "connections"
  | "widget-value"
  | "widget-action"
  | "input-values"
  | "execution";

export interface LeaferGraphNodeStateChangeEvent {
  nodeId: string;
  exists: boolean;
  reason: LeaferGraphNodeStateChangeReason;
  timestamp: number;
}

export interface LeaferGraphConnectionPortState {
  nodeId: string;
  direction: SlotDirection;
  slot: number;
  center: {
    x: number;
    y: number;
  };
  hitBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  slotType?: SlotType;
}

export interface LeaferGraphConnectionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface LeaferGraphCreateLinkInput
  extends Omit<GraphLink, "id"> {
  id?: string;
}

export type GraphOperationSource = string;

export interface GraphOperationBase {
  operationId: string;
  timestamp: number;
  source: GraphOperationSource;
}

export interface GraphNodeCreateOperation extends GraphOperationBase {
  type: "node.create";
  input: LeaferGraphCreateNodeInput;
}

export interface GraphNodeUpdateOperation extends GraphOperationBase {
  type: "node.update";
  nodeId: string;
  input: LeaferGraphUpdateNodeInput;
}

export interface GraphNodeMoveOperation extends GraphOperationBase {
  type: "node.move";
  nodeId: string;
  input: LeaferGraphMoveNodeInput;
}

export interface GraphNodeResizeOperation extends GraphOperationBase {
  type: "node.resize";
  nodeId: string;
  input: LeaferGraphResizeNodeInput;
}

export interface GraphNodeRemoveOperation extends GraphOperationBase {
  type: "node.remove";
  nodeId: string;
}

export interface GraphDocumentUpdateOperation extends GraphOperationBase {
  type: "document.update";
  input: LeaferGraphUpdateDocumentInput;
}

export interface GraphLinkCreateOperation extends GraphOperationBase {
  type: "link.create";
  input: LeaferGraphCreateLinkInput;
}

export interface GraphLinkRemoveOperation extends GraphOperationBase {
  type: "link.remove";
  linkId: string;
}

export interface GraphLinkReconnectOperation extends GraphOperationBase {
  type: "link.reconnect";
  linkId: string;
  input: {
    source?: GraphLinkEndpoint;
    target?: GraphLinkEndpoint;
  };
}

export type GraphOperation =
  | GraphDocumentUpdateOperation
  | GraphNodeCreateOperation
  | GraphNodeUpdateOperation
  | GraphNodeMoveOperation
  | GraphNodeResizeOperation
  | GraphNodeRemoveOperation
  | GraphLinkCreateOperation
  | GraphLinkRemoveOperation
  | GraphLinkReconnectOperation;

export interface GraphOperationApplyResult {
  accepted: boolean;
  changed: boolean;
  operation: GraphOperation;
  affectedNodeIds: string[];
  affectedLinkIds: string[];
  reason?: string;
}

export type LeaferGraphHistoryRecordKind = "operation" | "snapshot";

export interface LeaferGraphHistoryRecordBase {
  recordId: string;
  timestamp: number;
  source: string;
  label?: string;
}

export interface LeaferGraphOperationHistoryRecord
  extends LeaferGraphHistoryRecordBase {
  kind: "operation";
  undoOperations: GraphOperation[];
  redoOperations: GraphOperation[];
}

export interface LeaferGraphSnapshotHistoryRecord
  extends LeaferGraphHistoryRecordBase {
  kind: "snapshot";
  beforeDocument: GraphDocument;
  afterDocument: GraphDocument;
}

export type LeaferGraphHistoryRecord =
  | LeaferGraphOperationHistoryRecord
  | LeaferGraphSnapshotHistoryRecord;

export type LeaferGraphHistoryResetReason =
  | "replace-document"
  | "apply-document-diff";

export interface LeaferGraphHistoryRecordEvent {
  type: "history.record";
  record: LeaferGraphHistoryRecord;
}

export interface LeaferGraphHistoryResetEvent {
  type: "history.reset";
  timestamp: number;
  reason: LeaferGraphHistoryResetReason;
}

export type LeaferGraphHistoryEvent =
  | LeaferGraphHistoryRecordEvent
  | LeaferGraphHistoryResetEvent;

export interface LeaferGraphNodeMoveCommitEntry {
  nodeId: string;
  before: {
    x: number;
    y: number;
  };
  after: {
    x: number;
    y: number;
  };
}

export interface NodeMoveInteractionCommitEvent {
  type: "node.move.commit";
  entries: LeaferGraphNodeMoveCommitEntry[];
}

export interface NodeResizeInteractionCommitEvent {
  type: "node.resize.commit";
  nodeId: string;
  before: {
    width: number;
    height: number;
  };
  after: {
    width: number;
    height: number;
  };
}

export interface NodeCollapseInteractionCommitEvent {
  type: "node.collapse.commit";
  nodeId: string;
  beforeCollapsed: boolean;
  afterCollapsed: boolean;
}

export interface NodeWidgetInteractionCommitEvent {
  type: "node.widget.commit";
  nodeId: string;
  widgetIndex: number;
  beforeValue: unknown;
  afterValue: unknown;
  beforeWidgets: NodeRuntimeState["widgets"];
  afterWidgets: NodeRuntimeState["widgets"];
}

export interface LinkCreateInteractionCommitEvent {
  type: "link.create.commit";
  input: LeaferGraphCreateLinkInput;
}

/**
 * 宿主对外暴露的交互提交事件。
 *
 * @remarks
 * 这组事件专门服务 editor 把“本地预览已结束”的交互
 * 统一转成正式 `GraphOperation` 并提交到 authority。
 */
export type LeaferGraphInteractionCommitEvent =
  | NodeMoveInteractionCommitEvent
  | NodeResizeInteractionCommitEvent
  | NodeCollapseInteractionCommitEvent
  | NodeWidgetInteractionCommitEvent
  | LinkCreateInteractionCommitEvent;

/** 节点状态反馈事件。 */
export interface NodeStateRuntimeFeedbackEvent {
  type: "node.state";
  event: LeaferGraphNodeStateChangeEvent;
}

/**
 * 统一运行反馈事件。
 *
 * @remarks
 * UI 和未来外部 runtime 桥接应优先消费这组事件，
 * 而不是直接耦合到本地执行器内部宿主。
 */
export type RuntimeFeedbackEvent =
  | ExecutionFeedbackEvent
  | NodeStateRuntimeFeedbackEvent;

/**
 * 运行时反馈接入口。
 *
 * @remarks
 * 当前阶段只要求支持订阅统一反馈事件；
 * 是否具备外部 runtime 控制能力留到后续 adapter 层再展开。
 */
export interface RuntimeAdapter {
  subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void;
  destroy?(): void;
}

export type NodeExecutionRuntimeFeedbackEvent = NodeExecutionFeedbackEvent;
export type GraphExecutionRuntimeFeedbackEvent = GraphExecutionFeedbackEvent;
export type LinkPropagationRuntimeFeedbackEvent = LinkPropagationFeedbackEvent;
