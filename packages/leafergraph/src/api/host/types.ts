/**
 * `LeaferGraphApiHost` 内部类型定义。
 *
 * @remarks
 * 这一层负责承载 facade 子模块共享的最小上下文和视图壳面类型，
 * 避免各 helper 再次直接感知完整宿主实现。
 */

import type { App, Box, Group } from "leafer-ui";
import type {
  InstallNodeModuleOptions,
  GraphDocument,
  NodeDefinition,
  NodeModule,
  NodeSerializeResult,
  RegisterNodeOptions,
  RegisterWidgetOptions
} from "@leafergraph/node";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRenderInstance
} from "@leafergraph/contracts";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphHistoryRecord,
  LeaferGraphInteractionActivityState,
  RuntimeAdapter,
  LeaferGraphConnectionPortState,
  LeaferGraphLinkPropagationEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeExecutionState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphSelectionUpdateMode,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "@leafergraph/contracts";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";
import type { LeaferGraphBootstrapRuntimeLike } from "../../graph/host/bootstrap";
import type { LeaferGraphHistorySource } from "../../graph/history";
import type { LeaferGraphSceneRuntimeHost } from "../../graph/host/scene_runtime";
import type { LeaferGraphInteractionCommitSource } from "../../interaction/interaction_commit_source";

/**
 * 连线视图在公共 API 中暴露的最小交互对象。
 */
export interface LeaferGraphInteractionTargetLike {
  /** 交互对象名称；通常用于调试或事件过滤。 */
  name?: string;
  /** 父级交互对象。 */
  parent?: unknown | null;
  /** 订阅底层 Leafer 事件的入口。 */
  on_?: App["on_"];
  /** 取消订阅底层 Leafer 事件的入口。 */
  off_?: App["off_"];
}

/**
 * API facade 依赖的最小节点视图结构。
 */
export type LeaferGraphApiNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  /** 当前节点对应的可渲染运行时状态。 */
  state: TNodeState;
  /** 节点主视图容器。 */
  view: Group;
  /** 节点内部 Widget 专属图层。 */
  widgetLayer: Box;
  /** 当前节点已挂载的 Widget 渲染实例列表。 */
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
};

/**
 * API facade 依赖的最小连线视图结构。
 */
export type LeaferGraphApiLinkViewState = {
  /** 连线 ID。 */
  linkId: string;
  /** 连线在交互层暴露出来的最小视图对象。 */
  view: LeaferGraphInteractionTargetLike;
};

/**
 * 主包公共 API 所依赖的最小运行时壳面。
 */
