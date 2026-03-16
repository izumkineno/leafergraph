/**
 * @packageDocumentation
 * leafergraph 主包公共入口。
 *
 * @remarks
 * 负责导出公共 API、公共类型与宿主工厂，并把包级文档锚定到入口文件。
 */

import type { App, Group } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import "@leafer-in/flow";
import "@leafer-in/resize";
import "@leafer-in/state";
import "@leafer-in/view";
import {
  type LeaferGraphLinkData,
  type InstallNodeModuleOptions,
  type NodeDefinition,
  type NodeModule,
  type NodeRuntimeState,
  type NodeSerializeResult,
  type RegisterNodeOptions,
  type RegisterWidgetOptions
} from "@leafergraph/node";
export { LeaferUI };
export type {
  LeaferGraphData,
  LeaferGraphLinkData,
  LeaferGraphLinkEndpoint
} from "@leafergraph/node";
export {
  LEAFER_GRAPH_POINTER_MENU_EVENT,
  LeaferGraphContextMenuManager,
  createLeaferGraphContextMenu
} from "./interaction/context_menu";
export {
  LEAFER_GRAPH_WIDGET_HIT_AREA_NAME,
  bindLinearWidgetDrag,
  bindPressWidgetInteraction,
  isWidgetInteractionTarget,
  resolveLinearWidgetProgressFromEvent,
  stopWidgetPointerEvent
} from "./widgets/widget_interaction";
export type {
  LeaferGraphContextMenuActionItem,
  LeaferGraphContextMenuBinding,
  LeaferGraphContextMenuBindingKind,
  LeaferGraphContextMenuBindingTarget,
  LeaferGraphContextMenuContext,
  LeaferGraphContextMenuItem,
  LeaferGraphContextMenuOptions,
  LeaferGraphContextMenuPoint,
  LeaferGraphContextMenuResolver,
  LeaferGraphContextMenuSeparatorItem,
  LeaferGraphMenuOriginEvent,
  LeaferGraphPointerMenuEvent
} from "./interaction/context_menu";
export type {
  LeaferGraphNodePlugin,
  LeaferGraphNodePluginContext,
  LeaferGraphOptions,
  LeaferGraphThemeMode,
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetEditingOptions,
  LeaferGraphWidgetFocusBinding,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererContext,
  LeaferGraphWidgetRendererLike,
  LeaferGraphWidgetTextEditRequest,
  LeaferGraphWidgetThemeContext,
  LeaferGraphWidgetThemeTokens,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetLifecycleState,
  LeaferGraphWidgetOptionsMenuRequest
} from "./api/plugin";
export type {
  LeaferGraphExecutionContext,
  LeaferGraphExecutionSource,
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionEventType,
  LeaferGraphGraphExecutionState,
  LeaferGraphGraphExecutionStatus,
  LeaferGraphConnectionPortState,
  LeaferGraphNodeExecutionEvent,
  LeaferGraphNodeStateChangeEvent,
  LeaferGraphNodeStateChangeReason,
  LeaferGraphNodeInspectorState,
  LeaferGraphNodeIoValueEntry,
  LeaferGraphNodeExecutionState,
  LeaferGraphNodeExecutionStatus,
  LeaferGraphNodeExecutionTrigger,
  LeaferGraphConnectionValidationResult,
  LeaferGraphCreateLinkInput,
  LeaferGraphCreateNodeInput,
  LeaferGraphMoveNodeInput,
  LeaferGraphNodeResizeConstraint,
  LeaferGraphNodeSlotInput,
  LeaferGraphResizeNodeInput,
  LeaferGraphUpdateNodeInput
} from "./api/graph_api_types";
export {
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetLifecycleRenderer,
  createWidgetSurface,
  createWidgetValueText
} from "./widgets/widget_lifecycle";
export { LeaferGraphWidgetRegistry } from "./widgets/widget_registry";
export type {
  LeaferGraphLinearWidgetDragOptions,
  LeaferGraphPressWidgetInteractionOptions,
  LeaferGraphWidgetEventSource,
  LeaferGraphWidgetEventTargetLike,
  LeaferGraphWidgetInteractionBinding,
  LeaferGraphWidgetPointerEvent
} from "./widgets/widget_interaction";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphOptions,
  LeaferGraphThemeMode,
  LeaferGraphWidgetEntry
} from "./api/plugin";
import type { LeaferGraphEntryRuntime } from "./graph/graph_entry_runtime";
import { createLeaferGraphEntryRuntime } from "./graph/graph_entry_runtime";
import {
  DEFAULT_FIT_VIEW_PADDING
} from "./graph/graph_runtime_style";
import type { LeaferGraphContextMenuBindingTarget } from "./interaction/context_menu";
import type {
  LeaferGraphGraphExecutionEvent,
  LeaferGraphGraphExecutionState,
  LeaferGraphConnectionPortState,
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
} from "./api/graph_api_types";

