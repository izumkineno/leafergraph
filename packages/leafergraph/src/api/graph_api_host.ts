/**
 * 主包公共 API 宿主模块。
 *
 * @remarks
 * 负责把内部运行时壳面收敛成对外可调用的图、节点、连线和主题接口。
 */

import type { App, Box, Group } from "leafer-ui";
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
  LeaferGraphThemeMode,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetRenderInstance
} from "./plugin";
import { projectExternalRuntimeFeedback } from "../graph/graph_runtime_feedback_projection";
import type {
  GraphOperation,
  GraphOperationApplyResult,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphInteractionActivityState,
  LeaferGraphInteractionCommitEvent,
  RuntimeAdapter,
  RuntimeFeedbackEvent,
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
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "./graph_api_types";
import type { LeaferGraphRenderableNodeState } from "../graph/graph_runtime_types";
import type { LeaferGraphBootstrapRuntimeLike } from "../graph/graph_bootstrap_host";
import type { LeaferGraphSceneRuntimeHost } from "../graph/graph_scene_runtime_host";
import type { LeaferGraphInteractionCommitSource } from "../interaction/interaction_commit_source";

interface LeaferGraphInteractionTargetLike {
  name?: string;
  parent?: unknown | null;
  on_?: App["on_"];
  off_?: App["off_"];
}

type LeaferGraphApiNodeViewState<
  TNodeState extends LeaferGraphRenderableNodeState
> = {
  state: TNodeState;
  view: Group;
  widgetLayer: Box;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
};

type LeaferGraphApiLinkViewState = {
  linkId: string;
  view: LeaferGraphInteractionTargetLike;
};

/**
 * 主包公共 API 所依赖的最小运行时壳面。
 * 它刻意只暴露 facade 真正需要的方法，避免入口层继续感知全部内部宿主实例。
 */
export interface LeaferGraphApiRuntime<
  TNodeState extends LeaferGraphRenderableNodeState
> {
  app: {
    destroy(): void;
  };
  bootstrapRuntime: LeaferGraphBootstrapRuntimeLike;
  runtimeAdapter: RuntimeAdapter;
  widgetEditingManager: {
    destroy(): void;
  };
  dataFlowAnimationHost: {
    destroy(): void;
  };
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
  interactionCommitSource: Pick<
    LeaferGraphInteractionCommitSource,
    "subscribe"
  >;
  interactionHost: {
    getInteractionActivityState(): LeaferGraphInteractionActivityState;
    subscribeInteractionActivity(
      listener: (state: LeaferGraphInteractionActivityState) => void
    ): () => void;
    destroy(): void;
  };
  interactionRuntime: {
    resolvePort(
      nodeId: string,
      direction: LeaferGraphConnectionPortState["direction"],
      slot: number
    ): LeaferGraphConnectionPortState | undefined;
    resolvePortAtPoint(
      point: { x: number; y: number },
      direction: LeaferGraphConnectionPortState["direction"]
    ): LeaferGraphConnectionPortState | undefined;
    setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void;
    setConnectionCandidatePort(
      port: LeaferGraphConnectionPortState | null
    ): void;
    setConnectionPreview(
      source: LeaferGraphConnectionPortState,
      pointer: { x: number; y: number },
      target?: LeaferGraphConnectionPortState
    ): void;
    clearConnectionPreview(): void;
    canCreateLink(
      source: LeaferGraphConnectionPortState,
      target: LeaferGraphConnectionPortState
    ): LeaferGraphConnectionValidationResult;
  };
  nodeRuntimeHost: {
    getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined;
    getNodeInspectorState(nodeId: string): LeaferGraphNodeInspectorState | undefined;
    setNodeCollapsed(nodeId: string, collapsed: boolean): boolean;
    getNodeResizeConstraint(
      nodeId: string
    ): LeaferGraphNodeResizeConstraint | undefined;
    getNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined;
    canResizeNode(nodeId: string): boolean;
    resetNodeSize(nodeId: string): TNodeState | undefined;
    playFromNode(nodeId: string, context?: unknown): boolean;
    executeNode(nodeId: string, context?: unknown): boolean;
    subscribeNodeState(
      listener: (event: LeaferGraphNodeStateChangeEvent) => void
    ): () => void;
    subscribeNodeExecution(
      listener: (event: LeaferGraphNodeExecutionEvent) => void
    ): () => void;
    projectExternalNodeExecution(
      event: LeaferGraphNodeExecutionEvent
    ): void;
    projectExternalNodeState(
      event: LeaferGraphNodeStateChangeEvent
    ): void;
    projectExternalLinkPropagation(
      event: LeaferGraphLinkPropagationEvent
    ): void;
  };
  graphExecutionHost: {
    play(): boolean;
    step(): boolean;
    stop(): boolean;
    getGraphExecutionState(): LeaferGraphGraphExecutionState;
    subscribeGraphExecution(
      listener: (event: LeaferGraphGraphExecutionEvent) => void
    ): () => void;
    projectExternalGraphExecution(
      event: LeaferGraphGraphExecutionEvent
    ): void;
  };
  themeHost: {
    setThemeMode(mode: LeaferGraphThemeMode): void;
  };
  viewHost: {
    fitView(padding: number): boolean;
    setNodeSelected(nodeId: string, selected: boolean): boolean;
  };
  widgetHost: {
    destroyNodeWidgets(
      widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>,
      widgetLayer: Box
    ): void;
  };
}

interface LeaferGraphApiHostOptions<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  runtime: LeaferGraphApiRuntime<TNodeState>;
  nodeViews: Map<string, TNodeViewState>;
  linkViews: readonly TLinkViewState[];
}

