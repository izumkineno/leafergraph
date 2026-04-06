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

/**
 * 节点运行时状态变化原因。
 *
 * @remarks
 * 这组值描述的是“为什么要通知宿主重新感知该节点状态”，
 * 不直接等同于某个具体生命周期钩子名称。
 */
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

/**
 * 节点状态变化事件。
 */
export interface LeaferGraphNodeStateChangeEvent {
  /** 目标节点 ID。 */
  nodeId: string;
  /** 当前事件发出时节点是否仍存在。 */
  exists: boolean;
  /** 状态变化原因。 */
  reason: LeaferGraphNodeStateChangeReason;
  /** 事件时间戳。 */
  timestamp: number;
}

/**
 * 连接预览和命中检测使用的端口快照。
 */
export interface LeaferGraphConnectionPortState {
  /** 所属节点 ID。 */
  nodeId: string;
  /** 端口方向。 */
  direction: SlotDirection;
  /** 端口索引。 */
  slot: number;
  /** 端口中心点。 */
  center: {
    /** 中心点 X。 */
    x: number;
    /** 中心点 Y。 */
    y: number;
  };
  /** 端口命中热区。 */
  hitBounds: {
    /** 热区左上角 X。 */
    x: number;
    /** 热区左上角 Y。 */
    y: number;
    /** 热区宽度。 */
    width: number;
    /** 热区高度。 */
    height: number;
  };
  /** 端口槽位类型。 */
  slotType?: SlotType;
}

/**
 * 连线可创建性校验结果。
 */
export interface LeaferGraphConnectionValidationResult {
  /** 当前连线是否可创建。 */
  valid: boolean;
  /** 不可创建时的原因说明。 */
  reason?: string;
}

/**
 * 宿主创建连线时使用的输入结构。
 */
export interface LeaferGraphCreateLinkInput
  extends Omit<GraphLink, "id"> {
  /** 连线 ID；未提供时由宿主生成。 */
  id?: string;
}

/** 正式图操作来源标识。 */
export type GraphOperationSource = string;

/**
 * 正式图操作的公共基类。
 */
export interface GraphOperationBase {
  /** 操作自身的稳定 ID。 */
  operationId: string;
  /** 操作创建时间戳。 */
  timestamp: number;
  /** 操作来源。 */
  source: GraphOperationSource;
}

/** 节点创建操作。 */
export interface GraphNodeCreateOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "node.create";
  /** 创建输入。 */
  input: LeaferGraphCreateNodeInput;
}

/** 节点更新操作。 */
export interface GraphNodeUpdateOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "node.update";
  /** 目标节点 ID。 */
  nodeId: string;
  /** 更新输入。 */
  input: LeaferGraphUpdateNodeInput;
}

/** 节点移动操作。 */
export interface GraphNodeMoveOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "node.move";
  /** 目标节点 ID。 */
  nodeId: string;
  /** 移动输入。 */
  input: LeaferGraphMoveNodeInput;
}

/** 节点 resize 操作。 */
export interface GraphNodeResizeOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "node.resize";
  /** 目标节点 ID。 */
  nodeId: string;
  /** resize 输入。 */
  input: LeaferGraphResizeNodeInput;
}

/** 节点删除操作。 */
export interface GraphNodeRemoveOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "node.remove";
  /** 目标节点 ID。 */
  nodeId: string;
}

/** 文档根字段更新操作。 */
export interface GraphDocumentUpdateOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "document.update";
  /** 文档更新输入。 */
  input: LeaferGraphUpdateDocumentInput;
}

/** 连线创建操作。 */
export interface GraphLinkCreateOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "link.create";
  /** 连线创建输入。 */
  input: LeaferGraphCreateLinkInput;
}

/** 连线删除操作。 */
export interface GraphLinkRemoveOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "link.remove";
  /** 目标连线 ID。 */
  linkId: string;
}

/** 连线重连操作。 */
export interface GraphLinkReconnectOperation extends GraphOperationBase {
  /** 操作类型。 */
  type: "link.reconnect";
  /** 目标连线 ID。 */
  linkId: string;
  /** 连线端点补丁输入。 */
  input: {
    /** 可选新的起点。 */
    source?: GraphLinkEndpoint;
    /** 可选新的终点。 */
    target?: GraphLinkEndpoint;
  };
}

/** 正式图操作联合类型。 */
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

/**
 * 应用正式图操作后的结果。
 */
export interface GraphOperationApplyResult {
  /** 当前操作是否被宿主接受。 */
  accepted: boolean;
  /** 当前操作是否实际修改了图状态。 */
  changed: boolean;
  /** 原始操作对象。 */
  operation: GraphOperation;
  /** 受影响节点 ID 列表。 */
  affectedNodeIds: string[];
  /** 受影响连线 ID 列表。 */
  affectedLinkIds: string[];
  /** 拒绝或无变化时的原因。 */
  reason?: string;
}

/** 历史记录种类。 */
export type LeaferGraphHistoryRecordKind = "operation" | "snapshot";

/**
 * 历史记录公共基类。
 */
export interface LeaferGraphHistoryRecordBase {
  /** 记录自身的稳定 ID。 */
  recordId: string;
  /** 记录时间戳。 */
  timestamp: number;
  /** 记录来源。 */
  source: string;
  /** 可选标签。 */
  label?: string;
}