/**
 * LeaferGraph 主包运行时。
 * 当前既提供插件安装入口，也负责节点图渲染与交互。
 */
export class LeaferGraph {
  readonly container: HTMLElement;
  readonly app: App;
  readonly root: Group;
  readonly linkLayer: Group;
  readonly nodeLayer: Group;
  readonly ready: Promise<void>;

  private readonly apiHost: LeaferGraphEntryRuntime["apiHost"];

  /** 创建图宿主，并在内部异步完成模块与插件安装。 */
  constructor(container: HTMLElement, options: LeaferGraphOptions = {}) {
    this.container = container;
    const runtime = createLeaferGraphEntryRuntime(container, options);
    this.app = runtime.app;
    this.root = runtime.root;
    this.linkLayer = runtime.linkLayer;
    this.nodeLayer = runtime.nodeLayer;
    this.apiHost = runtime.apiHost;
    this.ready = runtime.ready;
  }

  /** 销毁宿主实例，并清理全部全局事件与 widget 生命周期。 */
  destroy(): void {
    this.apiHost.destroy();
  }

  /** 安装一个外部节点插件。 */
  async use(plugin: LeaferGraphNodePlugin): Promise<void> {
    return this.apiHost.use(plugin);
  }

  /** 安装一个静态节点模块。 */
  installModule(module: NodeModule, options?: InstallNodeModuleOptions): void {
    this.apiHost.installModule(module, options);
  }

