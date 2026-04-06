/**
 * 主包公共 API 宿主模块。
 *
 * @remarks
 * 负责把内部运行时壳面收敛成对外可调用的图、节点、连线和主题接口。
 */

import type { Group } from "leafer-ui";
import type {
  InstallNodeModuleOptions,
  GraphDocument,
  GraphLink,
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
  LeaferGraphInteractionActivityState,
  LeaferGraphGraphExecutionState,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeExecutionState,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  RuntimeFeedbackEvent,
  LeaferGraphHistoryEvent,
  LeaferGraphInteractionCommitEvent,
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphSelectionUpdateMode,
  LeaferGraphConnectionPortState,
  LeaferGraphConnectionValidationResult,
  LeaferGraphCreateNodeInput,
  LeaferGraphUpdateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphCreateLinkInput,
  LeaferGraphHistoryRecord
} from "@leafergraph/contracts";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import {
  applyLeaferGraphApiGraphOperation,
  findLeaferGraphApiLinksByNode,
  getLeaferGraphApiLink,
  replaceLeaferGraphApiDocument
} from "./document";
import {
  canLeaferGraphApiResizeNode,
  getLeaferGraphApiGraphExecutionState,
  getLeaferGraphApiInteractionActivityState,
  getLeaferGraphApiNodeExecutionState,
  getLeaferGraphApiNodeResizeConstraint,
  playLeaferGraphApiFromNode,
  playLeaferGraphApiGraph,
  resetLeaferGraphApiNodeSize,
  stepLeaferGraphApiGraph,
  stopLeaferGraphApiGraph
} from "./execution";
import { destroyLeaferGraphApiHost, initializeLeaferGraphApiHost } from "./lifecycle";
import {
  createLeaferGraphApiLink,
  createLeaferGraphApiNode,
  moveLeaferGraphApiNode,
  removeLeaferGraphApiLink,
  removeLeaferGraphApiNode,
  resizeLeaferGraphApiNode,
  setLeaferGraphApiNodeCollapsed,
  setLeaferGraphApiNodeWidgetValue,
  updateLeaferGraphApiNode
} from "./mutations";
import {
  getLeaferGraphApiWidget,
  installLeaferGraphApiModule,
  listLeaferGraphApiNodes,
  listLeaferGraphApiWidgets,
  registerLeaferGraphApiNode,
  registerLeaferGraphApiWidget,
  useLeaferGraphApiPlugin
} from "./registry";
import {
  projectLeaferGraphApiRuntimeFeedback,
  subscribeLeaferGraphApiGraphExecution,
  subscribeLeaferGraphApiHistory,
  subscribeLeaferGraphApiInteractionActivity,
  subscribeLeaferGraphApiInteractionCommit,
  subscribeLeaferGraphApiNodeExecution,
  subscribeLeaferGraphApiNodeState,
  subscribeLeaferGraphApiRuntimeFeedback
} from "./subscriptions";
import type {
  LeaferGraphApiHostContext,
  LeaferGraphApiHostOptions,
  LeaferGraphApiLinkViewState,
  LeaferGraphApiNodeViewState,
  LeaferGraphHistoryResetReason,
  LeaferGraphInteractionTargetLike
} from "./types";
import {
  clearLeaferGraphApiSelectedNodes,
  fitLeaferGraphApiView,
  getLeaferGraphApiLinkView,
  getLeaferGraphApiNodeInspectorState,
  getLeaferGraphApiNodeSnapshot,
  getLeaferGraphApiNodeView,
  isLeaferGraphApiNodeSelected,
  listLeaferGraphApiSelectedNodeIds,
  setLeaferGraphApiNodeSelected,
  setLeaferGraphApiSelectedNodeIds,
  setLeaferGraphApiThemeMode
} from "./view";
import {
  canLeaferGraphApiCreateConnection,
  clearLeaferGraphApiConnectionPreview,
  resolveLeaferGraphApiConnectionPort,
  resolveLeaferGraphApiConnectionPortAtPoint,
  setLeaferGraphApiConnectionCandidatePort,
  setLeaferGraphApiConnectionPreview,
  setLeaferGraphApiConnectionSourcePort
} from "./connection";
import { createHistoryRecordEvent, createHistoryResetEvent } from "../../graph/history";
import type { LeaferGraphRenderableNodeState } from "../../graph/types";

