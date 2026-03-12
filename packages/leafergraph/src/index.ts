import { App, Group, Rect, Text } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import { Arrow } from "@leafer-in/arrow";
import "@leafer-in/state";
import { addViewport } from "@leafer-in/viewport";
import "@leafer-in/view";
import * as NodeSDK from "@leafergraph/node";
import {
  configureNode,
  installNodeModule,
  NodeRegistry,
  createNodeState,
  serializeNode,
  type LeaferGraphData,
  type LeaferGraphLinkData,
  type LeaferGraphNodeData,
  type InstallNodeModuleOptions,
  type NodeDefinition,
  type NodeModule,
  type NodeRuntimeState,
  type NodeSerializeResult,
  type NodeSlotSpec,
  type RegisterNodeOptions,
  type RegisterWidgetOptions,
  type ResolvedNodeModule,
  type WidgetDefinition
} from "@leafergraph/node";
export { LeaferUI };
export type {
  LeaferGraphData,
  LeaferGraphLinkData,
  LeaferGraphLinkEndpoint,
  LeaferGraphNodeData
} from "@leafergraph/node";
export {
  LEAFER_GRAPH_POINTER_MENU_EVENT,
  LeaferGraphContextMenuManager,
  createLeaferGraphContextMenu
} from "./context_menu";
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
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererContext
} from "./plugin";
import type {
  LeaferGraphNodePlugin,
  LeaferGraphNodePluginContext,
  LeaferGraphOptions,
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer
} from "./plugin";
import {
  PORT_DIRECTION_LEFT,
  PORT_DIRECTION_RIGHT,
  buildLinkPath,
  resolveLinkEndpoints
} from "./link";

/**
 * 主包当前 demo 渲染实现。
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
const WIDGET_TRACK_HEIGHT = 4;
const SIGNAL_SIZE = 8;
const SIGNAL_GLOW_SIZE = 14;
const CATEGORY_PILL_HEIGHT = 22;
const CATEGORY_PILL_MIN_WIDTH = 96;
const CATEGORY_CHAR_WIDTH = 6.2;
const SLOT_TEXT_WIDTH = 84;
const NODE_FONT_FAMILY = '"Inter", "IBM Plex Sans", "Segoe UI", sans-serif';
const CARD_FILL = "rgba(28, 28, 33, 0.76)";
const CARD_STROKE = "rgba(255, 255, 255, 0.10)";
const CARD_HOVER_FILL = "rgba(32, 32, 38, 0.82)";
const CARD_HOVER_STROKE = "rgba(148, 163, 184, 0.30)";
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
const WIDGET_LABEL_FILL = "#71717A";
const WIDGET_VALUE_FILL = "#FFFFFF";
const TRACK_FILL = "rgba(255, 255, 255, 0.10)";
const INPUT_PORT_FILL = "#3B82F6";
const OUTPUT_PORT_FILL = "#8B5CF6";
const LINK_STROKE = "#60A5FA";
const DEFAULT_GRAPH_LINK_SLOT = 0;
const SELECTED_RING_OUTSET = 4;
const SELECTED_RING_STROKE_WIDTH = 3;
const DEFAULT_FIT_VIEW_PADDING = 64;
const VIEWPORT_MIN_SCALE = 0.2;
const VIEWPORT_MAX_SCALE = 4;
let graphLinkSeed = 1;

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

/** 节点视图状态，负责把运行时节点和实际 Leafer 图元绑定在一起。 */
interface NodeViewState {
  state: GraphNodeState;
  view: Group;
  card: Rect;
  selectedRing: Rect;
  widgetLayer: Group;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
}

/** 连线视图状态。 */
interface DemoLinkViewState {
  linkId: string;
  sourceId: string;
  targetId: string;
  sourceSlot: number;
  targetSlot: number;
  view: Arrow;
}

/** 主包内部统一图状态容器。 */
interface GraphRuntimeState {
  nodes: Map<string, GraphNodeState>;
  links: Map<string, LeaferGraphLinkData>;
}

/** 拖拽中的节点状态。 */
interface DemoDragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

/** 当前 demo 节点额外属性。 */
interface DemoNodeProperties {
  subtitle?: string;
  accent?: string;
  category?: string;
  status?: string;
}

/** demo widget 附加配置。 */
interface DemoWidgetOptions {
  label?: string;
  displayValue?: string;
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
  properties: DemoNodeProperties;
};

/**
 * 主包允许的槽位输入结构。
 * 既兼容旧的字符串数组，也兼容正式 `NodeSlotSpec`。
 */
export type LeaferGraphNodeSlotInput = string | NodeSlotSpec;

/**
 * 主包创建节点时使用的输入结构。
 * 当前阶段仍然沿用 `LeaferGraphNodeData` 这组过渡层字段，但允许省略 `id`，
 * 以便直接复用节点 SDK 的默认 ID 生成能力。
 */
export interface LeaferGraphCreateNodeInput
  extends Omit<LeaferGraphNodeData, "id" | "title" | "inputs" | "outputs"> {
  id?: string;
  title?: string;
  inputs?: LeaferGraphNodeSlotInput[];
  outputs?: LeaferGraphNodeSlotInput[];
}

/**
 * 主包更新节点时使用的输入结构。
 * 这一轮先聚焦“内容与布局更新”，不支持在 `updateNode(...)` 中直接修改节点 ID。
 */