  /** 注册单个节点定义。 */
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.apiHost.registerNode(definition, options);
  }

  /** 注册单个完整 Widget 条目。 */
  registerWidget(entry: LeaferGraphWidgetEntry, options?: RegisterWidgetOptions): void {
    this.apiHost.registerWidget(entry, options);
  }

  /** 读取单个 Widget 条目。 */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return this.apiHost.getWidget(type);
  }

  /** 列出当前已注册 Widget。 */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return this.apiHost.listWidgets();
  }

  /** 运行时切换主包主题，并局部刷新现有节点壳与 Widget。 */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    this.apiHost.setThemeMode(mode);
  }

  /** 列出当前已注册节点。 */
  listNodes(): NodeDefinition[] {
    return this.apiHost.listNodes();
  }

  /** 获取某个节点对应的 Leafer 视图宿主，便于挂接节点级交互。 */
  getNodeView(nodeId: string): Group | undefined {
    return this.apiHost.getNodeView(nodeId);
  }

  /** 获取某条连线对应的 Leafer 视图宿主，便于挂接链接菜单与未来的重连交互。 */
  getLinkView(
    linkId: string
  ): LeaferGraphContextMenuBindingTarget | undefined {
    return this.apiHost.getLinkView(linkId);
  }

  /**
   * 让当前画布内容适配到可视区域内。
   * 这是对 `@leafer-in/view` 的最小封装，优先以节点视图为参考对象，
   * 避免把背景或未来的屏幕层 overlay 一起纳入适配范围。
   */
  fitView(padding = DEFAULT_FIT_VIEW_PADDING): boolean {
    return this.apiHost.fitView(padding);
  }

  /**
   * 读取一个正式可序列化节点快照。
   * 返回值直接使用 `NodeSerializeResult` 语义，供 editor 复制、持久化和外部恢复复用。
   */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    return this.apiHost.getNodeSnapshot(nodeId);
  }

  /** 读取一个节点当前的检查快照，供 editor 右侧信息面板和调试工具复用。 */
  getNodeInspectorState(
    nodeId: string
  ): LeaferGraphNodeInspectorState | undefined {
    return this.apiHost.getNodeInspectorState(nodeId);
  }

  /**
   * 设置单个节点的选中态。
   * 当前阶段的实现尽量轻量：只更新运行时 flag，并把视觉反馈直接同步到现有图元，
   * 不触发整节点重建，从而避免菜单绑定和拖拽状态被打断。
   */
  setNodeSelected(nodeId: string, selected: boolean): boolean {
    return this.apiHost.setNodeSelected(nodeId, selected);
  }

  /**
   * 设置单个节点的折叠态。
   * 折叠后节点会收缩到头部高度，并同步刷新端口锚点与关联连线。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    return this.apiHost.setNodeCollapsed(nodeId, collapsed);
  }

  /**
   * 读取某个节点的正式 resize 约束。
   * 返回结果已经合并了节点定义中的 `resize` 配置、兼容字段和主包默认值。
   */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    return this.apiHost.getNodeResizeConstraint(nodeId);
  }

  /** 读取某个节点当前的最小执行反馈快照。 */
  getNodeExecutionState(nodeId: string): LeaferGraphNodeExecutionState | undefined {
    return this.apiHost.getNodeExecutionState(nodeId);
  }

  /** 读取当前图级执行状态。 */
  getGraphExecutionState(): LeaferGraphGraphExecutionState {
    return this.apiHost.getGraphExecutionState();
  }

  /** 判断某个节点当前是否允许显示并响应 resize 交互。 */
  canResizeNode(nodeId: string): boolean {
    return this.apiHost.canResizeNode(nodeId);
  }

  /**
   * 把节点尺寸恢复到定义默认值。
   * 如果定义没有显式提供默认尺寸，则回退到主包的基础节点尺寸。
   */
  resetNodeSize(nodeId: string): NodeRuntimeState | undefined {
    return this.apiHost.resetNodeSize(nodeId);
  }

  /** 从指定节点开始运行一条正式执行链。 */
  playFromNode(nodeId: string, context?: unknown): boolean {
    return this.apiHost.playFromNode(nodeId, context);
  }

  /**
   * 兼容旧名称的节点级运行入口。
   * 当前行为与 `playFromNode(...)` 完全一致。
   */
  executeNode(nodeId: string, context?: unknown): boolean {
    return this.apiHost.executeNode(nodeId, context);
  }

  /** 从全部 `OnPlay` 节点开始图级运行。 */
  play(): boolean {
    return this.apiHost.play();
  }

  /** 单步推进当前图级运行。 */
  step(): boolean {
    return this.apiHost.step();
  }

  /** 停止当前图级运行。 */
  stop(): boolean {
    return this.apiHost.stop();
  }

  /** 订阅节点执行完成事件，供 editor 调试面板或运行时间线复用。 */
  subscribeNodeExecution(
    listener: (event: LeaferGraphNodeExecutionEvent) => void
  ): () => void {
    return this.apiHost.subscribeNodeExecution(listener);
  }

  /** 订阅图级执行事件。 */
  subscribeGraphExecution(
    listener: (event: LeaferGraphGraphExecutionEvent) => void
  ): () => void {
    return this.apiHost.subscribeGraphExecution(listener);
  }

  /** 订阅节点状态变化事件，供 editor 检查面板或调试工具复用。 */
  subscribeNodeState(
    listener: (event: LeaferGraphNodeStateChangeEvent) => void
  ): () => void {
    return this.apiHost.subscribeNodeState(listener);
  }

  /**
   * 根据节点 ID 查询当前图中的所有关联连线。
   * 这一步先提供最小查询能力，方便 editor 后续接入删除、复制和选中联动。
   */
  findLinksByNode(nodeId: string): LeaferGraphLinkData[] {
    return this.apiHost.findLinksByNode(nodeId);
  }

  /** 根据连线 ID 查询当前图中的正式连线快照。 */
  getLink(linkId: string): LeaferGraphLinkData | undefined {
    return this.apiHost.getLink(linkId);
  }

  /** 解析某个节点方向和槽位对应的正式端口几何。 */
  resolveConnectionPort(
    nodeId: string,
    direction: LeaferGraphConnectionPortState["direction"],
    slot: number
  ): LeaferGraphConnectionPortState | undefined {
    return this.apiHost.resolveConnectionPort(nodeId, direction, slot);
  }

  /** 根据当前画布 page 坐标命中一个方向匹配的端口。 */
  resolveConnectionPortAtPoint(
    point: { x: number; y: number },
    direction: LeaferGraphConnectionPortState["direction"]
  ): LeaferGraphConnectionPortState | undefined {
    return this.apiHost.resolveConnectionPortAtPoint(point, direction);
  }

  /** 设置当前连接预览的起点高亮。 */
  setConnectionSourcePort(port: LeaferGraphConnectionPortState | null): void {
    this.apiHost.setConnectionSourcePort(port);
  }

  /** 设置当前连接预览的候选终点高亮。 */
  setConnectionCandidatePort(
    port: LeaferGraphConnectionPortState | null
  ): void {
    this.apiHost.setConnectionCandidatePort(port);
  }

  /** 刷新当前连接预览线。 */
  setConnectionPreview(
    source: LeaferGraphConnectionPortState,
    pointer: { x: number; y: number },
    target?: LeaferGraphConnectionPortState
  ): void {
    this.apiHost.setConnectionPreview(source, pointer, target);
  }

  /** 清理当前连接预览和候选高亮。 */
  clearConnectionPreview(): void {
    this.apiHost.clearConnectionPreview();
  }

  /** 校验两个端口当前是否允许建立正式连线。 */
  canCreateConnection(
    source: LeaferGraphConnectionPortState,
    target: LeaferGraphConnectionPortState
  ): LeaferGraphConnectionValidationResult {
    return this.apiHost.canCreateConnection(source, target);
  }

  /**
   * 创建一个新的节点实例并立即挂到主包场景中。
   * 当前阶段仍然接受页面层友好的节点输入结构，后续再逐步切到更正式的图模型输入。
   */
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState {
    return this.apiHost.createNode(input);
  }

  /**
   * 删除一个节点，并同步清理它的全部关联连线与视图。
   * 这是当前阶段最小但正式的节点移除入口。
   */
  removeNode(nodeId: string): boolean {
    return this.apiHost.removeNode(nodeId);
  }

  /**
   * 更新一个既有节点的静态内容与布局。
   * 这一轮先保持边界清晰：允许更新标题、布局、属性、槽位与 widget，
   * 但不在这里处理“节点 ID / 类型切换”这类结构性重建。
   */
  updateNode(
    nodeId: string,
    input: LeaferGraphUpdateNodeInput
  ): NodeRuntimeState | undefined {
    return this.apiHost.updateNode(nodeId, input);
  }

  /**
   * 移动一个节点到新的图坐标。
   * 现有拖拽逻辑也会统一复用这个入口，避免再出现“交互一套、正式 API 一套”的双路径。
   */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): NodeRuntimeState | undefined {
    return this.apiHost.moveNode(nodeId, position);
  }

  /**
   * 调整一个节点的显式宽高。
   * 当前不做整体缩放，而是直接修改布局尺寸并局部重建节点壳，
   * 以保持端口、Widget 和连线锚点语义稳定。
   */
  resizeNode(
    nodeId: string,
    size: LeaferGraphResizeNodeInput
  ): NodeRuntimeState | undefined {
    return this.apiHost.resizeNode(nodeId, size);
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   * 连线端点必须指向已存在的节点，否则直接抛错，避免悄悄生成半无效状态。
   */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
    return this.apiHost.createLink(input);
  }

  /** 删除一条既有连线。 */
  removeLink(linkId: string): boolean {
    return this.apiHost.removeLink(linkId);
  }

  /** 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。 */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    this.apiHost.setNodeWidgetValue(nodeId, widgetIndex, newValue);
  }

}

/** 创建 `LeaferGraph` 的便捷工厂函数。 */
export function createLeaferGraph(
  container: HTMLElement,
  options?: LeaferGraphOptions
): LeaferGraph {
  return new LeaferGraph(container, options);
}
