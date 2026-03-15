import { App, Box, Group, Rect } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import { Arrow } from "@leafer-in/arrow";
import "@leafer-in/flow";
import "@leafer-in/resize";
import "@leafer-in/state";
import { addViewport } from "@leafer-in/viewport";
import "@leafer-in/view";
import * as NodeSDK from "@leafergraph/node";
import {
  installNodeModule,
  NodeRegistry,
  createNodeApi,
  serializeNode,
  type LeaferGraphLinkData,
  type InstallNodeModuleOptions,
  type NodeDefinition,
  type NodePropertySpec,
  type NodeResizeConfig,
  type NodeModule,
  type NodeRuntimeState,
  type NodeSerializeResult,
  type NodeSlotSpec,
  type SlotType,
  type RegisterNodeOptions,
  type RegisterWidgetOptions,
  type ResolvedNodeModule
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
} from "./context_menu";
export {
  LEAFER_GRAPH_WIDGET_HIT_AREA_NAME,
  bindLinearWidgetDrag,
  bindPressWidgetInteraction,
  isWidgetInteractionTarget,
  resolveLinearWidgetProgressFromEvent,
  stopWidgetPointerEvent
} from "./widget_interaction";
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
} from "./context_menu";
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
} from "./plugin";
export {
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetLifecycleRenderer,
  createWidgetSurface,
  createWidgetValueText
} from "./widgets/widget_lifecycle";
export { LeaferGraphWidgetRegistry } from "./widget_registry";
export type {
  LeaferGraphLinearWidgetDragOptions,
  LeaferGraphPressWidgetInteractionOptions,
  LeaferGraphWidgetEventSource,
  LeaferGraphWidgetEventTargetLike,
  LeaferGraphWidgetInteractionBinding,
  LeaferGraphWidgetPointerEvent
} from "./widget_interaction";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphNodePluginContext,
  LeaferGraphOptions,
  LeaferGraphThemeMode,
  LeaferGraphWidgetEntry,
  LeaferGraphWidgetEditingContext,
  LeaferGraphWidgetThemeContext
} from "./plugin";
import {
  PORT_DIRECTION_LEFT,
  PORT_DIRECTION_RIGHT,
  buildLinkPath,
  resolveLinkEndpoints
} from "./link";
import {
  LeaferGraphMutationHost,
  normalizeGraphLinkSlotIndex
} from "./graph_mutation_host";
import { LeaferGraphRestoreHost } from "./graph_restore_host";
import {
  LeaferGraphInteractionHost,
  type GraphDragNodePosition
} from "./interaction_host";
import {
  LeaferGraphLinkHost,
  type GraphLinkViewState as LeaferGraphLinkViewState
} from "./link_host";
import {
  resolveNodeCategoryBadgeLayout,
  resolveNodeShellLayout
} from "./node_layout";
import {
  LeaferGraphNodeHost,
  type NodeViewState as LeaferGraphNodeViewState
} from "./node_host";
import {
  resolveNodePortAnchorYForNode,
  type NodeShellPortLayout
} from "./node_port";
import {
  createNodeShell,
  type NodeShellRenderTheme,
  type NodeShellView
} from "./node_shell";
import {
  type LeaferGraphWidgetPointerEvent
} from "./widget_interaction";
import {
  BasicWidgetLibrary,
  resolveBasicWidgetTheme
} from "./widgets/basic_widgets";
import {
  LeaferGraphWidgetHost,
  createMissingWidgetRenderer
} from "./widget_host";
import { LeaferGraphWidgetRegistry } from "./widget_registry";
import {
  LeaferGraphWidgetEditingManager,
  resolveWidgetEditingOptions
} from "./widget_editing";

/**
 * 主包当前渲染实现。
 * 这个文件同时承担三层职责：
 * 1. 宿主初始化与插件接入
 * 2. 节点与连线的 Leafer 渲染
 * 3. Widget renderer 的生命周期调度
 */

// 节点视觉常量：当前阶段保持集中定义，便于后续抽离成主题系统。
const DEFAULT_NODE_WIDTH = 288;
const DEFAULT_NODE_MIN_HEIGHT = 184;
const NODE_RADIUS = 18;
const HEADER_HEIGHT = 46;
const SECTION_PADDING_X = 18;
const SECTION_PADDING_Y = 16;
const SLOT_ROW_HEIGHT = 20;
const SLOT_ROW_GAP = 16;
const PORT_SIZE = 12;
const WIDGET_HEIGHT = 60;
const WIDGET_GAP = 12;
const WIDGET_PADDING_Y = 16;
const SIGNAL_SIZE = 8;
const SIGNAL_GLOW_SIZE = 14;
const CATEGORY_PILL_HEIGHT = 22;
const CATEGORY_PILL_MIN_WIDTH = 96;
const CATEGORY_CHAR_WIDTH = 6.2;
const SLOT_TEXT_WIDTH = 84;
const NODE_FONT_FAMILY = '"Inter", "IBM Plex Sans", "Segoe UI", sans-serif';
const CARD_FILL = "rgba(28, 28, 33, 0.76)";
const CARD_STROKE = "rgba(255, 255, 255, 0.10)";
const CARD_PRESS_FILL = "rgba(24, 24, 29, 0.86)";
const CARD_PRESS_STROKE = "rgba(59, 130, 246, 0.28)";
const HEADER_FILL = "rgba(255, 255, 255, 0.05)";
const HEADER_DIVIDER_FILL = "rgba(255, 255, 255, 0.08)";
const TITLE_FILL = "#F4F4F5";
const SLOT_LABEL_FILL = "#A1A1AA";
const CATEGORY_FILL = "rgba(255, 255, 255, 0.08)";
const CATEGORY_STROKE = "rgba(255, 255, 255, 0.05)";
const CATEGORY_TEXT_FILL = "#A1A1AA";
const WIDGET_FILL = "rgba(0, 0, 0, 0.15)";
const INPUT_PORT_FILL = "#3B82F6";
const OUTPUT_PORT_FILL = "#8B5CF6";
const GENERIC_PORT_FILL = "#94A3B8";
const LINK_STROKE = "#60A5FA";
const NODE_SELECTED_STROKE = "#2563EB";
const NODE_SIGNAL_FILL = "#94A3B8";
const MISSING_NODE_FILL = "rgba(220, 38, 38, 0.92)";
const MISSING_NODE_STROKE = "rgba(127, 29, 29, 0.86)";
const MISSING_NODE_PRESS_FILL = "rgba(185, 28, 28, 0.96)";
const MISSING_NODE_TEXT_FILL = "#FFF1F2";
const SELECTED_RING_OUTSET = 4;
const SELECTED_RING_STROKE_WIDTH = 3;
const DEFAULT_FIT_VIEW_PADDING = 64;
const VIEWPORT_MIN_SCALE = 0.2;
const VIEWPORT_MAX_SCALE = 4;

/**
 * 统一的槽位类型颜色表。
 * 当前先覆盖最常见的数据类型，未知类型仍然回退到方向默认色。
 */
