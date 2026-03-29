/**
 * 主包图 API 类型模块。
 *
 * @remarks
 * 负责定义节点创建、更新、移动、缩放和连线操作使用的公共输入类型。
 */

import type {
  AdapterBinding,
  CapabilityProfile,
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
import type { GraphNodeDisplayProperties } from "../graph/graph_runtime_types";

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
 * 主包允许的槽位输入结构。
 * 既兼容旧的字符串数组，也兼容正式 `NodeSlotSpec`。
 *
 * @remarks
 * 对外 API 仍然允许使用最轻量的字符串声明槽位名称，
 * 但进入运行时前都会被统一转换成正式槽位结构。
 */
export type LeaferGraphNodeSlotInput = string | NodeSlotSpec;

/**
 * 主包创建节点时使用的输入结构。
 * 这里保留 editor 友好的顶层 `x / y / width / height` 写法，
 * 但不再继承 demo 输入类型。
 *
 * @remarks
 * 这份输入专门服务主包对外的交互型 API，
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
 * 主包更新节点时使用的输入结构。
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
 * 主包更新文档根字段时使用的输入结构。
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
 * 主包移动节点时使用的位置结构。
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
 * 主包调整节点尺寸时使用的输入结构。
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
 * 主包把多选语义统一为三种最小操作：
 * - `replace`：完全替换当前选区
 * - `add`：并入当前选区
 * - `remove`：从当前选区移除
 */
export type LeaferGraphSelectionUpdateMode = "replace" | "add" | "remove";

/**
 * 主包对外暴露的节点 resize 约束。
 * 它已经把节点定义中的默认值、兼容字段和宿主默认值统一解析完成，
 * 适合 editor、命令层或调试工具直接读取。
 */
export interface LeaferGraphNodeResizeConstraint {
  /** 当前节点是否允许被 resize。 */
  enabled: boolean;
  /** 是否锁定宽高比。 */
  lockRatio: boolean;
  /** 允许的最小宽度。 */
  minWidth: number;
  /** 允许的最小高度。 */
  minHeight: number;
  /** 允许的最大宽度。 */
  maxWidth?: number;
  /** 允许的最大高度。 */
  maxHeight?: number;
  /** 吸附步长。 */
  snap?: number;
  /** 缺省宽度。 */
  defaultWidth: number;
  /** 缺省高度。 */
  defaultHeight: number;
}

/**
 * 主包对外暴露的最小交互活跃模式。
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
  /** 当前是否存在会被整图 restore 打断的活跃交互。 */
  active: boolean;
  /** 当前活跃交互模式；空闲时固定为 `idle`。 */
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
  /** 槽位索引。 */
  slot: number;
  /** 槽位名称。 */
  name: string;
  /** 槽位展示标签；缺失时宿主可回退到 `name`。 */
  label?: string;
  /** 槽位类型。 */
  type?: SlotType;
  /** 当前运行值。 */
  value: unknown;
}

/**
 * 主包对外暴露的节点检查快照。
 *
 * @remarks
 * 这份结构专门服务 editor 右侧信息面板：
 * - `properties / data` 反映节点当前内部数据
 * - `inputs / outputs` 反映当前运行时 IO 值
 * - `executionState` 反映当前执行状态
 */
export interface LeaferGraphNodeInspectorState {
  /** 节点 ID。 */
  id: string;
  /** 节点类型。 */
  type: string;
  /** 节点标题。 */
  title: string;
  /** 当前布局快照。 */
  layout: NodeLayout;
  /** 当前状态位。 */
  flags: NodeFlags;
  /** 节点业务属性。 */
  properties: Record<string, unknown>;
  /** 节点内部扩展数据。 */
  data?: Record<string, unknown>;
  /** 输入槽位运行值。 */
  inputs: LeaferGraphNodeIoValueEntry[];
  /** 输出槽位运行值。 */
  outputs: LeaferGraphNodeIoValueEntry[];
  /** 当前执行状态。 */
  executionState: LeaferGraphNodeExecutionState;
}

/**
 * 节点状态变化事件的最小原因枚举。
 *
 * @remarks
 * 这条协议专门服务 editor 检查面板和后续调试面板刷新：
 * - `widget-value` 表示节点内部 widget 值被正式写回
 * - `input-values` 表示上游传播导致输入运行值变化
 * - `execution` 表示节点执行状态、输出值或执行错误发生变化
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
 * 主包对外暴露的最小节点状态变化事件。
 *
 * @remarks
 * 这份事件不承载完整 diff，只表达：
 * 1. 哪个节点刚刚发生了对检查面板有意义的变化
 * 2. 当前节点是否仍然存在
 * 3. 变化属于哪一类原因
 *
 * 外部消费方可以在收到事件后自行重新读取
 * `getNodeInspectorState(...)` 或 `getNodeSnapshot(...)`。
 */
export interface LeaferGraphNodeStateChangeEvent {
  /** 发生变化的节点 ID。 */
  nodeId: string;
  /** 节点是否仍然存在于当前图状态中。 */
  exists: boolean;
  /** 变化原因。 */
  reason: LeaferGraphNodeStateChangeReason;
  /** 事件发出时的时间戳。 */
  timestamp: number;
}

/**
 * 主包对外暴露的连接端口几何状态。
 *
 * @remarks
 * 这份结构统一承载端口方向、槽位索引、中心点和命中区域，
 * 供 editor 的最小自由连线、重连预览和未来合法性提示复用。
 */