/**
 * 主包公共 API facade。
 *
 * @remarks
 * 当前集中承接：
 * 1. 插件、节点与 Widget 注册相关公共入口
 * 2. 视图控制、主题控制与节点快照查询
 * 3. 节点/连线正式变更 API
 * 4. 宿主销毁时的统一清理顺序
 */
export class LeaferGraphApiHostController<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  private historyCaptureSuppressionDepth = 0;
  private readonly options: LeaferGraphApiHostOptions<
    TNodeState,
    TNodeViewState,
    TLinkViewState
  >;
  private readonly context: LeaferGraphApiHostContext<
    TNodeState,
    TNodeViewState,
    TLinkViewState
  >;

  /**
   * 初始化 LeaferGraphApiHost 实例。
   *
   * @param options - API 宿主装配选项。
   * @returns 无返回值。
   */
  constructor(
    options: LeaferGraphApiHostOptions<TNodeState, TNodeViewState, TLinkViewState>
  ) {
    this.options = options;
    this.context = {
      get options() {
        return options;
      },
      shouldCaptureHistory: () => this.shouldCaptureHistory(),
      captureDocumentBeforeHistory: () => this.captureDocumentBeforeHistory(),
      captureNodeSnapshotBeforeHistory: (nodeId) =>
        this.captureNodeSnapshotBeforeHistory(nodeId),
      resolveNodeSizeForHistory: (nodeId, snapshot) =>
        this.resolveNodeSizeForHistory(nodeId, snapshot),
      emitHistoryRecord: (record) => this.emitHistoryRecord(record),
      runWithoutHistoryCapture: (callback) => this.runWithoutHistoryCapture(callback),
      notifyHistoryReset: (reason) => this.notifyHistoryReset(reason)
    };
  }

  /**
   * 执行启动期安装流程并恢复初始图数据。
   *
   * @param options - 主包初始化配置。
   * @returns 启动完成后的异步结果。
   */
  initialize(options: LeaferGraphOptions): Promise<void> {
    return initializeLeaferGraphApiHost(this.context, options);
  }

  /**
   * 销毁宿主实例，并清理全部全局事件与 widget 生命周期。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    destroyLeaferGraphApiHost(this.context);
  }

  /**
   * 安装一个外部节点插件。
   *
   * @param plugin - 需要安装的节点插件。
   * @returns 插件安装完成后的异步结果。
   */
  async use(plugin: LeaferGraphNodePlugin): Promise<void> {
    return useLeaferGraphApiPlugin(this.context, plugin);
  }

  /**
   * 安装一个静态节点模块。
   *
   * @param module - 需要安装的节点模块。
   * @param options - 模块安装选项。
   * @returns 无返回值。
   */
  installModule(module: NodeModule, options?: InstallNodeModuleOptions): void {
    installLeaferGraphApiModule(this.context, { module, options });
  }

  /**
   * 注册单个节点定义。
   *
   * @param definition - 节点定义。
   * @param options - 节点注册选项。
   * @returns 无返回值。
   */
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    registerLeaferGraphApiNode(this.context, { definition, options });
  }

  /**
   * 注册单个完整 widget 条目。
   *
   * @param entry - widget 条目。
   * @param options - widget 注册选项。
   * @returns 无返回值。
   */
  registerWidget(entry: LeaferGraphWidgetEntry, options?: RegisterWidgetOptions): void {
    registerLeaferGraphApiWidget(this.context, { entry, options });
  }

  /**
   * 读取单个 widget 条目。
   *
   * @param type - widget 类型。
   * @returns 匹配到的 widget 条目。
   */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return getLeaferGraphApiWidget(this.context, type);
  }

  /**
   * 列出当前已注册 widget。
   *
   * @returns 当前已注册的 widget 列表。
   */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return listLeaferGraphApiWidgets(this.context);
  }

  /**
   * 直接替换当前正式文档。
   *
   * @param document - 需要替换进去的正式文档。
   * @returns 无返回值。
   */
  replaceGraphDocument(document: GraphDocument): void {
    replaceLeaferGraphApiDocument(this.context, document);
  }

  /**
   * 运行时切换主包主题，并局部刷新现有节点壳与 widget。
   *
   * @param mode - 目标主题模式。
   * @returns 无返回值。
   */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    setLeaferGraphApiThemeMode(this.context, mode);
  }

  /**
   * 列出当前已注册节点。
   *
   * @returns 当前已注册的节点定义列表。
   */
  listNodes(): NodeDefinition[] {
    return listLeaferGraphApiNodes(this.context);
  }

  /**
   * 获取某个节点对应的 Leafer 视图宿主。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点视图宿主。
   */
  getNodeView(nodeId: string): Group | undefined {
    return getLeaferGraphApiNodeView(this.context, nodeId);
  }

  /**
   * 获取某条连线对应的 Leafer 视图宿主。
   *
   * @param linkId - 目标连线 ID。
   * @returns 连线视图宿主。
   */
  getLinkView(linkId: string): LeaferGraphInteractionTargetLike | undefined {
    return getLeaferGraphApiLinkView(this.context, linkId);
  }

  /**
   * 让当前画布内容适配到可视区域内。
   *
   * @param padding - 适配时使用的内边距。
   * @returns 是否成功执行适配。
   */
  fitView(padding: number): boolean {
    return fitLeaferGraphApiView(this.context, padding);
  }

  /**
   * 读取一个正式可序列化节点快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点快照。
   */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    return getLeaferGraphApiNodeSnapshot(this.context, nodeId);
  }

  /**
   * 读取一个节点当前的检查快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点检查快照。
   */
  getNodeInspectorState(
    nodeId: string
  ): LeaferGraphNodeInspectorState | undefined {
    return getLeaferGraphApiNodeInspectorState(this.context, nodeId);
  }

  /**
   * 设置单个节点的选中态。
   *
   * @param nodeId - 目标节点 ID。
   * @param selected - 目标选中状态。
   * @returns 是否成功更新选中态。
   */
  setNodeSelected(nodeId: string, selected: boolean): boolean {
    return setLeaferGraphApiNodeSelected(this.context, nodeId, selected);
  }

  /**
   * 列出当前全部已选节点。
   *
   * @returns 当前选区中的节点 ID 列表。
   */
  listSelectedNodeIds(): string[] {
    return listLeaferGraphApiSelectedNodeIds(this.context);
  }

  /**
   * 判断单个节点当前是否处于选中态。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否已被选中。
   */
  isNodeSelected(nodeId: string): boolean {
    return isLeaferGraphApiNodeSelected(this.context, nodeId);
  }

  /**
   * 批量更新当前节点选区。
   *
   * @param nodeIds - 需要写入的节点 ID 列表。
   * @param mode - 选区更新模式。
   * @returns 更新后的节点 ID 列表。
   */
  setSelectedNodeIds(
    nodeIds: readonly string[],
    mode?: LeaferGraphSelectionUpdateMode
  ): string[] {
    return setLeaferGraphApiSelectedNodeIds(this.context, nodeIds, mode);
  }

  /**
   * 清空当前节点选区。
   *
   * @returns 清空后的节点 ID 列表。
   */
  clearSelectedNodes(): string[] {
    return clearLeaferGraphApiSelectedNodes(this.context);
  }

  /**
   * 设置单个节点的折叠态。
   *
   * @param nodeId - 目标节点 ID。
   * @param collapsed - 目标折叠状态。
   * @returns 是否成功更新折叠态。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    return setLeaferGraphApiNodeCollapsed(this.context, nodeId, collapsed);
  }

  /**
   * 读取某个节点的正式 resize 约束。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点 resize 约束。
   */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    return getLeaferGraphApiNodeResizeConstraint(this.context, nodeId);
  }

  /**
   * 读取某个节点当前的最小执行反馈快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 节点执行反馈快照。
   */
  getNodeExecutionState(
    nodeId: string
  ): LeaferGraphNodeExecutionState | undefined {
    return getLeaferGraphApiNodeExecutionState(this.context, nodeId);
  }

  /**
   * 读取当前图级执行状态。
   *
   * @returns 当前图级执行状态。
   */
  getGraphExecutionState(): LeaferGraphGraphExecutionState {
    return getLeaferGraphApiGraphExecutionState(this.context);
  }

  /**
   * 读取当前最小交互活跃态快照。
   *
   * @returns 当前交互活跃态快照。
   */
  getInteractionActivityState(): LeaferGraphInteractionActivityState {
    return getLeaferGraphApiInteractionActivityState(this.context);
  }

  /**
   * 判断某个节点当前是否允许显示并响应 resize 交互。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点是否允许 resize。
   */
  canResizeNode(nodeId: string): boolean {
    return canLeaferGraphApiResizeNode(this.context, nodeId);
  }

  /**
   * 把节点尺寸恢复到定义默认值。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 重置后的节点运行时状态。
   */
  resetNodeSize(nodeId: string): TNodeState | undefined {
    return resetLeaferGraphApiNodeSize(this.context, nodeId);
  }

  /**
   * 从指定节点开始运行一条正式执行链。
   *
   * @param nodeId - 目标节点 ID。
   * @param context - 运行上下文。
   * @returns 是否成功触发执行。
   */
  playFromNode(nodeId: string, context?: unknown): boolean {
    return playLeaferGraphApiFromNode(this.context, nodeId, context);
  }

  /**
   * 从全部启动事件节点开始图级运行。
   *
   * @returns 是否成功触发图级运行。
   */
  play(): boolean {
    return playLeaferGraphApiGraph(this.context);
  }

  /**
   * 单步推进当前图级运行。
   *
   * @returns 是否成功执行单步。
   */
  step(): boolean {
    return stepLeaferGraphApiGraph(this.context);
  }

  /**
   * 停止当前图级运行。
   *
   * @returns 是否成功停止运行。
   */
  stop(): boolean {
    const stopped = stopLeaferGraphApiGraph(this.context);
    const nodeRuntimeHost = this.context.options.runtime.nodeRuntimeHost as {
      clearAllExecutionStates?: () => void;
    };
    nodeRuntimeHost.clearAllExecutionStates?.();
    return stopped;
  }

  /**
   * 订阅节点执行完成事件。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    return subscribeLeaferGraphApiNodeExecution(this.context, listener);
  }

  /**
   * 订阅图级执行事件。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void {
    return subscribeLeaferGraphApiGraphExecution(this.context, listener);
  }

  /**
   * 订阅节点状态变化事件。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void {
    return subscribeLeaferGraphApiNodeState(this.context, listener);
  }

  /**
   * 订阅统一运行反馈事件。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeRuntimeFeedback(
    listener: (event: RuntimeFeedbackEvent) => void
  ): () => void {
    return subscribeLeaferGraphApiRuntimeFeedback(this.context, listener);
  }

  /**
   * 订阅正式历史事件。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeHistory(
    listener: (event: LeaferGraphHistoryEvent) => void
  ): () => void {
    return subscribeLeaferGraphApiHistory(this.context, listener);
  }

  /**
   * 订阅交互活跃态变化。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeInteractionActivity(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): () => void {
    return subscribeLeaferGraphApiInteractionActivity(this.context, listener);
  }

  /**
   * 把外部 runtime feedback 投影回当前图运行时。
   *
   * @param feedback - 需要投影的运行反馈。
   * @returns 无返回值。
   */
  projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void {
    projectLeaferGraphApiRuntimeFeedback(this.context, feedback);
  }

  /**
   * 订阅交互结束后的正式提交事件。
   *
   * @param listener - 需要注册的监听器。
   * @returns 用于取消订阅的清理函数。
   */
  subscribeInteractionCommit(
    listener: (event: LeaferGraphInteractionCommitEvent) => void
  ): () => void {
    return subscribeLeaferGraphApiInteractionCommit(this.context, listener);
  }

  /**
   * 在内部批量操作期间暂时关闭历史捕获。
   *
   * @param callback - 需要在关闭历史捕获期间执行的回调。
   * @returns 回调返回的结果。
   */
  runWithoutHistoryCapture<T>(callback: () => T): T {
    this.historyCaptureSuppressionDepth += 1;

    try {
      return callback();
    } finally {
      this.historyCaptureSuppressionDepth -= 1;
    }
  }

  /**
   * 向外发送一次历史重置事件。
   *
   * @param reason - 历史重置原因。
   * @returns 无返回值。
   */
  notifyHistoryReset(reason: LeaferGraphHistoryResetReason): void {
    if (!this.shouldCaptureHistory()) {
      return;
    }

    this.options.runtime.historySource.emit(createHistoryResetEvent(reason));
  }

  /**
   * 根据节点 ID 查询当前图中的所有关联连线。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 关联连线列表。
   */
  findLinksByNode(nodeId: string): GraphLink[] {
    return findLeaferGraphApiLinksByNode(this.context, nodeId);
  }

  /**
   * 根据连线 ID 读取当前图中的正式连线快照。
   *
   * @param linkId - 目标连线 ID。
   * @returns 当前正式连线快照。
   */
  getLink(linkId: string): GraphLink | undefined {
    return getLeaferGraphApiLink(this.context, linkId);
  }

  /**
   * 应用一条正式图操作。
   *
   * @param operation - 需要应用的正式图操作。
   * @returns 图操作应用结果。
   */
  applyGraphOperation(operation: GraphOperation): GraphOperationApplyResult {
    return applyLeaferGraphApiGraphOperation(this.context, operation);
  }

  /**
   * 解析某个节点方向和槽位对应的正式端口几何。
   *
   * @param nodeId - 目标节点 ID。
   * @param direction - 目标端口方向。
   * @param slot - 目标槽位。
   * @returns 解析到的端口状态。
   */
  resolveConnectionPort(
    nodeId: string,
    direction: LeaferGraphConnectionPortState["direction"],
    slot: number
  ): LeaferGraphConnectionPortState | undefined {
    return resolveLeaferGraphApiConnectionPort(this.context, nodeId, direction, slot);
  }

  /**
   * 根据 page 坐标命中一个方向匹配的端口。
   *
   * @param point - 需要命中的 page 坐标。
   * @param direction - 目标端口方向。
   * @returns 命中到的端口状态。
   */
  resolveConnectionPortAtPoint(
    point: { x: number; y: number },
    direction: LeaferGraphConnectionPortState["direction"]
  ): LeaferGraphConnectionPortState | undefined {
    return resolveLeaferGraphApiConnectionPortAtPoint(
      this.context,
      point,
      direction
    );
  }

  /**
   * 设置当前连接预览的起点高亮。
   *
   * @param port - 当前来源端口。
   * @returns 无返回值。
   */
  setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void {
    setLeaferGraphApiConnectionSourcePort(this.context, port);
  }

  /**
   * 设置当前连接预览的候选终点高亮。
   *
   * @param port - 当前候选端口。
   * @returns 无返回值。
   */
  setConnectionCandidatePort(
    port: LeaferGraphConnectionPortState | null
  ): void {
    setLeaferGraphApiConnectionCandidatePort(this.context, port);
  }

  /**
   * 刷新当前连接预览线。
   *
   * @param source - 当前来源端口。
   * @param pointer - 当前指针位置。
   * @param target - 当前候选目标端口。
   * @returns 无返回值。
   */
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void {
    setLeaferGraphApiConnectionPreview(this.context, source, pointer, target);
  }

  /**
   * 清理当前连接预览和端口高亮。
   *
   * @returns 无返回值。
   */
  clearConnectionPreview(): void {
    clearLeaferGraphApiConnectionPreview(this.context);
  }

  /**
   * 校验两个端口当前是否允许建立正式连线。
   *
   * @param source - 当前来源端口。
   * @param target - 当前目标端口。
   * @returns 端口连接校验结果。
   */
  canCreateConnection(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult {
    return canLeaferGraphApiCreateConnection(this.context, source, target);
  }

  /**
   * 创建一个新的节点实例并立即挂到主包场景中。
   *
   * @param input - 节点创建输入。
   * @returns 创建出的节点运行时状态。
   */
  createNode(input: LeaferGraphCreateNodeInput): TNodeState {
    return createLeaferGraphApiNode(this.context, input);
  }

  /**
   * 删除一个节点，并同步清理它的全部关联连线与视图。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 是否成功删除节点。
   */
  removeNode(nodeId: string): boolean {
    return removeLeaferGraphApiNode(this.context, nodeId);
  }

  /**
   * 更新一个既有节点的静态内容与布局。
   *
   * @param nodeId - 目标节点 ID。
   * @param input - 节点更新输入。
   * @returns 更新后的节点运行时状态。
   */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined {
    return updateLeaferGraphApiNode(this.context, nodeId, input);
  }

  /**
   * 移动一个节点到新的图坐标。
   *
   * @param nodeId - 目标节点 ID。
   * @param position - 节点移动输入。
   * @returns 更新后的节点运行时状态。
   */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined {
    return moveLeaferGraphApiNode(this.context, nodeId, position);
  }

  /**
   * 调整一个节点的显式宽高。
   *
   * @param nodeId - 目标节点 ID。
   * @param size - 节点 resize 输入。
   * @returns 更新后的节点运行时状态。
   */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined {
    return resizeLeaferGraphApiNode(this.context, nodeId, size);
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   *
   * @param input - 连线创建输入。
   * @returns 创建出的正式连线。
   */
  createLink(input: LeaferGraphCreateLinkInput): GraphLink {
    return createLeaferGraphApiLink(this.context, input);
  }

  /**
   * 删除一条既有连线。
   *
   * @param linkId - 目标连线 ID。
   * @returns 是否成功删除连线。
   */
  removeLink(linkId: string): boolean {
    return removeLeaferGraphApiLink(this.context, linkId);
  }

  /**
   * 更新某个节点某个 widget 的值，并触发 renderer 的 `update`。
   *
   * @param nodeId - 目标节点 ID。
   * @param widgetIndex - 目标 widget 索引。
   * @param newValue - 需要写入的新值。
   * @returns 无返回值。
   */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    setLeaferGraphApiNodeWidgetValue(this.context, nodeId, widgetIndex, newValue);
  }

  /**
   * 判断当前是否应继续捕获历史记录。
   *
   * @returns 当前是否允许捕获历史记录。
   */
  private shouldCaptureHistory(): boolean {
    return this.historyCaptureSuppressionDepth === 0;
  }

  /**
   * 在捕获历史前读取当前正式文档快照。
   *
   * @returns 当前正式文档快照，或 `null`。
   */
  private captureDocumentBeforeHistory(): GraphDocument | null {
    if (!this.shouldCaptureHistory()) {
      return null;
    }

    return this.options.runtime.getGraphDocument();
  }

  /**
   * 在捕获历史前读取指定节点快照。
   *
   * @param nodeId - 目标节点 ID。
   * @returns 当前节点快照。
   */
  private captureNodeSnapshotBeforeHistory(
    nodeId: string
  ): NodeSerializeResult | undefined {
    if (!this.shouldCaptureHistory()) {
      return undefined;
    }

    return this.options.runtime.nodeRuntimeHost.getNodeSnapshot(nodeId);
  }

  /**
   * 为历史记录解析节点尺寸。
   *
   * @param nodeId - 目标节点 ID。
   * @param snapshot - 当前节点快照。
   * @returns 节点尺寸快照。
   */
  private resolveNodeSizeForHistory(
    nodeId: string,
    snapshot: NodeSerializeResult
  ): { width: number; height: number } {
    const constraint =
      this.options.runtime.nodeRuntimeHost.getNodeResizeConstraint(nodeId);

    return {
      width: snapshot.layout.width ?? constraint?.defaultWidth ?? 0,
      height: snapshot.layout.height ?? constraint?.defaultHeight ?? 0
    };
  }

  /**
   * 派发一条历史记录事件。
   *
   * @param record - 需要发送的历史记录。
   * @returns 无返回值。
   */
  private emitHistoryRecord(record: LeaferGraphHistoryRecord | null): void {
    if (!record || !this.shouldCaptureHistory()) {
      return;
    }

    this.options.runtime.historySource.emit(createHistoryRecordEvent(record));
  }
}