const SLOT_TYPE_FILL_MAP: Readonly<Record<string, string>> = {
  number: "#3B82F6",
  float: "#3B82F6",
  int: "#2563EB",
  boolean: "#10B981",
  bool: "#10B981",
  string: "#F59E0B",
  text: "#F59E0B",
  image: "#EC4899",
  texture: "#EC4899",
  color: "#EF4444",
  vector: "#8B5CF6",
  vec2: "#8B5CF6",
  vec3: "#8B5CF6",
  vec4: "#8B5CF6",
  event: "#0EA5E9",
  exec: "#0EA5E9",
  trigger: "#0EA5E9",
  flow: "#0EA5E9"
} as const;

/**
 * 节点壳布局的统一度量参数。
 * 当前先由主包集中声明，后续可继续下沉为主题系统或节点壳配置。
 */
const NODE_SHELL_LAYOUT_METRICS = {
  defaultNodeWidth: DEFAULT_NODE_WIDTH,
  defaultNodeMinHeight: DEFAULT_NODE_MIN_HEIGHT,
  headerHeight: HEADER_HEIGHT,
  sectionPaddingX: SECTION_PADDING_X,
  sectionPaddingY: SECTION_PADDING_Y,
  slotRowHeight: SLOT_ROW_HEIGHT,
  slotRowGap: SLOT_ROW_GAP,
  portSize: PORT_SIZE,
  widgetHeight: WIDGET_HEIGHT,
  widgetGap: WIDGET_GAP,
  widgetPaddingY: WIDGET_PADDING_Y,
  categoryPillHeight: CATEGORY_PILL_HEIGHT,
  categoryPillMinWidth: CATEGORY_PILL_MIN_WIDTH,
  categoryCharWidth: CATEGORY_CHAR_WIDTH,
  slotTextWidth: SLOT_TEXT_WIDTH
} as const;

/** 根据主题模式解析节点壳渲染主题。 */
function resolveNodeShellRenderTheme(mode: LeaferGraphThemeMode): NodeShellRenderTheme {
  if (mode === "dark") {
    return {
      nodeRadius: NODE_RADIUS,
      headerHeight: HEADER_HEIGHT,
      selectedRingOutset: SELECTED_RING_OUTSET,
      selectedRingStrokeWidth: SELECTED_RING_STROKE_WIDTH,
      selectedRingOpacity: 0.92,
      cardFill: CARD_FILL,
      cardStroke: CARD_STROKE,
      cardPressFill: CARD_PRESS_FILL,
      cardPressStroke: CARD_PRESS_STROKE,
      headerFill: HEADER_FILL,
      headerDividerFill: HEADER_DIVIDER_FILL,
      titleFill: TITLE_FILL,
      titleFontFamily: NODE_FONT_FAMILY,
      titleFontSize: 13,
      titleFontWeight: "600",
      titleX: 38,
      titleY: 15,
      categoryFill: CATEGORY_FILL,
      categoryStroke: CATEGORY_STROKE,
      categoryTextFill: CATEGORY_TEXT_FILL,
      categoryFontFamily: NODE_FONT_FAMILY,
      categoryFontSize: 9.5,
      categoryFontWeight: "600",
      signalGlowX: 17,
      signalGlowY: 16,
      signalGlowSize: SIGNAL_GLOW_SIZE,
      signalGlowOpacity: 0.24,
      signalLightX: 20,
      signalLightY: 19,
      signalLightSize: SIGNAL_SIZE,
      signalHitPadding: 4,
      widgetFill: WIDGET_FILL,
      inputPortFill: INPUT_PORT_FILL,
      outputPortFill: OUTPUT_PORT_FILL,
      portStroke: CARD_FILL,
      portStrokeWidth: 2.5,
      slotLabelFill: SLOT_LABEL_FILL,
      slotLabelFontFamily: NODE_FONT_FAMILY,
      slotLabelFontSize: 11,
      slotLabelFontWeight: "500"
    };
  }

  return {
    nodeRadius: NODE_RADIUS,
    headerHeight: HEADER_HEIGHT,
    selectedRingOutset: SELECTED_RING_OUTSET,
    selectedRingStrokeWidth: SELECTED_RING_STROKE_WIDTH,
    selectedRingOpacity: 0.92,
    cardFill: "rgba(255, 255, 255, 0.96)",
    cardStroke: "rgba(148, 163, 184, 0.28)",
    cardPressFill: "rgba(248, 250, 252, 0.98)",
    cardPressStroke: "rgba(37, 99, 235, 0.28)",
    headerFill: "rgba(248, 250, 252, 0.96)",
    headerDividerFill: "rgba(148, 163, 184, 0.16)",
    titleFill: "#0F172A",
    titleFontFamily: NODE_FONT_FAMILY,
    titleFontSize: 13,
    titleFontWeight: "600",
    titleX: 38,
    titleY: 15,
    categoryFill: "rgba(241, 245, 249, 0.96)",
    categoryStroke: "rgba(203, 213, 225, 0.88)",
    categoryTextFill: "#64748B",
    categoryFontFamily: NODE_FONT_FAMILY,
    categoryFontSize: 9.5,
    categoryFontWeight: "600",
    signalGlowX: 17,
    signalGlowY: 16,
    signalGlowSize: SIGNAL_GLOW_SIZE,
    signalGlowOpacity: 0.16,
    signalLightX: 20,
    signalLightY: 19,
    signalLightSize: SIGNAL_SIZE,
    signalHitPadding: 4,
    widgetFill: "rgba(248, 250, 252, 0.92)",
    inputPortFill: INPUT_PORT_FILL,
    outputPortFill: OUTPUT_PORT_FILL,
    portStroke: "#FFFFFF",
    portStrokeWidth: 2.5,
    slotLabelFill: "#64748B",
    slotLabelFontFamily: NODE_FONT_FAMILY,
    slotLabelFontSize: 11,
    slotLabelFontWeight: "500"
  };
}

/**
 * `@leafer-in/view` 通过副作用扩展方式把 `zoom(...)` 方法挂到 Leafer 实例上。
 * TypeScript 无法自动感知这个运行时扩展，因此这里补一个最小本地类型。
 */
interface LeaferGraphZoomableTree {
  zoom(
    zoomType: unknown,
    optionsOrPadding?:
      | {
          padding?: number;
          scroll?: "x" | "y" | boolean;
          transition?: unknown;
        }
      | number,
    scroll?: "x" | "y" | boolean,
    transition?: unknown
  ): unknown;
}

/**
 * 主包当前依赖的 Leafer 宿主坐标转换能力。
 * Leafer 文档中 `getWorldPointByClient(...)` 挂在 `App / Leafer` 实例上，
 * 因此这里单独补一份最小本地类型。
 */
interface LeaferGraphCoordinateHost {
  getWorldPointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
  getPagePointByClient(
    clientPoint: { clientX: number; clientY: number },
    updateClient?: boolean
  ): { x: number; y: number };
}

/** 主包内部统一图状态容器。 */
interface GraphRuntimeState {
  nodes: Map<string, GraphNodeState>;
  links: Map<string, LeaferGraphLinkData>;
}

/** 节点当前使用的展示层属性。 */
interface GraphNodeProperties {
  subtitle?: string;
  accent?: string;
  category?: string;
  status?: string;
}