/**
 * 主包公共 API facade。
 * 当前集中承接：
 * 1. 插件、节点与 Widget 注册相关公共入口
 * 2. 视图控制、主题控制与节点快照查询
 * 3. 节点/连线正式变更 API
 * 4. 宿主销毁时的统一清理顺序
 */
export class LeaferGraphApiHost<
  TNodeState extends LeaferGraphRenderableNodeState,
  TNodeViewState extends LeaferGraphApiNodeViewState<TNodeState>,
  TLinkViewState extends LeaferGraphApiLinkViewState = LeaferGraphApiLinkViewState
> {
  private readonly options: LeaferGraphApiHostOptions<
    TNodeState,
    TNodeViewState,
    TLinkViewState
  >;

  constructor(
    options: LeaferGraphApiHostOptions<TNodeState, TNodeViewState, TLinkViewState>
  ) {
    this.options = options;
  }

  /** 执行启动期安装流程并恢复初始图数据。 */
  initialize(options: LeaferGraphOptions): Promise<void> {
    return this.options.runtime.bootstrapRuntime.initialize(options);
  }

  /** 销毁宿主实例，并清理全部全局事件与 widget 生命周期。 */
  destroy(): void {
    for (const state of this.options.nodeViews.values()) {
      this.options.runtime.widgetHost.destroyNodeWidgets(
        state.widgetInstances,
        state.widgetLayer
      );
    }

    this.options.runtime.runtimeAdapter.destroy?.();
    this.options.runtime.interactionHost.destroy();
    this.options.runtime.dataFlowAnimationHost.destroy();
    this.options.runtime.widgetEditingManager.destroy();
    this.options.runtime.app.destroy();
  }

  /** 安装一个外部节点插件。 */
  async use(plugin: LeaferGraphNodePlugin): Promise<void> {
    return this.options.runtime.bootstrapRuntime.use(plugin);
  }

  /** 安装一个静态节点模块。 */
  installModule(module: NodeModule, options?: InstallNodeModuleOptions): void {
    this.options.runtime.bootstrapRuntime.installModule(module, options);
  }

  /** 注册单个节点定义。 */
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.options.runtime.bootstrapRuntime.registerNode(definition, options);
  }

  /** 注册单个完整 Widget 条目。 */
  registerWidget(entry: LeaferGraphWidgetEntry, options?: RegisterWidgetOptions): void {
    this.options.runtime.bootstrapRuntime.registerWidget(entry, options);
  }

  /** 读取单个 Widget 条目。 */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return this.options.runtime.bootstrapRuntime.getWidget(type);
  }

  /** 列出当前已注册 Widget。 */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return this.options.runtime.bootstrapRuntime.listWidgets();
  }

  /** 直接替换当前正式文档。 */
  replaceGraphDocument(document: GraphDocument): void {
    this.options.runtime.bootstrapRuntime.replaceGraphDocument(document);
  }

  /** 运行时切换主包主题，并局部刷新现有节点壳与 Widget。 */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    this.options.runtime.themeHost.setThemeMode(mode);
  }

  /** 列出当前已注册节点。 */
  listNodes(): NodeDefinition[] {
    return this.options.runtime.bootstrapRuntime.listNodes();
  }

  /** 获取某个节点对应的 Leafer 视图宿主，便于挂接节点级交互。 */
  getNodeView(nodeId: string): Group | undefined {
    return this.options.nodeViews.get(nodeId)?.view;
  }

  /** 获取某条连线对应的 Leafer 视图宿主，便于 editor 绑定链接菜单与未来的重连交互。 */
  getLinkView(linkId: string): LeaferGraphInteractionTargetLike | undefined {
    return this.options.linkViews.find((state) => state.linkId === linkId)?.view;
  }

  /** 让当前画布内容适配到可视区域内。 */
  fitView(padding: number): boolean {
    return this.options.runtime.viewHost.fitView(padding);
  }

  /** 读取一个正式可序列化节点快照。 */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    return this.options.runtime.nodeRuntimeHost.getNodeSnapshot(nodeId);
  }

  /** 读取一个节点当前的检查快照，供 editor 信息面板直接消费。 */
  getNodeInspectorState(
    nodeId: string
  ): LeaferGraphNodeInspectorState | undefined {
    return this.options.runtime.nodeRuntimeHost.getNodeInspectorState(nodeId);
  }

  /** 设置单个节点的选中态。 */
  setNodeSelected(nodeId: string, selected: boolean): boolean {
    return this.options.runtime.viewHost.setNodeSelected(nodeId, selected);
  }

  /** 设置单个节点的折叠态。 */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    return this.options.runtime.nodeRuntimeHost.setNodeCollapsed(nodeId, collapsed);
  }

  /** 读取某个节点的正式 resize 约束。 */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    return this.options.runtime.nodeRuntimeHost.getNodeResizeConstraint(nodeId);
  }

  /** 读取某个节点当前的最小执行反馈快照。 */
  getNodeExecutionState(
    nodeId: string
  ): LeaferGraphNodeExecutionState | undefined {
    return this.options.runtime.nodeRuntimeHost.getNodeExecutionState(nodeId);
  }

  /** 读取当前图级执行状态。 */
  getGraphExecutionState(): LeaferGraphGraphExecutionState {
    return this.options.runtime.graphExecutionHost.getGraphExecutionState();
  }

  /** 读取当前最小交互活跃态快照。 */
  getInteractionActivityState(): LeaferGraphInteractionActivityState {
    return this.options.runtime.interactionHost.getInteractionActivityState();
  }

  /** 判断某个节点当前是否允许显示并响应 resize 交互。 */
  canResizeNode(nodeId: string): boolean {
    return this.options.runtime.nodeRuntimeHost.canResizeNode(nodeId);
  }

  /** 把节点尺寸恢复到定义默认值。 */
  resetNodeSize(nodeId: string): TNodeState | undefined {
    return this.options.runtime.nodeRuntimeHost.resetNodeSize(nodeId);
  }

  /** 从指定节点开始运行一条正式执行链。 */
  playFromNode(nodeId: string, context?: unknown): boolean {
    return this.options.runtime.nodeRuntimeHost.playFromNode(nodeId, context);
  }

  /** 执行单个节点的 `onExecute(...)`，并沿现有正式连线传播输出。 */
  executeNode(nodeId: string, context?: unknown): boolean {
    return this.options.runtime.nodeRuntimeHost.executeNode(nodeId, context);
  }

  /** 从全部入口节点开始图级运行。 */
  play(): boolean {
    return this.options.runtime.graphExecutionHost.play();
  }

  /** 单步推进当前图级运行。 */
  step(): boolean {
    return this.options.runtime.graphExecutionHost.step();
  }

  /** 停止当前图级运行。 */
  stop(): boolean {
    return this.options.runtime.graphExecutionHost.stop();
  }

  /** 订阅节点执行完成事件。 */
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    return this.options.runtime.nodeRuntimeHost.subscribeNodeExecution(listener);
  }

  /** 订阅图级执行事件。 */
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void {
    return this.options.runtime.graphExecutionHost.subscribeGraphExecution(
      listener
    );
  }

  /** 订阅节点状态变化事件，供 editor 检查面板和调试工具复用。 */
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void {
    return this.options.runtime.nodeRuntimeHost.subscribeNodeState(listener);
  }

  /** 订阅统一运行反馈事件。 */
  subscribeRuntimeFeedback(
    listener: (event: RuntimeFeedbackEvent) => void
  ): () => void {
    return this.options.runtime.runtimeAdapter.subscribe(listener);
  }

  /** 订阅交互活跃态变化。 */
  subscribeInteractionActivity(
    listener: (state: LeaferGraphInteractionActivityState) => void
  ): () => void {
    return this.options.runtime.interactionHost.subscribeInteractionActivity(
      listener
    );
  }

  /** 把外部 runtime feedback 投影回当前图运行时。 */
  projectRuntimeFeedback(feedback: RuntimeFeedbackEvent): void {
    projectExternalRuntimeFeedback(
      {
        projectExternalGraphExecution: (event) =>
          this.options.runtime.graphExecutionHost.projectExternalGraphExecution(
            event
          ),
        projectExternalNodeExecution: (event) =>
          this.options.runtime.nodeRuntimeHost.projectExternalNodeExecution(
            event
          ),
        projectExternalNodeState: (event) =>
          this.options.runtime.nodeRuntimeHost.projectExternalNodeState(event),
        projectExternalLinkPropagation: (event) =>
          this.options.runtime.nodeRuntimeHost.projectExternalLinkPropagation(
            event
          )
      },
      feedback
    );
  }

  /** 订阅交互结束后的正式提交事件。 */
  subscribeInteractionCommit(
    listener: (event: LeaferGraphInteractionCommitEvent) => void
  ): () => void {
    return this.options.runtime.interactionCommitSource.subscribe(listener);
  }

  /** 根据节点 ID 查询当前图中的所有关联连线。 */
  findLinksByNode(nodeId: string): GraphLink[] {
    return this.options.runtime.sceneRuntime.findLinksByNode(nodeId);
  }

  /** 根据连线 ID 读取当前图中的正式连线快照。 */
  getLink(linkId: string): GraphLink | undefined {
    return this.options.runtime.sceneRuntime.getLink(linkId);
  }

  /** 应用一条正式图操作。 */
  applyGraphOperation(
    operation: GraphOperation
  ): GraphOperationApplyResult {
    return this.options.runtime.sceneRuntime.applyGraphOperation(operation);
  }

  /** 解析某个节点方向和槽位对应的正式端口几何。 */
  resolveConnectionPort(
    nodeId: string,
    direction: LeaferGraphConnectionPortState["direction"],
    slot: number
  ): LeaferGraphConnectionPortState | undefined {
    return this.options.runtime.interactionRuntime.resolvePort(
      nodeId,
      direction,
      slot
    );
  }

  /** 根据 page 坐标命中一个方向匹配的端口。 */
  resolveConnectionPortAtPoint(
    point: { x: number; y: number },
    direction: LeaferGraphConnectionPortState["direction"]
  ): LeaferGraphConnectionPortState | undefined {
    return this.options.runtime.interactionRuntime.resolvePortAtPoint(
      point,
      direction
    );
  }

  /** 设置当前连接预览的起点高亮。 */
  setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void {
    this.options.runtime.interactionRuntime.setConnectionSourcePort(port);
  }

  /** 设置当前连接预览的候选终点高亮。 */
  setConnectionCandidatePort(
    port: LeaferGraphConnectionPortState | null
  ): void {
    this.options.runtime.interactionRuntime.setConnectionCandidatePort(port);
  }

  /** 刷新当前连接预览线。 */
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void {
    this.options.runtime.interactionRuntime.setConnectionPreview(
      source,
      pointer,
      target
    );
  }

  /** 清理当前连接预览和端口高亮。 */
  clearConnectionPreview(): void {
    this.options.runtime.interactionRuntime.clearConnectionPreview();
  }

  /** 校验两个端口当前是否允许建立正式连线。 */
  canCreateConnection(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult {
    return this.options.runtime.interactionRuntime.canCreateLink(source, target);
  }

  /** 创建一个新的节点实例并立即挂到主包场景中。 */
  createNode(input: LeaferGraphCreateNodeInput): TNodeState {
    return this.options.runtime.sceneRuntime.createNode(input);
  }

  /** 删除一个节点，并同步清理它的全部关联连线与视图。 */
  removeNode(nodeId: string): boolean {
    return this.options.runtime.sceneRuntime.removeNode(nodeId);
  }

  /** 更新一个既有节点的静态内容与布局。 */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): TNodeState | undefined {
    return this.options.runtime.sceneRuntime.updateNode(nodeId, input);
  }

  /** 移动一个节点到新的图坐标。 */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): TNodeState | undefined {
    return this.options.runtime.sceneRuntime.moveNode(nodeId, position);
  }

  /** 调整一个节点的显式宽高。 */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): TNodeState | undefined {
    return this.options.runtime.sceneRuntime.resizeNode(nodeId, size);
  }

  /** 创建一条正式连线并加入当前图状态。 */
  createLink(input: LeaferGraphCreateLinkInput): GraphLink {
    return this.options.runtime.sceneRuntime.createLink(input);
  }

  /** 删除一条既有连线。 */
  removeLink(linkId: string): boolean {
    return this.options.runtime.sceneRuntime.removeLink(linkId);
  }

  /** 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。 */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    this.options.runtime.sceneRuntime.setNodeWidgetValue(
      nodeId,
      widgetIndex,
      newValue
    );
  }
}