export interface LeaferGraphConnectionPortState {
  /** 端口所属节点 ID。 */
  nodeId: string;
  /** 端口方向。 */
  direction: SlotDirection;
  /** 端口槽位索引。 */
  slot: number;
  /** 端口中心点，使用主包 page 坐标系。 */
  center: {
    x: number;
    y: number;
  };
  /** 端口命中热区，使用主包 page 坐标系。 */
  hitBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 端口类型；缺失时视为通配。 */
  slotType?: SlotType;
}

/**
 * 主包对外暴露的最小连接校验结果。
 *
 * @remarks
 * 第一版先只返回 `valid + reason`，
 * 让 editor 可以在不感知内部校验细节的前提下做最小反馈和交互分支。
 */
export interface LeaferGraphConnectionValidationResult {
  /** 当前两个端口是否允许建立正式连线。 */
  valid: boolean;
  /** 不合法时的最小原因说明。 */
  reason?: string;
}

/**
 * 主包创建连线时使用的输入结构。
 * 当前阶段允许省略连线 ID，由宿主生成稳定可读的默认值。
 *
 * @remarks
 * 一旦进入运行时，连线输入会被浅拷贝并规范化，避免外部直接共享内部状态引用。
 */
export interface LeaferGraphCreateLinkInput
  extends Omit<GraphLink, "id"> {
  /** 连线 ID；未提供时由主包自动生成。 */
  id?: string;
}

/**
 * 正式图操作的公共来源。
 *
 * @remarks
 * 当前阶段不强行限制来源枚举，避免 editor、history、未来后端桥接各自再维护一套兼容层。
 */
export type GraphOperationSource = string;

/**
 * 正式图操作公共基类。
 *
 * @remarks
 * 所有操作都必须带稳定 ID、时间戳和来源，
 * 方便后续接入后端确认、回放与运行审计。
 */
export interface GraphOperationBase {
  /** 操作唯一 ID。 */
  operationId: string;
  /** 操作产生时间。 */
  timestamp: number;
  /** 操作来源。 */
  source: GraphOperationSource;
}

/** 创建节点操作。 */
export interface GraphNodeCreateOperation extends GraphOperationBase {
  type: "node.create";
  input: LeaferGraphCreateNodeInput;
}

/** 更新节点操作。 */
export interface GraphNodeUpdateOperation extends GraphOperationBase {
  type: "node.update";
  nodeId: string;
  input: LeaferGraphUpdateNodeInput;
}

/** 移动节点操作。 */
export interface GraphNodeMoveOperation extends GraphOperationBase {
  type: "node.move";
  nodeId: string;
  input: LeaferGraphMoveNodeInput;
}

/** 调整节点尺寸操作。 */
export interface GraphNodeResizeOperation extends GraphOperationBase {
  type: "node.resize";
  nodeId: string;
  input: LeaferGraphResizeNodeInput;
}

/** 删除节点操作。 */
export interface GraphNodeRemoveOperation extends GraphOperationBase {
  type: "node.remove";
  nodeId: string;
}

/** 更新文档根字段操作。 */
export interface GraphDocumentUpdateOperation extends GraphOperationBase {
  type: "document.update";
  input: LeaferGraphUpdateDocumentInput;
}

/** 创建连线操作。 */
export interface GraphLinkCreateOperation extends GraphOperationBase {
  type: "link.create";
  input: LeaferGraphCreateLinkInput;
}

/** 删除连线操作。 */
export interface GraphLinkRemoveOperation extends GraphOperationBase {
  type: "link.remove";
  linkId: string;
}

/** 重连连线操作。 */
export interface GraphLinkReconnectOperation extends GraphOperationBase {
  type: "link.reconnect";
  linkId: string;
  input: {
    source?: GraphLinkEndpoint;
    target?: GraphLinkEndpoint;
  };
}

/**
 * 主包当前阶段支持的正式图操作集合。
 */
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
 * 操作应用结果。
 *
 * @remarks
 * `accepted` 表达操作是否进入正式应用路径，
 * `changed` 表达是否真的产生状态变化。
 */
export interface GraphOperationApplyResult {
  /** 当前操作是否被接受。 */
  accepted: boolean;
  /** 当前操作是否真的改动了图状态。 */
  changed: boolean;
  /** 已被处理的正式操作。 */
  operation: GraphOperation;
  /** 本次操作影响到的节点 ID。 */
  affectedNodeIds: string[];
  /** 本次操作影响到的连线 ID。 */
  affectedLinkIds: string[];
  /** 未接受或无变化时的原因。 */
  reason?: string;
}

/** 一次节点移动提交里单个节点的前后位置快照。 */
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

/** 一次节点拖拽结束后的正式提交事件。 */
export interface NodeMoveInteractionCommitEvent {
  type: "node.move.commit";
  entries: LeaferGraphNodeMoveCommitEntry[];
}

/** 一次节点 resize 结束后的正式提交事件。 */
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

/** 一次节点折叠切换后的正式提交事件。 */
export interface NodeCollapseInteractionCommitEvent {
  type: "node.collapse.commit";
  nodeId: string;
  beforeCollapsed: boolean;
  afterCollapsed: boolean;
}

/** 一次节点 Widget 提交后的正式文档变更事件。 */
export interface NodeWidgetInteractionCommitEvent {
  type: "node.widget.commit";
  nodeId: string;
  widgetIndex: number;
  beforeValue: unknown;
  afterValue: unknown;
  beforeWidgets: NodeRuntimeState["widgets"];
  afterWidgets: NodeRuntimeState["widgets"];
}

/** 一次拖线创建完成后的正式连线提交事件。 */
export interface LinkCreateInteractionCommitEvent {
  type: "link.create.commit";
  input: LeaferGraphCreateLinkInput;
}

/**
 * 主包对外暴露的交互提交事件。
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