/** 已安装插件的登记信息。 */
interface InstalledPluginRecord {
  name: string;
  version?: string;
  nodeTypes: string[];
  widgetTypes: string[];
}

/** 主包当前使用的节点运行时状态别名。 */
type GraphNodeState = NodeRuntimeState & {
  properties: GraphNodeProperties;
};

type NodeViewState = LeaferGraphNodeViewState<GraphNodeState>;
type GraphLinkViewState = LeaferGraphLinkViewState<GraphNodeState>;

/**
 * 主包允许的槽位输入结构。
 * 既兼容旧的字符串数组，也兼容正式 `NodeSlotSpec`。
 */
export type LeaferGraphNodeSlotInput = string | NodeSlotSpec;

/**
 * 主包创建节点时使用的输入结构。
 * 这里保留 editor 友好的顶层 `x / y / width / height` 写法，
 * 但不再继承 demo 输入类型。
 */
export interface LeaferGraphCreateNodeInput extends GraphNodeProperties {
  id?: string;
  type: string;
  title?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: LeaferGraphNodeSlotInput[];
  outputs?: LeaferGraphNodeSlotInput[];
  widgets?: NodeRuntimeState["widgets"];
  data?: Record<string, unknown>;
}

/**
 * 主包更新节点时使用的输入结构。
 * 这一轮先聚焦“内容与布局更新”，不支持在 `updateNode(...)` 中直接修改节点 ID。
 */
export interface LeaferGraphUpdateNodeInput extends Partial<GraphNodeProperties> {
  id?: string;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
  propertySpecs?: NodePropertySpec[];
  inputs?: LeaferGraphNodeSlotInput[];
  outputs?: LeaferGraphNodeSlotInput[];
  widgets?: NodeRuntimeState["widgets"];
  data?: Record<string, unknown>;
}

/**
 * 主包移动节点时使用的位置结构。
 * 之所以单独定义成对象，而不是直接传 `(x, y)`，
 * 是为了给后续扩展吸附、来源信息、批量移动等元数据预留空间。
 */
export interface LeaferGraphMoveNodeInput {
  x: number;
  y: number;
}

/**
 * 主包调整节点尺寸时使用的输入结构。
 * 当前阶段只开放显式宽高，后续如需保留锚点或按比例缩放，再扩展额外元数据。
 */
export interface LeaferGraphResizeNodeInput {
  width: number;
  height: number;
}

/**
 * 主包对外暴露的节点 resize 约束。
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
 * 主包创建连线时使用的输入结构。
 * 当前阶段允许省略连线 ID，由宿主生成稳定可读的默认值。
 */