export interface LeaferGraphApiRuntime<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  /** 底层 Leafer App 壳面；当前只要求可销毁。 */
  app: {
    /** 销毁整个图应用。 */
    destroy(): void;
  };
  /** 图引导期装配出的 bootstrap runtime。 */
  bootstrapRuntime: LeaferGraphBootstrapRuntimeLike;
  /** 读取当前正式图文档。 */
  getGraphDocument(): GraphDocument;
  /** 宿主反馈与投影适配器。 */
  runtimeAdapter: RuntimeAdapter;
  /** Widget 编辑管理器。 */
  widgetEditingManager: {
    /** 销毁编辑管理器。 */
    destroy(): void;
  };
  /** 数据流动画宿主。 */
  dataFlowAnimationHost: {
    /** 销毁数据流动画宿主。 */
    destroy(): void;
  };
  /** 场景 runtime 提供的最小图操作能力集合。 */
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, LeaferGraphApiNodeViewState<TNodeState>>,
    | "setNodeWidgetValue"
    | "findLinksByNode"
    | "getLink"
    | "applyGraphOperation"
    | "createNode"
    | "removeNode"
    | "updateNode"
    | "moveNode"
    | "resizeNode"
    | "createLink"
    | "removeLink"
  >;
  /** 历史记录源。 */
  historySource: Pick<LeaferGraphHistorySource, "emit" | "subscribe" | "destroy">;
  /** 停止宿主侧历史捕获。 */
  destroyHistoryCapture(): void;
  /** 交互提交事件源。 */
  interactionCommitSource: Pick<
    LeaferGraphInteractionCommitSource,
    "subscribe"
  >;
  /** 用户交互宿主。 */
  interactionHost: {
    /** 获取当前交互活动状态。 */
    getInteractionActivityState(): LeaferGraphInteractionActivityState;
    /** 订阅交互活动状态。 */
    subscribeInteractionActivity(
      listener: (state: LeaferGraphInteractionActivityState) => void
    ): () => void;
    /** 销毁交互宿主。 */
    destroy(): void;
  };
  /** 连接创建相关的运行时。 */
  interactionRuntime: {
    /** 按节点 ID、方向和槽位解析端口。 */
    resolvePort(
      nodeId: string,
      direction: LeaferGraphConnectionPortState["direction"],
      slot: number
    ): LeaferGraphConnectionPortState | undefined;
    /** 按画布坐标解析命中的端口。 */
    resolvePortAtPoint(
      point: { x: number; y: number },
      direction: LeaferGraphConnectionPortState["direction"]
    ): LeaferGraphConnectionPortState | undefined;
    /** 设置当前连接预览的起点端口。 */
    setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void;
    /** 设置当前连接预览的候选目标端口。 */
    setConnectionCandidatePort(
      port: LeaferGraphConnectionPortState | null
    ): void;
    /** 刷新连接拖拽预览。 */
    setConnectionPreview(
      source: LeaferGraphConnectionPortState,
      pointer: { x: number; y: number },
      target?: LeaferGraphConnectionPortState
    ): void;
    /** 清空连接拖拽预览。 */
    clearConnectionPreview(): void;
    /** 校验是否允许创建一条新连线。 */
    canCreateLink(
      source: LeaferGraphConnectionPortState,
      target: LeaferGraphConnectionPortState
    ): LeaferGraphConnectionValidationResult;
  };
  /** 节点运行时宿主壳面。 */
  nodeRuntimeHost: {
    /** 获取节点当前快照。 */
    getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
    /** 获取节点检查面板状态。 */
    getNodeInspectorState(nodeId: string): LeaferGraphNodeInspectorState | undefined;
    /** 设置节点折叠状态。 */
    setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
    /** 获取节点 resize 约束。 */
    getNodeResizeConstraint(
      nodeId: string
    ): LeaferGraphNodeResizeConstraint | undefined;
    /** 获取节点执行状态。 */
    getNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined;
    /** 判断节点当前是否允许 resize。 */
    canResizeNode(nodeId: string): boolean;
    /** 将节点尺寸重置为默认值。 */
    resetNodeSize(nodeId: string): TNodeState | undefined;
    /** 以单节点为入口触发本地调试执行。 */
    playFromNode(nodeId: string, context?: unknown): boolean;
    /** 订阅节点状态变更事件。 */
    subscribeNodeState(
      listener: (event: LeaferGraphNodeStateChangeEvent) => void
    ): () => void;
    /** 订阅节点执行事件。 */
    subscribeNodeExecution(
      listener: (event: LeaferGraphNodeExecutionEvent) => void
    ): () => void;
    /** 把外部节点执行事件投影回宿主。 */
    projectExternalNodeExecution(
      event: LeaferGraphNodeExecutionEvent
    ): void;
    /** 把外部节点状态事件投影回宿主。 */
    projectExternalNodeState(
      event: LeaferGraphNodeStateChangeEvent
    ): void;
    /** 把外部连线传播事件投影回宿主。 */
    projectExternalLinkPropagation(
      event: LeaferGraphLinkPropagationEvent
    ): void;
  };
  /** 图级执行宿主壳面。 */
  graphExecutionHost: {
    /** 启动整图执行。 */
    play(): boolean;
    /** 执行一个图级步进。 */
    step(): boolean;
    /** 停止整图执行。 */
    stop(): boolean;
    /** 获取当前图执行状态。 */
    getGraphExecutionState(): LeaferGraphGraphExecutionState;
    /** 订阅图执行事件。 */
    subscribeGraphExecution(
      listener: (event: LeaferGraphGraphExecutionEvent) => void
    ): () => void;
    /** 把外部图执行事件投影回宿主。 */
    projectExternalGraphExecution(
      event: LeaferGraphGraphExecutionEvent
    ): void;
  };
  /** 主题宿主。 */
  themeHost: {
    /** 切换当前主题模式。 */
    setThemeMode(mode: LeaferGraphThemeMode): void;
  };
  /** 视图宿主。 */
  viewHost: {
    /** 让当前画布视图适配全部内容。 */
    fitView(padding: number): boolean;
    /** 设置单个节点选中态。 */
    setNodeSelected(nodeId: string, selected: boolean): boolean;
    /** 列出当前选中的节点 ID。 */
    listSelectedNodeIds(): string[];
    /** 判断某个节点是否选中。 */
    isNodeSelected(nodeId: string): boolean;
    /** 以指定模式更新选区。 */
    setSelectedNodeIds(
      nodeIds: readonly string[],
      mode?: LeaferGraphSelectionUpdateMode
    ): string[];
    /** 清空当前选区。 */
    clearSelectedNodes(): string[];
  };
  /** Widget 运行时宿主。 */
  widgetHost: {
    /** 销毁节点内已挂载的 Widget 实例和图层。 */
    destroyNodeWidgets(
      widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>,
      widgetLayer: Box
    ): void;
  };
}