/** 基于正式图操作的历史记录。 */
export interface LeaferGraphOperationHistoryRecord
  extends LeaferGraphHistoryRecordBase {
  /** 记录类型。 */
  kind: "operation";
  /** 撤销时要应用的操作列表。 */
  undoOperations: GraphOperation[];
  /** 重做时要应用的操作列表。 */
  redoOperations: GraphOperation[];
}

/** 基于整图快照的历史记录。 */
export interface LeaferGraphSnapshotHistoryRecord
  extends LeaferGraphHistoryRecordBase {
  /** 记录类型。 */
  kind: "snapshot";
  /** 变更前文档。 */
  beforeDocument: GraphDocument;
  /** 变更后文档。 */
  afterDocument: GraphDocument;
}

/** 历史记录联合类型。 */
export type LeaferGraphHistoryRecord =
  | LeaferGraphOperationHistoryRecord
  | LeaferGraphSnapshotHistoryRecord;

/** 历史重置原因。 */
export type LeaferGraphHistoryResetReason =
  | "replace-document"
  | "apply-document-diff";

/** 历史记录事件。 */
export interface LeaferGraphHistoryRecordEvent {
  /** 事件类型。 */
  type: "history.record";
  /** 历史记录正文。 */
  record: LeaferGraphHistoryRecord;
}

/** 历史重置事件。 */
export interface LeaferGraphHistoryResetEvent {
  /** 事件类型。 */
  type: "history.reset";
  /** 重置事件时间戳。 */
  timestamp: number;
  /** 历史重置原因。 */
  reason: LeaferGraphHistoryResetReason;
}

/** 历史事件联合类型。 */
export type LeaferGraphHistoryEvent =
  | LeaferGraphHistoryRecordEvent
  | LeaferGraphHistoryResetEvent;

/** 单个节点移动提交条目。 */
export interface LeaferGraphNodeMoveCommitEntry {
  /** 目标节点 ID。 */
  nodeId: string;
  /** 移动前位置。 */
  before: {
    /** 移动前 X。 */
    x: number;
    /** 移动前 Y。 */
    y: number;
  };
  /** 移动后位置。 */
  after: {
    /** 移动后 X。 */
    x: number;
    /** 移动后 Y。 */
    y: number;
  };
}

/** 节点移动提交事件。 */
export interface NodeMoveInteractionCommitEvent {
  /** 事件类型。 */
  type: "node.move.commit";
  /** 本次拖拽结束后提交的节点条目集合。 */
  entries: LeaferGraphNodeMoveCommitEntry[];
}

/** 节点 resize 提交事件。 */
export interface NodeResizeInteractionCommitEvent {
  /** 事件类型。 */
  type: "node.resize.commit";
  /** 目标节点 ID。 */
  nodeId: string;
  /** resize 前尺寸。 */
  before: {
    /** resize 前宽度。 */
    width: number;
    /** resize 前高度。 */
    height: number;
  };
  /** resize 后尺寸。 */
  after: {
    /** resize 后宽度。 */
    width: number;
    /** resize 后高度。 */
    height: number;
  };
}

/** 节点折叠状态提交事件。 */
export interface NodeCollapseInteractionCommitEvent {
  /** 事件类型。 */
  type: "node.collapse.commit";
  /** 目标节点 ID。 */
  nodeId: string;
  /** 折叠前状态。 */
  beforeCollapsed: boolean;
  /** 折叠后状态。 */
  afterCollapsed: boolean;
}

/** 节点 Widget 提交事件。 */
export interface NodeWidgetInteractionCommitEvent {
  /** 事件类型。 */
  type: "node.widget.commit";
  /** 目标节点 ID。 */
  nodeId: string;
  /** 目标 Widget 索引。 */
  widgetIndex: number;
  /** 提交前单值快照。 */
  beforeValue: unknown;
  /** 提交后单值快照。 */
  afterValue: unknown;
  /** 提交前全部 Widget 列表快照。 */
  beforeWidgets: NodeRuntimeState["widgets"];
  /** 提交后全部 Widget 列表快照。 */
  afterWidgets: NodeRuntimeState["widgets"];
}

/** 节点标题提交事件。 */
export interface NodeTitleInteractionCommitEvent {
  /** 事件类型。 */
  type: "node.title.commit";
  /** 目标节点 ID。 */
  nodeId: string;
  /** 提交前标题。 */
  beforeTitle: string;
  /** 提交后标题。 */
  afterTitle: string;
}

/** 连线创建提交事件。 */
export interface LinkCreateInteractionCommitEvent {
  /** 事件类型。 */
  type: "link.create.commit";
  /** 连线创建输入。 */
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
  | NodeTitleInteractionCommitEvent
  | NodeWidgetInteractionCommitEvent
  | LinkCreateInteractionCommitEvent;

/** 节点状态反馈事件。 */
export interface NodeStateRuntimeFeedbackEvent {
  /** 反馈事件固定类型。 */
  type: "node.state";
  /** 节点状态事件正文。 */
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
  /** 订阅统一运行反馈流。 */
  subscribe(listener: (event: RuntimeFeedbackEvent) => void): () => void;
  /** 释放适配器占用的外部资源。 */
  destroy?(): void;
}

/** 节点执行反馈事件别名。 */
export type NodeExecutionRuntimeFeedbackEvent = NodeExecutionFeedbackEvent;
/** 图执行反馈事件别名。 */
export type GraphExecutionRuntimeFeedbackEvent = GraphExecutionFeedbackEvent;
/** 连线传播反馈事件别名。 */
export type LinkPropagationRuntimeFeedbackEvent = LinkPropagationFeedbackEvent;