export interface LeaferGraphCreateLinkInput
  extends Omit<LeaferGraphLinkData, "id"> {
  id?: string;
}

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

  private readonly widgetRegistry: LeaferGraphWidgetRegistry;
  private readonly nodeRegistry: NodeRegistry;
  private readonly graphState: GraphRuntimeState = {
    nodes: new Map(),
    links: new Map()
  };
  private readonly nodeViews = new Map<string, NodeViewState>();
  private readonly linkViews: GraphLinkViewState[] = [];
  private readonly installedPlugins = new Map<string, InstalledPluginRecord>();
  private readonly widgetEditingManager: LeaferGraphWidgetEditingManager;
  private readonly widgetEditingContext: LeaferGraphWidgetEditingContext;
  private readonly nodeHost: LeaferGraphNodeHost<GraphNodeState>;
  private readonly interactionHost: LeaferGraphInteractionHost<
    GraphNodeState,
    NodeViewState
  >;
  private readonly linkHost: LeaferGraphLinkHost<GraphNodeState>;
  private readonly mutationHost: LeaferGraphMutationHost<
    GraphNodeState,
    NodeViewState
  >;
  private readonly restoreHost: LeaferGraphRestoreHost<GraphNodeState, NodeViewState>;
  private readonly widgetHost: LeaferGraphWidgetHost;
  private themeMode: LeaferGraphThemeMode;
  private widgetTheme: LeaferGraphWidgetThemeContext;
  /** 节点层级递增计数器，用于点击时把节点提升到最前面。 */
  private nodeZIndexSeed = 0;

  /** 创建图宿主，并在内部异步完成模块与插件安装。 */
  constructor(container: HTMLElement, options: LeaferGraphOptions = {}) {
    this.container = container;
    this.prepareContainer(options.fill);
    this.widgetRegistry = new LeaferGraphWidgetRegistry(createMissingWidgetRenderer());
    this.nodeRegistry = new NodeRegistry(this.widgetRegistry);
    this.themeMode = options.themeMode ?? "light";
    this.widgetTheme = {
      mode: this.themeMode,
      tokens: resolveBasicWidgetTheme(this.themeMode)
    };

    this.app = new App({
      view: container,
      fill: options.fill ?? "transparent",
      pixelSnap: true,
      usePartRender: true,
      usePartLayout: true,
      tree: {}
    });

    this.root = new Group({ name: "leafergraph-root" });
    this.linkLayer = new Group({ name: "links", hittable: false });
    this.nodeLayer = new Group({ name: "nodes" });

    this.root.add([this.linkLayer, this.nodeLayer]);
    this.app.tree.add(this.root);
    const resolvedEditing = resolveWidgetEditingOptions(
      this.themeMode,
      options.widgetEditing
    );
    this.widgetTheme = {
      mode: resolvedEditing.themeMode,
      tokens: resolveBasicWidgetTheme(resolvedEditing.themeMode)
    };
    this.widgetEditingManager = new LeaferGraphWidgetEditingManager({
      app: this.app,
      container: this.container,
      theme: this.widgetTheme,
      editing: resolvedEditing.editing
    });
    this.widgetEditingContext = this.widgetEditingManager;
    this.widgetHost = new LeaferGraphWidgetHost({
      registry: this.widgetRegistry,
      getTheme: () => this.widgetTheme,
      getEditing: () => this.widgetEditingContext,
      setNodeWidgetValue: (nodeId, widgetIndex, newValue) => {
        this.setNodeWidgetValue(nodeId, widgetIndex, newValue);
      },
      requestRender: () => {
        this.app.forceRender();
      },
      emitNodeWidgetAction: (nodeId, action, param, extra) =>
        this.emitNodeWidgetAction(nodeId, action, param, extra)
    });
    this.interactionHost = new LeaferGraphInteractionHost({
      container: this.container,
      bringNodeViewToFront: (state) => this.bringNodeViewToFront(state),
      syncNodeResizeHandleVisibility: (state) =>
        this.syncNodeResizeHandleVisibility(state),
      requestRender: () => {
        this.app.forceRender();
      },
      resolveDraggedNodeIds: (nodeId) => this.resolveDraggedNodeIds(nodeId),
      moveNodesByDelta: (positions, deltaX, deltaY) => {
        this.moveNodesByDelta(positions, deltaX, deltaY);
      },
      resizeNode: (nodeId, size) => {
        this.resizeNode(nodeId, size);
      },
      setNodeCollapsed: (nodeId, collapsed) =>
        this.setNodeCollapsed(nodeId, collapsed),
      canResizeNode: (nodeId) => this.canResizeNode(nodeId),
      getPagePointByClient: (event) => this.getPagePointByClient(event),
      getPagePointFromGraphEvent: (event) => this.getPagePointFromGraphEvent(event),
      resolveNodeSize: (state) => ({
        width: state.state.layout.width ?? DEFAULT_NODE_WIDTH,
        height: state.state.layout.height ?? DEFAULT_NODE_MIN_HEIGHT
      }),
      getNodeView: (nodeId) => this.nodeViews.get(nodeId)
    });
    this.nodeHost = new LeaferGraphNodeHost({
      nodeViews: this.nodeViews,
      nodeLayer: this.nodeLayer,
      layoutMetrics: NODE_SHELL_LAYOUT_METRICS,
      buildNodeShell: (node, shellLayout) => this.buildNodeShell(node, shellLayout),
      isMissingNodeType: (node) => this.isMissingNodeType(node),
      renderNodeWidgets: (node, widgetLayer, shellLayout) =>
        this.widgetHost.renderNodeWidgets(node, widgetLayer, shellLayout.widgets),
      destroyNodeWidgets: (state) =>
        this.widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer),
      onNodeViewCreated: (state) => {
        this.applyNodeSelectionStyles(state);
        this.bringNodeViewToFront(state);
      },
      onNodeMounted: (nodeId, state) => {
        this.interactionHost.bindNodeDragging(nodeId, state.view);
        this.interactionHost.bindNodeResize(nodeId, state);
        this.interactionHost.bindNodeCollapseToggle(nodeId, state);
      },
      onNodeRefreshed: (nodeId, state) => {
        this.interactionHost.bindNodeResize(nodeId, state);
        this.interactionHost.bindNodeCollapseToggle(nodeId, state);
        this.applyNodeSelectionStyles(state);
      }
    });
    this.linkHost = new LeaferGraphLinkHost({
      graphLinks: this.graphState.links,
      linkViews: this.linkViews,
      getNode: (nodeId) => this.graphState.nodes.get(nodeId),
      normalizeSlotIndex: (slot) => normalizeGraphLinkSlotIndex(slot),
      createLinkShape: (source, target, sourceSlot, targetSlot) =>
        this.createLinkShape(source, target, sourceSlot, targetSlot),
      addLinkShapeToLayer: (view) => this.addLinkShapeToLayer(view),
      refreshLinkPath: (link, source, target) =>
        this.refreshLinkPath(link, source, target)
    });
    this.mutationHost = new LeaferGraphMutationHost<GraphNodeState, NodeViewState>({
      nodeRegistry: this.nodeRegistry,
      graphNodes: this.graphState.nodes,
      graphLinks: this.graphState.links,
      nodeViews: this.nodeViews,
      mountNodeView: (node) => this.mountNodeView(node),
      unmountNodeView: (nodeId) => this.unmountNodeView(nodeId),
      refreshNodeView: (state) => this.refreshNodeView(state),
      mountLinkView: (link) => this.mountLinkView(link),
      removeLinkInternal: (linkId) => this.removeLinkInternal(linkId),
      updateConnectedLinks: (nodeId) => this.updateConnectedLinks(nodeId),
      updateConnectedLinksForNodes: (nodeIds) =>
        this.updateConnectedLinksForNodes(nodeIds),
      handleNodeRemoved: (nodeId) => this.interactionHost.handleNodeRemoved(nodeId),
      requestRender: () => {
        this.app.forceRender();
      },
      toSlotSpecs: (slots) => this.toSlotSpecs(slots),
      resolveNodeResizeConstraint: (node) => this.resolveNodeResizeConstraint(node)
    });
    this.restoreHost = new LeaferGraphRestoreHost<GraphNodeState, NodeViewState>({
      nodeRegistry: this.nodeRegistry,
      graphNodes: this.graphState.nodes,
      graphLinks: this.graphState.links,
      nodeViews: this.nodeViews,
      linkViews: this.linkViews,
      clearInteractionState: () => this.interactionHost.clearInteractionState(),
      resetRuntimeState: () => {
        this.nodeZIndexSeed = 0;
      },
      destroyNodeViewWidgets: (state) =>
        this.widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer),
      clearNodeLayer: () => this.nodeLayer.removeAll(),
      clearLinkLayer: () => this.linkLayer.removeAll(),
      mountNodeView: (node) => this.mountNodeView(node),
      mountLinkView: (link) => this.mountLinkView(link)
    });
    this.setupViewport();
    this.registerBuiltinWidgets();
    this.ready = this.initialize(options);
    this.ready.catch((error) => {
      console.error("[leafergraph] 初始化失败", error);
    });
  }

  /** 销毁宿主实例，并清理全部全局事件与 widget 生命周期。 */
  destroy(): void {
    for (const state of this.nodeViews.values()) {
      this.widgetHost.destroyNodeWidgets(state.widgetInstances, state.widgetLayer);
    }

    this.interactionHost.destroy();
    this.widgetEditingManager.destroy();
    this.app.destroy();
  }

  /** 安装一个外部节点插件。 */
  async use(plugin: LeaferGraphNodePlugin): Promise<void> {
    if (this.installedPlugins.has(plugin.name)) {
      return;
    }

    const nodeTypes: string[] = [];
    const widgetTypes: string[] = [];
    const recordType = (list: string[], type: string): void => {
      const safeType = type.trim();
      if (safeType && !list.includes(safeType)) {
        list.push(safeType);
      }
    };

    const context: LeaferGraphNodePluginContext = {
      sdk: NodeSDK,
      ui: LeaferUI,
      installModule: (module, options) => {
        const resolved = this.installModuleInternal(module, options);
        for (const node of resolved.nodes) {
          recordType(nodeTypes, node.type);
        }
      },
      registerNode: (definition, options) => {
        this.registerNode(definition, options);
        recordType(nodeTypes, definition.type);
      },
      registerWidget: (entry, options) => {
        this.registerWidget(entry, options);
        recordType(widgetTypes, entry.type);
      },
      hasNode: (type) => this.nodeRegistry.hasNode(type),
      hasWidget: (type) => this.widgetRegistry.hasWidget(type),
      getWidget: (type) => this.getWidget(type),
      listWidgets: () => this.listWidgets(),
      getNode: (type) => this.nodeRegistry.getNode(type),
      listNodes: () => this.nodeRegistry.listNodes()
    };

    await plugin.install(context);

    this.installedPlugins.set(plugin.name, {
      name: plugin.name,
      version: plugin.version,
      nodeTypes,
      widgetTypes
    });
  }

  /** 安装一个静态节点模块。 */
  installModule(module: NodeModule, options?: InstallNodeModuleOptions): void {
    this.installModuleInternal(module, options);
  }

  /** 注册单个节点定义。 */
  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.nodeRegistry.registerNode(definition, options);
  }

  /** 注册单个完整 Widget 条目。 */
  registerWidget(entry: LeaferGraphWidgetEntry, options?: RegisterWidgetOptions): void {
    this.widgetRegistry.registerWidget(entry, options);
  }

  /** 读取单个 Widget 条目。 */
  getWidget(type: string): LeaferGraphWidgetEntry | undefined {
    return this.widgetRegistry.getWidget(type);
  }

  /** 列出当前已注册 Widget。 */
  listWidgets(): LeaferGraphWidgetEntry[] {
    return this.widgetRegistry.listWidgets();
  }

  /** 运行时切换主包主题，并局部刷新现有节点壳与 Widget。 */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    if (this.themeMode === mode) {
      return;
    }

    this.themeMode = mode;
    this.widgetTheme = {
      mode,
      tokens: resolveBasicWidgetTheme(mode)
    };
    this.widgetEditingManager.setTheme(this.widgetTheme);

    for (const state of this.nodeViews.values()) {
      this.refreshNodeView(state);
    }

    this.updateConnectedLinksForNodes([...this.graphState.nodes.keys()]);
    this.app.forceRender();
  }

  /** 列出当前已注册节点。 */
  listNodes(): NodeDefinition[] {
    return this.nodeRegistry.listNodes();
  }

  /** 获取某个节点对应的 Leafer 视图宿主，便于挂接节点级交互。 */
  getNodeView(nodeId: string): Group | undefined {
    return this.nodeViews.get(nodeId)?.view;
  }

  /**
   * 让当前画布内容适配到可视区域内。
   * 这是对 `@leafer-in/view` 的最小封装，优先以节点视图为参考对象，
   * 避免把背景或未来的屏幕层 overlay 一起纳入适配范围。
   */
  fitView(padding = DEFAULT_FIT_VIEW_PADDING): boolean {
    const views = [...this.nodeViews.values()].map((state) => state.view);
    if (!views.length) {
      return false;
    }

    (this.app.tree as typeof this.app.tree & LeaferGraphZoomableTree).zoom(views, {
      padding
    });
    this.app.forceRender();
    return true;
  }

  /**
   * 读取一个正式可序列化节点快照。
   * 返回值直接使用 `NodeSerializeResult` 语义，供 editor 复制、持久化和外部恢复复用。
   */
  getNodeSnapshot(nodeId: string): NodeSerializeResult | undefined {
    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return serializeNode(this.nodeRegistry, node);
  }

  /**
   * 设置单个节点的选中态。
   * 当前阶段的实现尽量轻量：只更新运行时 flag，并把视觉反馈直接同步到现有图元，
   * 不触发整节点重建，从而避免菜单绑定和拖拽状态被打断。
   */
  setNodeSelected(nodeId: string, selected: boolean): boolean {
    const state = this.nodeViews.get(nodeId);
    if (!state) {
      return false;
    }

    const nextSelected = Boolean(selected);
    if (Boolean(state.state.flags.selected) === nextSelected) {
      return true;
    }

    state.state.flags.selected = nextSelected;
    this.applyNodeSelectionStyles(state);
    this.app.forceRender();
    return true;
  }

  /**
   * 设置单个节点的折叠态。
   * 折叠后节点会收缩到头部高度，并同步刷新端口锚点与关联连线。
   */
  setNodeCollapsed(nodeId: string, collapsed: boolean): boolean {
    const node = this.graphState.nodes.get(nodeId);
    const state = this.nodeViews.get(nodeId);
    if (!node || !state) {
      return false;
    }

    const nextCollapsed = Boolean(collapsed);
    if (Boolean(node.flags.collapsed) === nextCollapsed) {
      return true;
    }

    node.flags.collapsed = nextCollapsed;
    this.refreshNodeView(state);
    this.updateConnectedLinks(nodeId);
    this.app.forceRender();
    return true;
  }

  /**
   * 读取某个节点的正式 resize 约束。
   * 返回结果已经合并了节点定义中的 `resize` 配置、兼容字段和主包默认值。
   */
  getNodeResizeConstraint(
    nodeId: string
  ): LeaferGraphNodeResizeConstraint | undefined {
    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return this.resolveNodeResizeConstraint(node);
  }

  /** 判断某个节点当前是否允许显示并响应 resize 交互。 */
  canResizeNode(nodeId: string): boolean {
    return Boolean(this.getNodeResizeConstraint(nodeId)?.enabled);
  }

  /**
   * 把节点尺寸恢复到定义默认值。
   * 如果定义没有显式提供默认尺寸，则回退到主包的基础节点尺寸。
   */
  resetNodeSize(nodeId: string): NodeRuntimeState | undefined {
    const constraint = this.getNodeResizeConstraint(nodeId);
    if (!constraint?.enabled) {
      return undefined;
    }

    return this.resizeNode(nodeId, {
      width: constraint.defaultWidth,
      height: constraint.defaultHeight
    });
  }

  /**
   * 根据节点 ID 查询当前图中的所有关联连线。
   * 这一步先提供最小查询能力，方便 editor 后续接入删除、复制和选中联动。
   */
  findLinksByNode(nodeId: string): LeaferGraphLinkData[] {
    return this.mutationHost.findLinksByNode(nodeId);
  }

  /**
   * 创建一个新的节点实例并立即挂到主包场景中。
   * 当前阶段仍然接受页面层友好的节点输入结构，后续再逐步切到更正式的图模型输入。
   */
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState {
    return this.mutationHost.createNode(input);
  }

  /**
   * 删除一个节点，并同步清理它的全部关联连线与视图。
   * 这是当前阶段最小但正式的节点移除入口。
   */
  removeNode(nodeId: string): boolean {
    return this.mutationHost.removeNode(nodeId);
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
    return this.mutationHost.updateNode(nodeId, input);
  }

  /**
   * 移动一个节点到新的图坐标。
   * 现有拖拽逻辑也会统一复用这个入口，避免再出现“交互一套、正式 API 一套”的双路径。
   */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): NodeRuntimeState | undefined {
    return this.mutationHost.moveNode(nodeId, position);
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
    return this.mutationHost.resizeNode(nodeId, size);
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   * 连线端点必须指向已存在的节点，否则直接抛错，避免悄悄生成半无效状态。
   */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
    return this.mutationHost.createLink(input);
  }

  /** 删除一条既有连线。 */
  removeLink(linkId: string): boolean {
    return this.mutationHost.removeLink(linkId);
  }

  /** 执行启动期安装流程，然后渲染初始图数据。 */
  private async initialize(options: LeaferGraphOptions): Promise<void> {
    for (const module of options.modules ?? []) {
      this.installModule(module);
    }

    for (const plugin of options.plugins ?? []) {
      await this.use(plugin);
    }

    this.restoreHost.restoreGraph(options.graph);
  }

  /** 模块安装的内部统一入口。 */
  private installModuleInternal(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule {
    return installNodeModule(this.nodeRegistry, module, options);
  }

  /** 注册主包默认内建 Widget。 */
  private registerBuiltinWidgets(): void {
    const builtinWidgets = new BasicWidgetLibrary().createEntries();

    for (const entry of builtinWidgets) {
      this.registerWidget(entry, { overwrite: true });
    }
  }

  /** 规范化容器样式与背景。 */
  private prepareContainer(fill?: string): void {
    this.container.replaceChildren();
    if (!this.container.style.position) {
      this.container.style.position = "relative";
    }
    if (!this.container.style.width) {
      this.container.style.width = "100%";
    }
    if (!this.container.style.height) {
      this.container.style.height = "100%";
    }
    this.container.style.overflow = "hidden";
    this.container.style.background =
      fill ??
      [
        "radial-gradient(circle at top left, rgba(56, 189, 248, 0.20), transparent 30%)",
        "radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 28%)",
        "radial-gradient(circle at center, rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
        "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)"
      ].join(", ");
    this.container.style.backgroundSize = "auto, auto, 20px 20px, auto";
  }

  /**
   * 接入 `@leafer-in/viewport` 的最小工作区视口能力。
   * 当前阶段只打开最常用的能力：
   * 1. 鼠标滚轮 / 触控板缩放与滚动
   * 2. 按住空格或中键拖动画布
   * 3. 视口缩放范围限制
   *
   * 这里仍然把节点拖拽保留在主包自己的逻辑里，两者职责互不覆盖。
   */
  private setupViewport(): void {
    addViewport(this.app.tree, {
      zoom: {
        min: VIEWPORT_MIN_SCALE,
        max: VIEWPORT_MAX_SCALE
      },
      move: {
        holdSpaceKey: true,
        holdMiddleKey: true,
        scroll: "limit"
      }
    });
  }

  /** 将节点状态挂入节点层，并建立拖拽与视图映射。 */
  private mountNodeView(node: GraphNodeState): NodeViewState {
    return this.nodeHost.mountNodeView(node);
  }

  /** 卸载一个节点视图，同时安全销毁内部 widget 实例。 */
  private unmountNodeView(nodeId: string): NodeViewState | undefined {
    return this.nodeHost.unmountNodeView(nodeId);
  }

  /**
   * 在同一个根 Group 内重建节点壳内容。
   * 这样可以保留 editor 绑定在节点根视图上的菜单、选区和拖拽监听，
   * 同时让端口、Widget 区和 resize 句柄按最新布局重新生成。
   */
  private refreshNodeView(state: NodeViewState): void {
    this.nodeHost.refreshNodeView(state);
  }

  /** 将连线状态和连线视图一起挂入当前图。 */
  private mountLinkView(link: LeaferGraphLinkData): GraphLinkViewState | null {
    return this.linkHost.mountLinkView(link);
  }

  /** 移除一条连线的图状态和视图，供正式 API 与节点删除复用。 */
  private removeLinkInternal(linkId: string): boolean {
    return this.linkHost.removeLink(linkId);
  }

  /** 创建两个节点之间的连线图元。 */
  private createLinkShape(
    source: GraphNodeState,
    target: GraphNodeState,
    sourceSlot = 0,
    targetSlot = 0
  ): Arrow {
    const sourceWidth = source.layout.width ?? DEFAULT_NODE_WIDTH;
    const endpoints = resolveLinkEndpoints({
      sourceX: source.layout.x,
      sourceY: source.layout.y,
      sourceWidth,
      targetX: target.layout.x,
      targetY: target.layout.y,
      sourcePortY: resolveNodePortAnchorYForNode(
        source,
        "output",
        sourceSlot,
        NODE_SHELL_LAYOUT_METRICS
      ),
      targetPortY: resolveNodePortAnchorYForNode(
        target,
        "input",
        targetSlot,
        NODE_SHELL_LAYOUT_METRICS
      ),
      portSize: PORT_SIZE
    });

    return new Arrow({
      path: buildLinkPath(
        endpoints.start,
        endpoints.end,
        PORT_DIRECTION_RIGHT,
        PORT_DIRECTION_LEFT
      ),
      endArrow: "none",
      fill: "transparent",
      stroke: LINK_STROKE,
      strokeWidth: 3,
      strokeCap: "round",
      strokeJoin: "round",
      hittable: false
    });
  }

  /**
   * 将 Arrow 图元挂入连线层。
   *
   * 当前 Bun 依赖树里同时残留了 Leafer UI 的 2.0.2 / 2.0.3 类型定义，
   * 会让 `Arrow` 与 `Group.add(...)` 在 TypeScript 看来来自两套不同的类型宇宙。
   * 运行时对象本身是兼容的，因此把这次适配集中在这一处，避免把类型断言扩散出去。
   */
  private addLinkShapeToLayer(view: Arrow): void {
    this.linkLayer.add(view as unknown as Group);
  }

  /** 只更新与某个节点相连的连线，避免全量重算。 */
  private updateConnectedLinks(nodeId: string): void {
    this.linkHost.updateConnectedLinks(nodeId);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   * 多选拖拽时如果仍按单节点逐个扫描，会把同一条连线反复重算，
   * 这里统一按节点集合收敛目标范围，减少重复刷新。
   */
  private updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    this.linkHost.updateConnectedLinksForNodes(nodeIds);
  }

  /**
   * 按位移量批量移动一组选中节点，并保留它们的相对布局。
   * 该逻辑仅负责拖拽链路使用，避免 editor 为多选拖拽重复维护一套节点同步协议。
   */
  private moveNodesByDelta(
    positions: readonly GraphDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    this.mutationHost.moveNodesByDelta(positions, deltaX, deltaY);
  }

  /** 列出当前处于选中态的节点 ID。 */
  private listSelectedNodeIds(): string[] {
    const selectedNodeIds: string[] = [];

    for (const [nodeId, node] of this.graphState.nodes) {
      if (node.flags.selected) {
        selectedNodeIds.push(nodeId);
      }
    }

    return selectedNodeIds;
  }

  /**
   * 解析一次拖拽应当带上的节点集合。
   * 当前保持与常见节点编辑器一致：
   * 点击已选中的多选节点时，整体拖拽当前选区；否则只拖当前节点。
   */
  private resolveDraggedNodeIds(nodeId: string): string[] {
    const selectedNodeIds = this.listSelectedNodeIds();

    if (selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId)) {
      return selectedNodeIds;
    }

    return [nodeId];
  }

  /** 按当前节点位置重算单条连线路径，供移动和节点更新共用。 */
  private refreshLinkPath(
    link: GraphLinkViewState,
    source: GraphNodeState,
    target: GraphNodeState
  ): void {
    const sourceWidth = source.layout.width ?? DEFAULT_NODE_WIDTH;
    const endpoints = resolveLinkEndpoints({
      sourceX: source.layout.x,
      sourceY: source.layout.y,
      sourceWidth,
      targetX: target.layout.x,
      targetY: target.layout.y,
      sourcePortY: resolveNodePortAnchorYForNode(
        source,
        "output",
        link.sourceSlot,
        NODE_SHELL_LAYOUT_METRICS
      ),
      targetPortY: resolveNodePortAnchorYForNode(
        target,
        "input",
        link.targetSlot,
        NODE_SHELL_LAYOUT_METRICS
      ),
      portSize: PORT_SIZE
    });

    link.view.path = buildLinkPath(
      endpoints.start,
      endpoints.end,
      PORT_DIRECTION_RIGHT,
      PORT_DIRECTION_LEFT
    );
  }

  /** 把浏览器 client 坐标换成 Leafer page 坐标。 */
  private getPagePointByClient(event: Pick<PointerEvent, "clientX" | "clientY">): {
    x: number;
    y: number;
  } {
    return (this.app as typeof this.app & LeaferGraphCoordinateHost).getPagePointByClient(
      {
        clientX: event.clientX,
        clientY: event.clientY
      },
      true
    );
  }

  /**
   * 把 Leafer 指针事件统一转换成 page 坐标。
   * 节点布局、拖拽和 resize 都挂在 `app.tree / zoomLayer` 下，
   * 因此这类“写回节点位置”的交互必须以 page 坐标为准。
   */
  private getPagePointFromGraphEvent(
    event: LeaferGraphWidgetPointerEvent
  ): { x: number; y: number } {
    const clientX = event.origin?.clientX;
    const clientY = event.origin?.clientY;

    if (typeof clientX === "number" && typeof clientY === "number") {
      return this.getPagePointByClient({ clientX, clientY });
    }

    const eventWithPagePoint = event as LeaferGraphWidgetPointerEvent & {
      getPagePoint?: () => { x: number; y: number };
    };

    return eventWithPagePoint.getPagePoint
      ? eventWithPagePoint.getPagePoint()
      : { x: event.x, y: event.y };
  }

  /** 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。 */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    const state = this.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    this.widgetHost.updateNodeWidgetValue(
      state.state,
      widgetIndex,
      newValue,
      state.widgetInstances
    );
  }

  /**
   * 把 Widget 触发的动作转回节点生命周期 `onAction(...)`。
   * 当前先提供最小桥接能力，便于自定义 Widget 把业务语义交回节点定义处理。
   */
  private emitNodeWidgetAction(
    nodeId: string,
    action: string,
    param?: unknown,
    options?: Record<string, unknown>
  ): boolean {
    const safeAction = action.trim();
    if (!safeAction) {
      return false;
    }

    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    const definition = this.nodeRegistry.getNode(node.type);
    if (!definition?.onAction) {
      return false;
    }

    definition.onAction(
      node,
      safeAction,
      param,
      options,
      createNodeApi(node, {
        definition,
        widgetDefinitions: this.widgetRegistry
      })
    );
    this.app.forceRender();
    return true;
  }

  /** 判断节点当前类型是否已经遗失。 */
  private isMissingNodeType(node: GraphNodeState): boolean {
    return !this.nodeRegistry.hasNode(node.type);
  }

  /**
   * 为遗失节点类型创建红色占位壳。
   * 它只保留拖拽、选中和 resize 所需的最小图元，
   * 避免旧数据因节点包缺失而直接不可见。
   */
  private createMissingNodeShell(
    node: GraphNodeState,
    shellLayout: ReturnType<typeof resolveNodeShellLayout>
  ): NodeShellView {
    const selectedStroke = this.resolveSelectedNodeStroke();
    const group = new Group({
      x: node.layout.x,
      y: node.layout.y,
      name: `node-${node.id}`
    });
    const selectedRing = new Rect({
      x: -SELECTED_RING_OUTSET,
      y: -SELECTED_RING_OUTSET,
      width: shellLayout.width + SELECTED_RING_OUTSET * 2,
      height: shellLayout.height + SELECTED_RING_OUTSET * 2,
      fill: "transparent",
      stroke: selectedStroke,
      strokeWidth: SELECTED_RING_STROKE_WIDTH,
      cornerRadius: NODE_RADIUS + SELECTED_RING_OUTSET,
      opacity: 0,
      selectedStyle: {
        stroke: selectedStroke,
        opacity: 0.92
      },
      hittable: false
    });
    const card = new Rect({
      width: shellLayout.width,
      height: shellLayout.height,
      fill: MISSING_NODE_FILL,
      stroke: MISSING_NODE_STROKE,
      strokeWidth: 1,
      cornerRadius: NODE_RADIUS,
      cursor: "grab",
      pressStyle: {
        fill: MISSING_NODE_PRESS_FILL,
        stroke: MISSING_NODE_STROKE
      },
      selectedStyle: {
        stroke: selectedStroke,
        strokeWidth: 1.5
      }
    });
    const label = new LeaferUI.Text({
      x: 20,
      y: Math.max(shellLayout.height / 2 - 10, 18),
      width: Math.max(shellLayout.width - 40, 24),
      text: node.type,
      textAlign: "center",
      fill: MISSING_NODE_TEXT_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 14,
      fontWeight: "600",
      hittable: false
    });
    label.textWrap = "break";

    const hiddenHeaderDivider = new Rect({
      width: 0,
      height: 0,
      visible: false,
      fill: "transparent",
      hittable: false
    });
    const hiddenSignalButton = new Rect({
      width: 0,
      height: 0,
      visible: false,
      fill: "rgba(255, 255, 255, 0.001)"
    });
    const hiddenCategoryBadge = new Rect({
      width: 0,
      height: 0,
      visible: false,
      fill: "transparent",
      stroke: "transparent",
      hittable: false
    });
    const hiddenCategoryLabel = new LeaferUI.Text({
      text: "",
      visible: false,
      hittable: false
    });
    const widgetLayer = new Box({
      name: `widgets-${node.id}`,
      width: 0,
      height: 0,
      resizeChildren: false
    });
    const resizeHandle = new Box({
      name: `node-resize-handle-${node.id}`,
      x: shellLayout.width - 18,
      y: shellLayout.height - 18,
      width: 18,
      height: 18,
      cursor: "nwse-resize",
      visible: false
    });
    resizeHandle.add([
      new Rect({
        width: 18,
        height: 18,
        fill: "rgba(255, 255, 255, 0.001)",
        cornerRadius: 6
      }),
      new LeaferUI.Path({
        path: "M 4 14 L 14 4 M 8 14 L 14 8 M 12 14 L 14 12",
        stroke: "rgba(255, 241, 242, 0.88)",
        strokeWidth: 1.5,
        strokeCap: "round",
        strokeJoin: "round",
        hittable: false
      })
    ]);

    group.add([
      selectedRing,
      card,
      label,
      hiddenSignalButton,
      hiddenCategoryBadge,
      hiddenCategoryLabel,
      widgetLayer,
      resizeHandle
    ]);

    return {
      view: group,
      card,
      selectedRing,
      header: card,
      headerDivider: hiddenHeaderDivider,
      signalButton: hiddenSignalButton,
      categoryBadge: hiddenCategoryBadge,
      categoryLabel: hiddenCategoryLabel,
      widgetBackground: null,
      widgetDivider: null,
      resizeHandle,
      portViews: [],
      widgetLayer
    };
  }

  /**
   * 根据节点当前运行时状态构建节点壳。
   * 这里把“布局求解 + 分类徽标 + 主题色解析”收敛到一处，
   * 便于首次挂载和后续局部刷新共用同一条逻辑。
   */
  private buildNodeShell(
    node: GraphNodeState,
    shellLayout = resolveNodeShellLayout(node, NODE_SHELL_LAYOUT_METRICS)
  ): NodeShellView {
    if (this.isMissingNodeType(node)) {
      return this.createMissingNodeShell(node, shellLayout);
    }

    const category = this.resolveNodeCategory(node);
    const resolvedShellLayout = {
      ...shellLayout,
      ports: shellLayout.ports.map((port) => ({
        ...port,
        slotColor: this.resolveNodePortFill(port)
      }))
    };
    const categoryLayout = resolveNodeCategoryBadgeLayout(
      category,
      resolvedShellLayout.width,
      NODE_SHELL_LAYOUT_METRICS
    );
    const signalColor = this.resolveSignalColor(node);
    const selectedStroke = this.resolveSelectedNodeStroke();

    return createNodeShell({
      nodeId: node.id,
      x: node.layout.x,
      y: node.layout.y,
      title: node.title,
      signalColor,
      selectedStroke,
      shellLayout: resolvedShellLayout,
      categoryLayout,
      theme: resolveNodeShellRenderTheme(this.themeMode)
    });
  }

  /**
   * 将节点图元提升到当前节点层的最前面。
   * 通过递增 zIndex 来稳定排序，避免反复移除/插入子节点带来的抖动。
   */
  private bringNodeViewToFront(state: NodeViewState): void {
    this.nodeZIndexSeed += 1;
    state.view.zIndex = this.nodeZIndexSeed;
  }

  /**
   * 将运行时 `flags.selected` 同步成节点视觉状态。
   * 这里采用“外圈 ring + 卡片描边增强”的组合：
   * 1. 在亮色画布里足够清晰
   * 2. 不依赖重阴影，性能和层次都更稳定
   * 3. 不需要重建整节点视图
   */
  private applyNodeSelectionStyles(state: NodeViewState): void {
    const selected = Boolean(state.state.flags.selected);
    const ringStroke = this.resolveSelectedNodeStroke();

    state.selectedRing.selectedStyle = {
      stroke: ringStroke,
      opacity: 0.92
    };
    state.card.selectedStyle = {
      stroke: ringStroke,
      strokeWidth: 1.5
    };
    state.selectedRing.selected = selected;
    state.card.selected = selected;
    this.syncNodeResizeHandleVisibility(state);
  }

  /**
   * 统一计算 resize 图标可见性。
   * 当前规则为：
   * 1. 节点支持 resize
   * 2. 节点未折叠
   * 3. 鼠标悬停在节点上，或当前正在拖拽该节点的 resize 句柄
   */
  private syncNodeResizeHandleVisibility(state: NodeViewState): void {
    const canResize = this.canResizeNode(state.state.id);
    const visible =
      canResize &&
      !Boolean(state.state.flags.collapsed) &&
      (state.hovered || this.interactionHost.isResizingNode(state.state.id));

    state.resizeHandle.visible = visible;
  }

  /** 节点选中态统一使用固定描边色，保证整张图的焦点反馈一致。 */
  private resolveSelectedNodeStroke(): string {
    return this.themeMode === "dark" ? NODE_SELECTED_STROKE : "#2563EB";
  }

  /**
   * 解析节点 resize 约束。
   * 该结果统一吸收三类来源：
   * 1. `NodeDefinition.resize`
   * 2. 兼容字段 `minWidth / minHeight`
   * 3. 主包默认节点尺寸
   */
  private resolveNodeResizeConstraint(
    node: GraphNodeState
  ): LeaferGraphNodeResizeConstraint {
    const definition = this.nodeRegistry.getNode(node.type);
    const resize: NodeResizeConfig | undefined = definition?.resize;
    const defaultWidth = definition?.size?.[0] ?? DEFAULT_NODE_WIDTH;
    const defaultHeight = definition?.size?.[1] ?? DEFAULT_NODE_MIN_HEIGHT;
    const minWidth = resize?.minWidth ?? definition?.minWidth ?? defaultWidth;
    const minHeight = resize?.minHeight ?? definition?.minHeight ?? defaultHeight;
    const maxWidth =
      typeof resize?.maxWidth === "number" && Number.isFinite(resize.maxWidth)
        ? Math.max(minWidth, resize.maxWidth)
        : undefined;
    const maxHeight =
      typeof resize?.maxHeight === "number" && Number.isFinite(resize.maxHeight)
        ? Math.max(minHeight, resize.maxHeight)
        : undefined;
    const snap =
      typeof resize?.snap === "number" && Number.isFinite(resize.snap) && resize.snap > 0
        ? resize.snap
        : undefined;

    return {
      enabled: resize?.enabled ?? true,
      lockRatio: Boolean(resize?.lockRatio),
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      snap,
      defaultWidth,
      defaultHeight
    };
  }

  /** 解析节点分类文本。 */
  private resolveNodeCategory(node: GraphNodeState): string {
    const category = node.properties.category;

    if (typeof category === "string" && category) {
      return category;
    }

    return this.nodeRegistry.getNode(node.type)?.category ?? this.startCase(node.type);
  }

  /**
   * 解析节点端口颜色。
   * 优先级依次为：
   * 1. 槽位显式自定义色
   * 2. 槽位类型映射色
   * 3. 输入 / 输出默认色
   */
  private resolveNodePortFill(port: NodeShellPortLayout): string {
    if (typeof port.slotColor === "string" && port.slotColor) {
      return port.slotColor;
    }

    const typeColor = this.resolveSlotTypeFill(port.slotType);
    if (typeColor) {
      return typeColor;
    }

    return port.direction === "input" ? INPUT_PORT_FILL : OUTPUT_PORT_FILL;
  }

  /** 根据槽位类型查颜色；泛型槽位 `0` 使用统一中性色。 */
  private resolveSlotTypeFill(type: SlotType | undefined): string | undefined {
    if (type === 0) {
      return GENERIC_PORT_FILL;
    }

    if (typeof type !== "string") {
      return undefined;
    }

    const normalized = type.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }

    const candidates = [
      normalized,
      normalized.replace(/\[\]$/, ""),
      ...normalized.split(/[\s|,:/]+/).filter(Boolean)
    ];

    for (const candidate of candidates) {
      const color = SLOT_TYPE_FILL_MAP[candidate];
      if (color) {
        return color;
      }
    }

    return undefined;
  }

  /** 解析节点状态灯颜色。 */
  private resolveSignalColor(_node: GraphNodeState): string {
    return NODE_SIGNAL_FILL;
  }

  /**
   * 将旧字符串数组或正式槽位声明统一转换成槽位输入。
   * 这样主包可以同时兼容页面层数据和后续更正式的节点复制、导入路径。
   */
  private toSlotSpecs(slots: LeaferGraphNodeSlotInput[]): NodeSlotSpec[] {
    return slots.map((slot) =>
      typeof slot === "string"
        ? { name: slot }
        : {
            ...slot,
            data: slot.data ? structuredClone(slot.data) : undefined
          }
    );
  }

  /** 把类型名或分类名转换成更友好的首字母大写显示文本。 */
  private startCase(value: string): string {
    return value
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

/** 创建 `LeaferGraph` 的便捷工厂函数。 */
export function createLeaferGraph(
  container: HTMLElement,
  options?: LeaferGraphOptions
): LeaferGraph {
  return new LeaferGraph(container, options);
}