export interface LeaferGraphUpdateNodeInput
  extends Partial<Omit<LeaferGraphNodeData, "id" | "inputs" | "outputs">> {
  id?: string;
  inputs?: LeaferGraphNodeSlotInput[];
  outputs?: LeaferGraphNodeSlotInput[];
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
 * 主包创建连线时使用的输入结构。
 * 当前阶段允许省略连线 ID，由宿主生成稳定可读的默认值。
 */
export interface LeaferGraphCreateLinkInput
  extends Omit<LeaferGraphLinkData, "id"> {
  id?: string;
}

const DEMO_NODE_TYPE = "demo/category-node";
const DEMO_CONTROL_WIDGET = "primary-control";

const DEFAULT_NODES: LeaferGraphNodeData[] = [
  {
    id: "texture-source",
    title: "Texture",
    subtitle: "Seeded source",
    x: 44,
    y: 112,
    accent: "#3B82F6",
    category: "Source / Image",
    status: "LIVE",
    inputs: ["Seed"],
    outputs: ["Texture"],
    controlLabel: "Exposure",
    controlValue: "1.10",
    controlProgress: 0.58
  },
  {
    id: "multiply",
    title: "Multiply",
    subtitle: "Math control",
    x: 344,
    y: 248,
    accent: "#6366F1",
    category: "Math / Float",
    status: "LIVE",
    inputs: ["A", "B"],
    outputs: ["Result"],
    controlLabel: "Factor",
    controlValue: "2.50",
    controlProgress: 0.5
  },
  {
    id: "preview",
    title: "Preview",
    subtitle: "Viewport target",
    x: 644,
    y: 130,
    accent: "#8B5CF6",
    category: "Output / View",
    status: "SYNC",
    inputs: ["Image"],
    outputs: ["Panel"],
    controlLabel: "Zoom",
    controlValue: "1.00",
    controlProgress: 0.32
  }
];

/** 主包默认内建节点定义，用于当前 demo 和回归验证。 */
const DEMO_NODE_DEFINITION: NodeDefinition = {
  type: DEMO_NODE_TYPE,
  title: "Category Node",
  category: "Demo",
  size: [DEFAULT_NODE_WIDTH, DEFAULT_NODE_MIN_HEIGHT],
  minWidth: DEFAULT_NODE_WIDTH,
  minHeight: DEFAULT_NODE_MIN_HEIGHT,
  properties: [
    { name: "subtitle", type: "string" },
    { name: "accent", type: "string", default: OUTPUT_PORT_FILL },
    { name: "category", type: "string" },
    { name: "status", type: "string", default: "READY" }
  ],
  widgets: [
    {
      type: "slider",
      name: DEMO_CONTROL_WIDGET,
      value: 0.5,
      options: { label: "Value" }
    }
  ]
};

/** 创建主包默认注册表，并预装 demo 节点。 */
function createDemoNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.registerNode(DEMO_NODE_DEFINITION);
  return registry;
}

/**
 * 为仍然只提供节点数组的旧入口补一份默认连线。
 * 这样主包内部就可以统一走正式图数据结构，而不是在渲染阶段依赖数组顺序。
 */
function createSequentialDemoLinks(
  nodes: LeaferGraphNodeData[]
): LeaferGraphLinkData[] {
  const links: LeaferGraphLinkData[] = [];

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const source = nodes[index];
    const target = nodes[index + 1];

    links.push({
      id: `demo-link:${source.id}->${target.id}:${index}`,
      source: {
        nodeId: source.id,
        slot: DEFAULT_GRAPH_LINK_SLOT
      },
      target: {
        nodeId: target.id,
        slot: DEFAULT_GRAPH_LINK_SLOT
      }
    });
  }

  return links;
}

/**
 * 归一化连线槽位序号。
 * 当前阶段未提供或非法时统一回退到第一个槽位。
 */
function normalizeLinkSlotIndex(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return DEFAULT_GRAPH_LINK_SLOT;
  }

  return Math.max(DEFAULT_GRAPH_LINK_SLOT, Math.floor(slot));
}

/** 生成默认连线 ID，保证在未显式指定时也能稳定进入图状态。 */
function createGraphLinkId(link: LeaferGraphCreateLinkInput): string {
  const sourceSlot = normalizeLinkSlotIndex(link.source.slot);
  const targetSlot = normalizeLinkSlotIndex(link.target.slot);
  const id = `link:${link.source.nodeId}:${sourceSlot}->${link.target.nodeId}:${targetSlot}:${graphLinkSeed}`;
  graphLinkSeed += 1;
  return id;
}

/**
 * 归一化并拷贝连线数据。
 * 宿主内部只保存这份标准化结果，避免外部对象后续修改直接污染运行时状态。
 */
function normalizeLinkData(link: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
  return {
    id: link.id?.trim() || createGraphLinkId(link),
    source: {
      nodeId: link.source.nodeId,
      slot: normalizeLinkSlotIndex(link.source.slot)
    },
    target: {
      nodeId: link.target.nodeId,
      slot: normalizeLinkSlotIndex(link.target.slot)
    },
    label: link.label,
    data: link.data ? structuredClone(link.data) : undefined
  };
}

/** 为对外查询返回一份安全副本，避免外部绕过正式 API 直接改内部状态。 */
function cloneLinkData(link: LeaferGraphLinkData): LeaferGraphLinkData {
  return {
    id: link.id,
    source: { ...link.source },
    target: { ...link.target },
    label: link.label,
    data: link.data ? structuredClone(link.data) : undefined
  };
}

/**
 * 创建默认 slider renderer。
 * Mount 阶段创建图元，Update 阶段只更新进度条宽度和显示值。
 */
function createSliderWidgetRenderer(): LeaferGraphWidgetRenderer {
  return ({ ui, group, node, widget, value, bounds }) => {
    const options = widget.options as DemoWidgetOptions | undefined;
    const accent = readNodeAccent(node);
    const progress = clampProgress(value);

    const label = new ui.Text({
      x: bounds.x,
      y: bounds.y + 12,
      text: (options?.label ?? widget.name).toUpperCase(),
      fill: WIDGET_LABEL_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 10,
      fontWeight: "600",
      hittable: false
    });

    const valueText = new ui.Text({
      x: bounds.x + bounds.width - 38,
      y: bounds.y + 12,
      width: 38,
      text: resolveWidgetDisplayValue(widget, progress),
      textAlign: "right",
      fill: WIDGET_VALUE_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 11,
      fontWeight: "600",
      hittable: false
    });

    const track = new ui.Rect({
      x: bounds.x,
      y: bounds.y + 36,
      width: bounds.width,
      height: WIDGET_TRACK_HEIGHT,
      fill: TRACK_FILL,
      cornerRadius: 999,
      hittable: false
    });

    const active = new ui.Rect({
      x: bounds.x,
      y: bounds.y + 36,
      width: bounds.width * progress,
      height: WIDGET_TRACK_HEIGHT,
      fill: accent,
      cornerRadius: 999,
      hittable: false
    });

    const thumb = new ui.Rect({
      x: bounds.x + bounds.width * progress - 7,
      y: bounds.y + 31,
      width: 14,
      height: 14,
      fill: accent,
      stroke: "rgba(255, 255, 255, 0.10)",
      strokeWidth: 1,
      cornerRadius: 999,
      hittable: false
    });

    group.add([label, valueText, track, active, thumb]);

    return {
      update(newValue: unknown) {
        const nextProgress = clampProgress(newValue);
        active.width = bounds.width * nextProgress;
        thumb.x = bounds.x + bounds.width * nextProgress - 7;
        valueText.text = resolveWidgetDisplayValue(widget, nextProgress);
      },
      destroy() {
        group.removeAll();
      }
    };
  };
}