/**
 * API facade 初始化时依赖的最小装配选项。
 */
export interface LeaferGraphApiHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  /** 已装配完成的宿主 runtime。 */
  runtime: LeaferGraphApiRuntime<TNodeState>;
  /** 当前节点视图表。 */
  nodeViews: Map<string, TNodeViewState>;
  /** 当前连线视图列表。 */
  linkViews: readonly TLinkViewState[];
}

/**
 * API 子模块共享的最小上下文。
 */
export interface LeaferGraphApiHostContext<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  /** 初始化时传入的统一选项。 */
  readonly options: LeaferGraphApiHostOptions<TNodeState, TNodeViewState, TLinkViewState>;
  /** 判断当前操作是否应进入历史系统。 */
  shouldCaptureHistory(): boolean;
  /** 为历史记录捕获当前图文档快照。 */
  captureDocumentBeforeHistory(): GraphDocument | null;
  /** 为历史记录捕获某个节点的快照。 */
  captureNodeSnapshotBeforeHistory(
    nodeId: string
  ): NodeSerializeResult | undefined;
  /** 为历史条目解析节点实际尺寸。 */
  resolveNodeSizeForHistory(
    nodeId: string,
    snapshot: NodeSerializeResult
  ): { width: number; height: number };
  /** 发出一条历史记录。 */
  emitHistoryRecord(record: LeaferGraphHistoryRecord | null): void;
  /** 在禁用历史捕获的上下文里执行一段逻辑。 */
  runWithoutHistoryCapture<T>(callback: () => T): T;
  /** 通知历史系统做一次重置。 */
  notifyHistoryReset(reason: LeaferGraphHistoryResetReason): void;
}

/**
 * API facade 可发出的历史重置原因。
 */
export type LeaferGraphHistoryResetReason =
  | "replace-document"
  | "apply-document-diff";

/**
 * API 初始化会透传的主包配置。
 */
export type LeaferGraphApiInitializeOptions = LeaferGraphOptions;

/**
 * API registry helper 暴露的节点插件输入。
 */
export type LeaferGraphApiPlugin = LeaferGraphNodePlugin;

/**
 * API registry helper 暴露的模块安装输入。
 */
export type LeaferGraphApiModuleInput = {
  /** 需要安装的节点模块。 */
  module: NodeModule;
  /** 模块安装控制项。 */
  options?: InstallNodeModuleOptions;
};

/**
 * API registry helper 暴露的节点注册输入。
 */
export type LeaferGraphApiNodeRegistration = {
  /** 需要注册的节点定义。 */
  definition: NodeDefinition;
  /** 节点注册控制项。 */
  options?: RegisterNodeOptions;
};

/**
 * API registry helper 暴露的 widget 注册输入。
 */
export type LeaferGraphApiWidgetRegistration = {
  /** 需要注册的 Widget 条目。 */
  entry: LeaferGraphWidgetEntry;
  /** Widget 注册控制项。 */
  options?: RegisterWidgetOptions;
};

/**
 * API mutation helper 暴露的正式图操作输入。
 */
export type LeaferGraphApiGraphOperation = GraphOperation;

/**
 * API mutation helper 返回的图操作结果。
 */
export type LeaferGraphApiGraphOperationResult = GraphOperationApplyResult;

/**
 * API mutation helper 暴露的节点创建输入。
 */
export type LeaferGraphApiCreateNodeInput = LeaferGraphCreateNodeInput;

/**
 * API mutation helper 暴露的节点更新输入。
 */
export type LeaferGraphApiUpdateNodeInput = LeaferGraphUpdateNodeInput;

/**
 * API mutation helper 暴露的节点移动输入。
 */
export type LeaferGraphApiMoveNodeInput = LeaferGraphMoveNodeInput;

/**
 * API mutation helper 暴露的节点 resize 输入。
 */
export type LeaferGraphApiResizeNodeInput = LeaferGraphResizeNodeInput;

/**
 * API mutation helper 暴露的连线创建输入。
 */
export type LeaferGraphApiCreateLinkInput = LeaferGraphCreateLinkInput;