/**
 * 创建一个通用的“只读值展示” renderer。
 * 当某个 Widget 没有专门 renderer 时，主包会回退到它。
 */
function createValueWidgetRenderer(): LeaferGraphWidgetRenderer {
  return ({ ui, group, widget, value, bounds }) => {
    const options = widget.options as DemoWidgetOptions | undefined;

    const label = new ui.Text({
      x: bounds.x,
      y: bounds.y + 12,
      text: (options?.label ?? widget.name).toUpperCase(),
      fill: WIDGET_LABEL_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 10,
      fontWeight: "600",
      hittable: false
    });

    const valueText = new ui.Text({
      x: bounds.x,
      y: bounds.y + 30,
      width: bounds.width,
      text: formatWidgetValue(value),
      fill: WIDGET_VALUE_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 11,
      fontWeight: "500",
      hittable: false
    });

    group.add([label, valueText]);

    return {
      update(newValue: unknown) {
        valueText.text = formatWidgetValue(newValue);
      },
      destroy() {
        group.removeAll();
      }
    };
  };
}

/** 把任意输入值压缩到 0~1 区间。 */
function clampProgress(value: unknown): number {
  const progress = typeof value === "number" ? value : Number(value ?? 0.5);
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0.5));
}

/** 根据 widget 配置和当前值生成显示文本。 */
function resolveWidgetDisplayValue(widget: { value?: unknown; options?: Record<string, unknown> }, value: unknown): string {
  const options = widget.options as DemoWidgetOptions | undefined;

  if (options?.displayValue) {
    return options.displayValue;
  }

  if (typeof value === "number") {
    return (value * 5).toFixed(2);
  }

  return formatWidgetValue(value);
}

/** 将任意 widget 值格式化为稳定字符串。 */
function formatWidgetValue(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  return JSON.stringify(value);
}

/** 读取节点强调色，未提供时回退到默认输出端口颜色。 */
function readNodeAccent(node: NodeRuntimeState): string {
  const accent = node.properties?.accent;
  return typeof accent === "string" && accent ? accent : OUTPUT_PORT_FILL;
}

/**
 * LeaferGraph 主包运行时。
 * 当前既提供插件安装入口，也负责 demo 级节点图渲染与交互。
 */
export class LeaferGraph {
  readonly container: HTMLElement;
  readonly app: App;
  readonly root: Group;
  readonly linkLayer: Group;
  readonly nodeLayer: Group;
  readonly ready: Promise<void>;

  private readonly nodeRegistry: NodeRegistry;
  private readonly graphState: GraphRuntimeState = {
    nodes: new Map(),
    links: new Map()
  };
  private readonly nodeViews = new Map<string, NodeViewState>();
  private readonly linkViews: DemoLinkViewState[] = [];
  private readonly widgetRenderers = new Map<string, LeaferGraphWidgetRenderer>();
  private readonly defaultWidgetRenderer = createValueWidgetRenderer();
  private readonly installedPlugins = new Map<string, InstalledPluginRecord>();
  private dragState: DemoDragState | null = null;
  private readonly handleWindowPointerMove = (event: PointerEvent): void => {
    if (!this.dragState) {
      return;
    }

    const point = this.getContainerPoint(event);
    this.moveNode(this.dragState.nodeId, {
      x: point.x - this.dragState.offsetX,
      y: point.y - this.dragState.offsetY
    });
    this.container.style.cursor = "grabbing";
  };
  private readonly handleWindowPointerUp = (): void => {
    if (!this.dragState) {
      return;
    }

    this.dragState = null;
    this.container.style.cursor = "";
  };

  /** 创建图宿主，并在内部异步完成模块与插件安装。 */
  constructor(container: HTMLElement, options: LeaferGraphOptions = {}) {
    this.container = container;
    this.prepareContainer(options.fill);
    this.nodeRegistry = createDemoNodeRegistry();

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
    this.setupViewport();
    window.addEventListener("pointermove", this.handleWindowPointerMove);
    window.addEventListener("pointerup", this.handleWindowPointerUp);
    window.addEventListener("pointercancel", this.handleWindowPointerUp);
    this.registerBuiltinWidgetRenderers();
    this.ready = this.initialize(options);
    this.ready.catch((error) => {
      console.error("[leafergraph] 初始化失败", error);
    });
  }

  /** 销毁宿主实例，并清理全部全局事件与 widget 生命周期。 */
  destroy(): void {
    for (const state of this.nodeViews.values()) {
      this.destroyNodeWidgets(state);
    }

    window.removeEventListener("pointermove", this.handleWindowPointerMove);
    window.removeEventListener("pointerup", this.handleWindowPointerUp);
    window.removeEventListener("pointercancel", this.handleWindowPointerUp);
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
        for (const widget of resolved.widgets) {
          recordType(widgetTypes, widget.type);
        }
      },
      registerNode: (definition, options) => {
        this.registerNode(definition, options);
        recordType(nodeTypes, definition.type);
      },
      registerWidget: (definition, options) => {
        this.registerWidget(definition, options);
        recordType(widgetTypes, definition.type);
      },
      registerWidgetRenderer: (type, renderer) => {
        this.registerWidgetRenderer(type, renderer);
      },
      hasNode: (type) => this.nodeRegistry.hasNode(type),
      hasWidget: (type) => this.nodeRegistry.widgetRegistry.has(type),
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

  /** 注册单个 Widget 定义。 */
  registerWidget(definition: WidgetDefinition, options?: RegisterWidgetOptions): void {
    this.nodeRegistry.registerWidget(definition, options);
  }

  /** 注册 Widget renderer。 */
  registerWidgetRenderer(type: string, renderer: LeaferGraphWidgetRenderer): void {
    const safeType = type.trim();

    if (!safeType) {
      throw new Error("Widget 渲染器类型不能为空");
    }

    this.widgetRenderers.set(safeType, renderer);
  }

  /** 读取 Widget renderer。 */
  getWidgetRenderer(type: string): LeaferGraphWidgetRenderer | undefined {
    return this.widgetRenderers.get(type);
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
   * 读取一个可再次传入 `createNode(...)` 的节点快照。
   * 它会主动去掉原节点 ID，避免复制或粘贴时把新节点错误地落到旧 ID 上。
   */
  getNodeSnapshot(nodeId: string): LeaferGraphCreateNodeInput | undefined {
    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    return this.toCreateNodeInput(serializeNode(this.nodeRegistry, node));
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
   * 根据节点 ID 查询当前图中的所有关联连线。
   * 这一步先提供最小查询能力，方便 editor 后续接入删除、复制和选中联动。
   */
  findLinksByNode(nodeId: string): LeaferGraphLinkData[] {
    const links: LeaferGraphLinkData[] = [];

    for (const link of this.graphState.links.values()) {
      if (link.source.nodeId === nodeId || link.target.nodeId === nodeId) {
        links.push(cloneLinkData(link));
      }
    }

    return links;
  }

  /**
   * 创建一个新的节点实例并立即挂到主包场景中。
   * 当前阶段仍然接受 demo 友好的节点输入结构，后续再逐步切到更正式的图模型输入。
   */
  createNode(input: LeaferGraphCreateNodeInput): NodeRuntimeState {
    const node = this.createGraphNodeState(input);

    if (this.graphState.nodes.has(node.id)) {
      throw new Error(`节点已存在：${node.id}`);
    }

    this.graphState.nodes.set(node.id, node);
    this.mountNodeView(node);
    this.app.forceRender();
    return node;
  }

  /**
   * 删除一个节点，并同步清理它的全部关联连线与视图。
   * 这是当前阶段最小但正式的节点移除入口。
   */
  removeNode(nodeId: string): boolean {
    if (!this.graphState.nodes.has(nodeId)) {
      return false;
    }

    for (const link of this.findLinksByNode(nodeId)) {
      this.removeLinkInternal(link.id);
    }

    this.unmountNodeView(nodeId);
    this.graphState.nodes.delete(nodeId);

    if (this.dragState?.nodeId === nodeId) {
      this.dragState = null;
      this.container.style.cursor = "";
    }

    this.app.forceRender();
    return true;
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
    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    if (input.id && input.id !== nodeId) {
      throw new Error("当前阶段暂不支持通过 updateNode() 修改节点 ID");
    }

    if (input.type && input.type !== node.type) {
      throw new Error("当前阶段暂不支持通过 updateNode() 切换节点类型");
    }

    configureNode(this.nodeRegistry, node, {
      type: node.type,
      title: input.title,
      layout: this.resolvePatchedNodeLayout(node, input),
      properties: this.resolvePatchedNodeProperties(node, input),
      inputs: input.inputs !== undefined ? this.toSlotSpecs(input.inputs) : undefined,
      outputs: input.outputs !== undefined ? this.toSlotSpecs(input.outputs) : undefined,
      widgets: this.resolvePatchedNodeWidgets(node, input),
      data: input.data
    });

    this.replaceNodeView(node);
    this.updateConnectedLinks(nodeId);
    this.app.forceRender();
    return node;
  }

  /**
   * 移动一个节点到新的图坐标。
   * 现有拖拽逻辑也会统一复用这个入口，避免再出现“交互一套、正式 API 一套”的双路径。
   */
  moveNode(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): NodeRuntimeState | undefined {
    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }

    const state = this.nodeViews.get(nodeId);
    const nextX = position.x;
    const nextY = position.y;
    if (node.layout.x === nextX && node.layout.y === nextY) {
      return node;
    }

    node.layout.x = nextX;
    node.layout.y = nextY;

    if (state) {
      state.view.x = nextX;
      state.view.y = nextY;
    }

    this.updateConnectedLinks(nodeId);
    this.app.forceRender();
    return node;
  }

  /**
   * 创建一条正式连线并加入当前图状态。
   * 连线端点必须指向已存在的节点，否则直接抛错，避免悄悄生成半无效状态。
   */
  createLink(input: LeaferGraphCreateLinkInput): LeaferGraphLinkData {
    const link = normalizeLinkData(input);

    if (this.graphState.links.has(link.id)) {
      throw new Error(`连线已存在：${link.id}`);
    }

    if (!this.graphState.nodes.has(link.source.nodeId)) {
      throw new Error(`连线起点节点不存在：${link.source.nodeId}`);
    }

    if (!this.graphState.nodes.has(link.target.nodeId)) {
      throw new Error(`连线终点节点不存在：${link.target.nodeId}`);
    }

    const state = this.mountLinkView(link);
    if (!state) {
      throw new Error(`无法创建连线视图：${link.id}`);
    }

    this.app.forceRender();
    return cloneLinkData(link);
  }

  /** 删除一条既有连线。 */
  removeLink(linkId: string): boolean {
    const removed = this.removeLinkInternal(linkId);

    if (removed) {
      this.app.forceRender();
    }

    return removed;
  }

  /** 执行启动期安装流程，然后渲染初始 demo 数据。 */
  private async initialize(options: LeaferGraphOptions): Promise<void> {
    for (const module of options.modules ?? []) {
      this.installModule(module);
    }

    for (const plugin of options.plugins ?? []) {
      await this.use(plugin);
    }

    this.renderGraph(this.resolveInitialGraphData(options));
  }

  /** 模块安装的内部统一入口。 */
  private installModuleInternal(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule {
    return installNodeModule(this.nodeRegistry, module, options);
  }

  /** 注册主包默认内建 Widget renderer。 */
  private registerBuiltinWidgetRenderers(): void {
    this.registerWidgetRenderer("slider", createSliderWidgetRenderer());
    this.registerWidgetRenderer("number", createValueWidgetRenderer());
    this.registerWidgetRenderer("string", createValueWidgetRenderer());
    this.registerWidgetRenderer("combo", createValueWidgetRenderer());
    this.registerWidgetRenderer("toggle", createValueWidgetRenderer());
    this.registerWidgetRenderer("custom", createValueWidgetRenderer());
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

  /**
   * 解析启动时的图数据。
   * 当前优先使用正式 `graph` 入口；若外部仍传入旧的 `nodes`，则自动补一份顺序连线作为兜底。
   */
  private resolveInitialGraphData(options: LeaferGraphOptions): LeaferGraphData {
    if (options.graph) {
      return {
        nodes: options.graph.nodes,
        links: options.graph.links ?? [],
        meta: options.graph.meta
      };
    }

    const nodes = options.nodes ?? DEFAULT_NODES;
    return {
      nodes,
      links: createSequentialDemoLinks(nodes)
    };
  }

  /** 根据图数据重建整个主包场景。 */
  private renderGraph(graph: LeaferGraphData): void {
    for (const state of this.nodeViews.values()) {
      this.destroyNodeWidgets(state);
    }

    this.graphState.nodes.clear();
    this.graphState.links.clear();
    this.nodeViews.clear();
    this.linkViews.length = 0;
    this.nodeLayer.removeAll();
    this.linkLayer.removeAll();

    const localNodes = graph.nodes.map((node) => this.createGraphNodeState(node));

    for (const node of localNodes) {
      this.graphState.nodes.set(node.id, node);
      this.mountNodeView(node);
    }

    for (const link of graph.links ?? []) {
      this.mountLinkView(normalizeLinkData(link));
    }
  }

  /** 将节点状态挂入节点层，并建立拖拽与视图映射。 */
  private mountNodeView(node: GraphNodeState): NodeViewState {
    const state = this.createNodeView(node);
    this.nodeViews.set(node.id, state);
    this.nodeLayer.add(state.view);
    this.bindNodeDragging(node.id, state.view);
    return state;
  }

  /** 卸载一个节点视图，同时安全销毁内部 widget 实例。 */
  private unmountNodeView(nodeId: string): NodeViewState | undefined {
    const state = this.nodeViews.get(nodeId);
    if (!state) {
      return undefined;
    }

    this.destroyNodeWidgets(state);
    state.view.remove();
    this.nodeViews.delete(nodeId);
    return state;
  }

  /** 节点内容更新后，用新的 Leafer 图元替换旧视图。 */
  private replaceNodeView(node: GraphNodeState): NodeViewState {
    this.unmountNodeView(node.id);
    return this.mountNodeView(node);
  }

  /** 将连线状态和连线视图一起挂入当前图。 */
  private mountLinkView(link: LeaferGraphLinkData): DemoLinkViewState | null {
    if (this.graphState.links.has(link.id)) {
      console.warn("[leafergraph] 跳过重复连线 ID", link.id);
      return null;
    }

    const state = this.createLinkView(link);
    if (!state) {
      return null;
    }

    this.graphState.links.set(link.id, link);
    this.linkViews.push(state);
    this.addLinkShapeToLayer(state.view);
    return state;
  }

  /** 移除一条连线的图状态和视图，供正式 API 与节点删除复用。 */
  private removeLinkInternal(linkId: string): boolean {
    const linkIndex = this.linkViews.findIndex((item) => item.linkId === linkId);

    if (linkIndex >= 0) {
      const [state] = this.linkViews.splice(linkIndex, 1);
      state.view.remove();
    }

    return this.graphState.links.delete(linkId) || linkIndex >= 0;
  }

  /**
   * 根据正式连线数据创建连线视图。
   * 当端点节点不存在时，当前阶段直接跳过并打印告警，避免半有效数据破坏整体渲染。
   */
  private createLinkView(link: LeaferGraphLinkData): DemoLinkViewState | null {
    const source = this.graphState.nodes.get(link.source.nodeId);
    const target = this.graphState.nodes.get(link.target.nodeId);
    if (!source || !target) {
      console.warn("[leafergraph] 跳过无效连线，未找到端点节点", link);
      return null;
    }

    const sourceSlot = normalizeLinkSlotIndex(link.source.slot);
    const targetSlot = normalizeLinkSlotIndex(link.target.slot);

    return {
      linkId: link.id,
      sourceId: link.source.nodeId,
      targetId: link.target.nodeId,
      sourceSlot,
      targetSlot,
      view: this.createLinkShape(source, target, sourceSlot, targetSlot)
    };
  }

  /** 创建两个节点之间的连线图元。 */
  private createLinkShape(
    source: GraphNodeState,
    target: GraphNodeState,
    sourceSlot = DEFAULT_GRAPH_LINK_SLOT,
    targetSlot = DEFAULT_GRAPH_LINK_SLOT
  ): Arrow {
    const sourceWidth = source.layout.width ?? DEFAULT_NODE_WIDTH;
    const endpoints = resolveLinkEndpoints({
      sourceX: source.layout.x,
      sourceY: source.layout.y,
      sourceWidth,
      targetX: target.layout.x,
      targetY: target.layout.y,
      sourcePortY: this.resolvePortAnchorY(source, "output", sourceSlot),
      targetPortY: this.resolvePortAnchorY(target, "input", targetSlot),
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

  /** 绑定节点拖拽交互。 */
  private bindNodeDragging(nodeId: string, view: Group): void {
    view.on("pointer.enter", () => {
      if (!this.dragState) {
        this.container.style.cursor = "grab";
      }
    });
    view.on("pointer.leave", () => {
      if (!this.dragState) {
        this.container.style.cursor = "";
      }
    });
    view.on("pointer.down", (event: { x: number; y: number }) => {
      const state = this.nodeViews.get(nodeId);
      if (!state) {
        return;
      }

      this.dragState = {
        nodeId,
        offsetX: event.x - state.state.layout.x,
        offsetY: event.y - state.state.layout.y
      };
      this.container.style.cursor = "grabbing";
    });
  }

  /** 只更新与某个节点相连的连线，避免全量重算。 */
  private updateConnectedLinks(nodeId: string): void {
    for (const link of this.linkViews) {
      if (link.sourceId !== nodeId && link.targetId !== nodeId) {
        continue;
      }

      const source = this.graphState.nodes.get(link.sourceId);
      const target = this.graphState.nodes.get(link.targetId);
      if (!source || !target) {
        continue;
      }

      this.refreshLinkPath(link, source, target);
    }
  }

  /** 按当前节点位置重算单条连线路径，供移动和节点更新共用。 */
  private refreshLinkPath(
    link: DemoLinkViewState,
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
      sourcePortY: this.resolvePortAnchorY(source, "output", link.sourceSlot),
      targetPortY: this.resolvePortAnchorY(target, "input", link.targetSlot),
      portSize: PORT_SIZE
    });

    link.view.path = buildLinkPath(
      endpoints.start,
      endpoints.end,
      PORT_DIRECTION_RIGHT,
      PORT_DIRECTION_LEFT
    );
  }

  /** 将窗口指针坐标转换为容器局部坐标。 */
  private getContainerPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  /** 更新某个节点某个 Widget 的值，并触发 renderer 的 `update`。 */
  setNodeWidgetValue(nodeId: string, widgetIndex: number, newValue: unknown): void {
    const state = this.nodeViews.get(nodeId);
    const widget = state?.state.widgets[widgetIndex];

    if (!state || !widget) {
      return;
    }

    widget.value = newValue;
    state.widgetInstances[widgetIndex]?.update?.(newValue);
    this.app.forceRender();
  }

  /** 把节点补丁中的坐标与尺寸字段整理成 `configureNode()` 可消费的布局结构。 */
  private resolvePatchedNodeLayout(
    node: GraphNodeState,
    input: LeaferGraphUpdateNodeInput
  ): GraphNodeState["layout"] | undefined {
    if (
      input.x === undefined &&
      input.y === undefined &&
      input.width === undefined &&
      input.height === undefined
    ) {
      return undefined;
    }

    return {
      x: input.x ?? node.layout.x,
      y: input.y ?? node.layout.y,
      width: input.width ?? node.layout.width,
      height: input.height ?? node.layout.height
    };
  }

  /** 合并当前属性和外部补丁，保证 demo 属性字段仍能走正式更新链路。 */
  private resolvePatchedNodeProperties(
    node: GraphNodeState,
    input: LeaferGraphUpdateNodeInput
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      ...node.properties,
      ...(input.properties ?? {})
    };

    if (input.subtitle !== undefined) {
      properties.subtitle = input.subtitle;
    }
    if (input.accent !== undefined) {
      properties.accent = input.accent;
    }
    if (input.category !== undefined) {
      properties.category = input.category;
    }
    if (input.status !== undefined) {
      properties.status = input.status;
    }

    return properties;
  }

  /**
   * 解析节点 Widget 补丁。
   * 如果外部直接传 `widgets`，则以显式输入为准；
   * 否则继续兼容 demo 节点上的 `control*` 字段更新。
   */
  private resolvePatchedNodeWidgets(
    node: GraphNodeState,
    input: LeaferGraphUpdateNodeInput
  ) {
    if (input.widgets !== undefined) {
      return input.widgets;
    }

    if (
      node.type !== DEMO_NODE_TYPE ||
      (
        input.controlLabel === undefined &&
        input.controlValue === undefined &&
        input.controlProgress === undefined
      )
    ) {
      return undefined;
    }

    const current = node.widgets[0];

    return [
      {
        type: current?.type ?? "slider",
        name: current?.name ?? DEMO_CONTROL_WIDGET,
        value: input.controlProgress ?? current?.value ?? 0.5,
        options: {
          ...(current?.options ?? {}),
          ...(input.controlLabel !== undefined ? { label: input.controlLabel } : {}),
          ...(input.controlValue !== undefined
            ? { displayValue: input.controlValue }
            : {})
        }
      }
    ];
  }

  /** 生成 demo 节点使用的默认 slider widget。 */
  private createDemoControlWidget(
    node: Pick<
      LeaferGraphCreateNodeInput,
      "controlLabel" | "controlProgress" | "controlValue"
    >
  ) {
    return {
      type: "slider" as const,
      name: DEMO_CONTROL_WIDGET,
      value: node.controlProgress ?? 0.5,
      options: {
        label: node.controlLabel ?? "Value",
        displayValue: node.controlValue
      }
    };
  }

  /** 把已序列化节点结果转换回主包 `createNode(...)` 可消费的输入结构。 */
  private toCreateNodeInput(
    data: NodeSerializeResult
  ): LeaferGraphCreateNodeInput {
    return {
      type: data.type,
      title: data.title,
      x: data.layout.x,
      y: data.layout.y,
      width: data.layout.width,
      height: data.layout.height,
      properties: data.properties,
      inputs: data.inputs,
      outputs: data.outputs,
      widgets: data.widgets,
      data: data.data
    };
  }

  /** 将页面层 demo 数据转换为真正的节点运行时实例。 */
  private createGraphNodeState(node: LeaferGraphCreateNodeInput): GraphNodeState {
    const type = node.type ?? DEMO_NODE_TYPE;
    const properties: Record<string, unknown> = {
      ...(node.properties ?? {})
    };

    if (node.subtitle !== undefined) {
      properties.subtitle = node.subtitle;
    }
    if (node.accent !== undefined) {
      properties.accent = node.accent;
    }
    if (node.category !== undefined) {
      properties.category = node.category;
    }
    if (node.status !== undefined) {
      properties.status = node.status;
    }

    return createNodeState(this.nodeRegistry, {
      id: node.id,
      type,
      title: node.title,
      layout: {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      },
      properties,
      inputs: node.inputs !== undefined ? this.toSlotSpecs(node.inputs) : undefined,
      outputs: node.outputs !== undefined ? this.toSlotSpecs(node.outputs) : undefined,
      widgets:
        node.widgets ??
        (type === DEMO_NODE_TYPE ? [this.createDemoControlWidget(node)] : undefined),
      data: node.data
    }) as GraphNodeState;
  }

  /** 根据节点运行时状态创建完整的 Leafer 节点视图。 */
  private createNodeView(node: GraphNodeState): NodeViewState {
    const width = node.layout.width ?? DEFAULT_NODE_WIDTH;
    const inputs = this.resolveInputs(node);
    const outputs = this.resolveOutputs(node);
    const height = this.resolveNodeHeight(node);
    const category = this.resolveNodeCategory(node);
    const categoryWidth = Math.max(
      CATEGORY_PILL_MIN_WIDTH,
      Math.round(category.length * CATEGORY_CHAR_WIDTH + 24)
    );
    const categoryX = width - categoryWidth - 16;
    const signalColor = this.resolveSignalColor(node);
    const selectedStroke = this.resolveSelectedNodeStroke(readNodeAccent(node));
    const hasWidgets = node.widgets.length > 0;
    const widgetTop = this.resolveWidgetTop(node);

    const group = new Group({
      x: node.layout.x,
      y: node.layout.y,
      name: `node-${node.id}`
    });

    const selectedRing = new Rect({
      x: -SELECTED_RING_OUTSET,
      y: -SELECTED_RING_OUTSET,
      width: width + SELECTED_RING_OUTSET * 2,
      height: height + SELECTED_RING_OUTSET * 2,
      fill: "transparent",
      stroke: readNodeAccent(node),
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
      width,
      height,
      fill: CARD_FILL,
      stroke: CARD_STROKE,
      strokeWidth: 1,
      cornerRadius: NODE_RADIUS,
      cursor: "grab",
      hoverStyle: {
        fill: CARD_HOVER_FILL,
        stroke: CARD_HOVER_STROKE
      },
      pressStyle: {
        fill: CARD_PRESS_FILL,
        stroke: CARD_PRESS_STROKE
      },
      selectedStyle: {
        stroke: selectedStroke,
        strokeWidth: 1.5
      }
    });

    const header = new Rect({
      width,
      height: HEADER_HEIGHT,
      fill: HEADER_FILL,
      cornerRadius: [NODE_RADIUS, NODE_RADIUS, 0, 0],
      hittable: false
    });

    const headerDivider = new Rect({
      y: HEADER_HEIGHT,
      width,
      height: 1,
      fill: HEADER_DIVIDER_FILL,
      hittable: false
    });

    const signalGlow = new Rect({
      x: 17,
      y: 16,
      width: SIGNAL_GLOW_SIZE,
      height: SIGNAL_GLOW_SIZE,
      fill: signalColor,
      opacity: 0.24,
      cornerRadius: 999,
      hittable: false
    });

    const signalLight = new Rect({
      x: 20,
      y: 19,
      width: SIGNAL_SIZE,
      height: SIGNAL_SIZE,
      fill: signalColor,
      cornerRadius: 999,
      hittable: false
    });

    const title = new Text({
      x: 38,
      y: 15,
      text: node.title,
      fill: TITLE_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 13,
      fontWeight: "600",
      hittable: false
    });

    const categoryBadge = new Rect({
      x: categoryX,
      y: 12,
      width: categoryWidth,
      height: CATEGORY_PILL_HEIGHT,
      fill: CATEGORY_FILL,
      stroke: CATEGORY_STROKE,
      strokeWidth: 1,
      cornerRadius: 999,
      hittable: false
    });

    const categoryLabel = new Text({
      x: categoryX + 12,
      y: 16,
      text: category.toUpperCase(),
      fill: CATEGORY_TEXT_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 9.5,
      fontWeight: "600",
      hittable: false
    });

    const parts = [
      card,
      header,
      headerDivider,
      signalGlow,
      signalLight,
      title,
      categoryBadge,
      categoryLabel
    ];

    if (hasWidgets) {
      parts.push(
        new Rect({
          y: widgetTop,
          width,
          height: height - widgetTop,
          fill: WIDGET_FILL,
          cornerRadius: [0, 0, NODE_RADIUS, NODE_RADIUS],
          hittable: false
        }),
        new Rect({
          y: widgetTop,
          width,
          height: 1,
          fill: HEADER_DIVIDER_FILL,
          hittable: false
        })
      );
    }

    const slotStartY = HEADER_HEIGHT + SECTION_PADDING_Y;

    for (let index = 0; index < inputs.length; index += 1) {
      const slotY = slotStartY + index * (SLOT_ROW_HEIGHT + SLOT_ROW_GAP);
      parts.push(
        new Rect({
          x: -PORT_SIZE / 2,
          y: slotY + SLOT_ROW_HEIGHT / 2 - PORT_SIZE / 2,
          width: PORT_SIZE,
          height: PORT_SIZE,
          fill: INPUT_PORT_FILL,
          stroke: CARD_FILL,
          strokeWidth: 2.5,
          cornerRadius: 999,
          hittable: false
        })
      );
      parts.push(
        new Text({
          x: SECTION_PADDING_X,
          y: slotY + 4,
          text: inputs[index],
          fill: SLOT_LABEL_FILL,
          fontFamily: NODE_FONT_FAMILY,
          fontSize: 11,
          fontWeight: "500",
          hittable: false
        })
      );
    }

    for (let index = 0; index < outputs.length; index += 1) {
      const slotY = slotStartY + index * (SLOT_ROW_HEIGHT + SLOT_ROW_GAP);
      parts.push(
        new Rect({
          x: width - PORT_SIZE / 2,
          y: slotY + SLOT_ROW_HEIGHT / 2 - PORT_SIZE / 2,
          width: PORT_SIZE,
          height: PORT_SIZE,
          fill: OUTPUT_PORT_FILL,
          stroke: CARD_FILL,
          strokeWidth: 2.5,
          cornerRadius: 999,
          hittable: false
        })
      );
      parts.push(
        new Text({
          x: width - SECTION_PADDING_X - SLOT_TEXT_WIDTH,
          y: slotY + 4,
          width: SLOT_TEXT_WIDTH,
          text: outputs[index],
          textAlign: "right",
          fill: SLOT_LABEL_FILL,
          fontFamily: NODE_FONT_FAMILY,
          fontSize: 11,
          fontWeight: "500",
          hittable: false
        })
      );
    }

    const widgetLayer = new Group({ name: `widgets-${node.id}` });
    const widgetInstances = hasWidgets ? this.renderNodeWidgets(node, widgetLayer, width) : [];

    group.add([selectedRing, ...parts, widgetLayer]);

    const state: NodeViewState = {
      state: node,
      view: group,
      card,
      selectedRing,
      widgetLayer,
      widgetInstances
    };

    this.applyNodeSelectionStyles(state);

    return state;
  }

  /** 渲染节点内部全部 Widget，并保存 renderer 返回实例。 */
  private renderNodeWidgets(
    node: GraphNodeState,
    widgetLayer: Group,
    width: number
  ): Array<LeaferGraphWidgetRenderInstance | null> {
    const instances: Array<LeaferGraphWidgetRenderInstance | null> = [];

    for (let index = 0; index < node.widgets.length; index += 1) {
      const widget = node.widgets[index];
      const group = new Group({ name: `widget-${node.id}-${index}` });
      const renderer = this.getWidgetRenderer(widget.type) ?? this.defaultWidgetRenderer;
      const bounds = this.resolveWidgetBounds(node, index, width);
      const instance = renderer({
        ui: LeaferUI,
        group,
        node,
        widget,
        value: widget.value,
        bounds
      });

      instances.push(instance ?? null);
      widgetLayer.add(group);
    }

    return instances;
  }

  /** 销毁节点内部全部 Widget 实例。 */
  private destroyNodeWidgets(state: NodeViewState): void {
    for (const instance of state.widgetInstances) {
      instance?.destroy?.();
    }

    state.widgetInstances = [];
    state.widgetLayer.removeAll();
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
    const accent = readNodeAccent(state.state);
    const ringStroke = this.resolveSelectedNodeStroke(accent);

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
  }

  /** 统一计算节点选中态的 ring 颜色，优先复用节点强调色。 */
  private resolveSelectedNodeStroke(accent: string): string {
    return accent || "#2563EB";
  }

  /** 计算节点最终高度。 */
  private resolveNodeHeight(node: GraphNodeState): number {
    const slotCount = Math.max(
      this.resolveInputs(node).length,
      this.resolveOutputs(node).length,
      1
    );
    const slotsHeight = this.resolveSlotsHeight(slotCount);
    const computedHeight =
      HEADER_HEIGHT +
      SECTION_PADDING_Y +
      slotsHeight +
      SECTION_PADDING_Y +
      this.resolveWidgetSectionHeight(node);

    return Math.max(node.layout.height ?? 0, computedHeight, DEFAULT_NODE_MIN_HEIGHT);
  }

  /**
   * 计算某个槽位在节点中的纵向锚点。
   * 当前连线系统已经开始吃正式 `link.slot` 数据，因此这里不能再只返回固定首端口位置。
   */
  private resolvePortAnchorY(
    node: GraphNodeState,
    direction: "input" | "output",
    slotIndex = DEFAULT_GRAPH_LINK_SLOT
  ): number {
    const slots = direction === "input" ? node.inputs : node.outputs;
    const safeIndex = Math.min(
      Math.max(DEFAULT_GRAPH_LINK_SLOT, slotIndex),
      Math.max(slots.length - 1, DEFAULT_GRAPH_LINK_SLOT)
    );

    return (
      HEADER_HEIGHT +
      SECTION_PADDING_Y +
      safeIndex * (SLOT_ROW_HEIGHT + SLOT_ROW_GAP) +
      SLOT_ROW_HEIGHT / 2
    );
  }

  /** 计算槽位区域高度。 */
  private resolveSlotsHeight(slotCount: number): number {
    if (slotCount <= 1) {
      return SLOT_ROW_HEIGHT;
    }

    return slotCount * SLOT_ROW_HEIGHT + (slotCount - 1) * SLOT_ROW_GAP;
  }

  /** 提取输入槽位显示文本。 */
  private resolveInputs(node: GraphNodeState): string[] {
    return node.inputs.length
      ? node.inputs.map((input) => input.label ?? input.name)
      : ["Input"];
  }

  /** 提取输出槽位显示文本。 */
  private resolveOutputs(node: GraphNodeState): string[] {
    return node.outputs.length
      ? node.outputs.map((output) => output.label ?? output.name)
      : ["Output"];
  }

  /** 计算 Widget 区块总高度。 */
  private resolveWidgetSectionHeight(node: GraphNodeState): number {
    return node.widgets.length * WIDGET_HEIGHT;
  }

  /** 计算 Widget 区域起始 Y 坐标。 */
  private resolveWidgetTop(node: GraphNodeState): number {
    const slotCount = Math.max(
      this.resolveInputs(node).length,
      this.resolveOutputs(node).length,
      1
    );

    return HEADER_HEIGHT + SECTION_PADDING_Y + this.resolveSlotsHeight(slotCount) + SECTION_PADDING_Y;
  }

  /** 计算单个 Widget 的布局边界。 */
  private resolveWidgetBounds(
    node: GraphNodeState,
    widgetIndex: number,
    width: number
  ): LeaferGraphWidgetBounds {
    return {
      x: SECTION_PADDING_X,
      y: this.resolveWidgetTop(node) + widgetIndex * WIDGET_HEIGHT,
      width: width - SECTION_PADDING_X * 2,
      height: WIDGET_HEIGHT
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

  /** 解析节点状态灯颜色。 */
  private resolveSignalColor(node: GraphNodeState): string {
    switch ((node.properties.status ?? "READY").toUpperCase()) {
      case "LIVE":
      case "RUNNING":
        return "#34D399";
      case "SYNC":
        return "#60A5FA";
      case "ERROR":
        return "#F87171";
      case "WARN":
      case "WARNING":
        return "#FBBF24";
      default:
        return readNodeAccent(node);
    }
  }

  /**
   * 将旧字符串数组或正式槽位声明统一转换成槽位输入。
   * 这样主包可以同时兼容 demo 数据和后续更正式的节点复制、导入路径。
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
