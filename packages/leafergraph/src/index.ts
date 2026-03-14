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
  configureNode,
  installNodeModule,
  NodeRegistry,
  createNodeApi,
  createNodeState,
  serializeNode,
  type LeaferGraphData,
  type LeaferGraphLinkData,
  type LeaferGraphNodeData,
  type InstallNodeModuleOptions,
  type NodeDefinition,
  type NodeResizeConfig,
  type NodeModule,
  type NodeRuntimeState,
  type NodeSerializeResult,
  type NodeSlotSpec,
  type SlotType,
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
  LeaferGraphWidgetBounds,
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererContext
} from "./plugin";
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
  LeaferGraphWidgetRenderInstance,
  LeaferGraphWidgetRenderer
} from "./plugin";
import {
  PORT_DIRECTION_LEFT,
  PORT_DIRECTION_RIGHT,
  buildLinkPath,
  resolveLinkEndpoints
} from "./link";
import {
  resolveNodeCategoryBadgeLayout,
  resolveNodeShellLayout
} from "./node_layout";
import {
  resolveNodePortAnchorYForNode,
  type NodeShellPortLayout
} from "./node_port";
import { createNodeShell, type NodeShellView } from "./node_shell";
import {
  LEAFER_GRAPH_WIDGET_HIT_AREA_NAME,
  bindLinearWidgetDrag,
  bindPressWidgetInteraction,
  isWidgetInteractionTarget,
  type LeaferGraphWidgetPointerEvent
} from "./widget_interaction";

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
const WIDGET_GAP = 12;
const WIDGET_PADDING_Y = 16;
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
const GENERIC_PORT_FILL = "#94A3B8";
const LINK_STROKE = "#60A5FA";
const NODE_SELECTED_STROKE = "#2563EB";
const NODE_SIGNAL_FILL = "#94A3B8";
const DEFAULT_GRAPH_LINK_SLOT = 0;
const SELECTED_RING_OUTSET = 4;
const SELECTED_RING_STROKE_WIDTH = 3;
const DEFAULT_FIT_VIEW_PADDING = 64;
const VIEWPORT_MIN_SCALE = 0.2;
const VIEWPORT_MAX_SCALE = 4;
let graphLinkSeed = 1;

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

/**
 * 节点壳渲染主题。
 * 当前仍由主包直接持有，目的是先把“布局计算”和“图元创建”从大文件主体逻辑中拆开。
 */
const NODE_SHELL_RENDER_THEME = {
  nodeRadius: NODE_RADIUS,
  headerHeight: HEADER_HEIGHT,
  selectedRingOutset: SELECTED_RING_OUTSET,
  selectedRingStrokeWidth: SELECTED_RING_STROKE_WIDTH,
  selectedRingOpacity: 0.92,
  cardFill: CARD_FILL,
  cardStroke: CARD_STROKE,
  cardHoverFill: CARD_HOVER_FILL,
  cardHoverStroke: CARD_HOVER_STROKE,
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
} as const;

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

/** 节点视图状态，负责把运行时节点和实际 Leafer 图元绑定在一起。 */
interface NodeViewState {
  state: GraphNodeState;
  view: Group;
  card: Rect;
  selectedRing: Rect;
  widgetLayer: Box;
  resizeHandle: Box;
  shellView: NodeShellView;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
  hovered: boolean;
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

/** 多选拖拽时记录的单个节点初始位置。 */
interface DemoDragNodePosition {
  nodeId: string;
  startX: number;
  startY: number;
}

/** 拖拽中的节点状态。 */
interface DemoDragState {
  anchorNodeId: string;
  offsetX: number;
  offsetY: number;
  anchorStartX: number;
  anchorStartY: number;
  nodes: DemoDragNodePosition[];
}

/** 拖拽 resize 句柄时的节点缩放状态。 */
interface DemoResizeState {
  nodeId: string;
  startWidth: number;
  startHeight: number;
  startPageX: number;
  startPageY: number;
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
  onText?: string;
  offText?: string;
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
    inputs: [{ name: "Seed", type: "number" }],
    outputs: [{ name: "Texture", type: "image" }],
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
    inputs: [
      { name: "A", type: "float" },
      { name: "B", type: "float" }
    ],
    outputs: [{ name: "Result", type: "float" }],
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
    inputs: [{ name: "Image", type: "image" }],
    outputs: [{ name: "Panel", type: "event" }],
    widgets: [
      {
        type: "slider",
        name: DEMO_CONTROL_WIDGET,
        value: 0.32,
        options: {
          label: "Zoom",
          displayValue: "1.00"
        }
      },
      {
        type: "toggle",
        name: "live-preview",
        value: true,
        options: {
          label: "Live Preview",
          onText: "ON",
          offText: "OFF"
        }
      }
    ]
  }
];

/** 主包默认内建节点定义，用于当前 demo 和回归验证。 */
const DEMO_NODE_DEFINITION: NodeDefinition = {
  type: DEMO_NODE_TYPE,
  title: "Category Node",
  category: "Demo",
  size: [DEFAULT_NODE_WIDTH, DEFAULT_NODE_MIN_HEIGHT],
  resize: {
    enabled: true,
    minWidth: DEFAULT_NODE_WIDTH,
    minHeight: DEFAULT_NODE_MIN_HEIGHT,
    snap: 4
  },
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

/** 把任意输入约束成有限数字；非法时回退到给定值。 */
function coerceFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 将值限制在给定区间内；未提供最大值时只做下界限制。 */
function clampToRange(value: number, min: number, max?: number): number {
  if (typeof max === "number" && Number.isFinite(max)) {
    return Math.min(Math.max(value, min), max);
  }

  return Math.max(value, min);
}

/** 按给定步长做吸附；非法或非正数步长会直接返回原值。 */
function snapToStep(value: number, step?: number): number {
  if (typeof step !== "number" || !Number.isFinite(step) || step <= 0) {
    return value;
  }

  return Math.round(value / step) * step;
}

/**
 * 创建默认 slider renderer。
 * Mount 阶段创建图元，Update 阶段只更新进度条宽度和显示值。
 */
function createSliderWidgetRenderer(): LeaferGraphWidgetRenderer {
  return ({ ui, group, node, widget, value, bounds, setValue }) => {
    const options = widget.options as DemoWidgetOptions | undefined;
    const accent = readNodeAccent(node);
    const progress = clampProgress(value);
    let useStaticDisplayValue = typeof options?.displayValue === "string";

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

    const hitArea = new ui.Rect({
      name: LEAFER_GRAPH_WIDGET_HIT_AREA_NAME,
      x: bounds.x,
      y: bounds.y + 24,
      width: bounds.width,
      height: 26,
      fill: "rgba(255, 255, 255, 0.001)",
      cornerRadius: 999,
      cursor: "ew-resize"
    });

    /**
     * 统一同步 slider 的视觉结果。
     * 这里单独抽出来，便于 Mount / Update / 交互回写复用同一套展示逻辑。
     */
    const applyProgress = (nextProgress: number): void => {
      active.width = bounds.width * nextProgress;
      thumb.x = bounds.x + bounds.width * nextProgress - 7;
      valueText.text = useStaticDisplayValue
        ? options?.displayValue ?? ""
        : resolveWidgetDisplayValue(
            {
              ...widget,
              options: {
                ...(widget.options ?? {}),
                displayValue: undefined
              }
            },
            nextProgress
          );
    };
    const interaction = bindLinearWidgetDrag({
      hitArea,
      group,
      bounds,
      getNodeX: () => node.layout.x,
      onValue(nextProgress) {
        useStaticDisplayValue = false;
        setValue(nextProgress);
      }
    });

    group.add([label, valueText, track, active, thumb]);
    group.add(hitArea);
    applyProgress(progress);

    return {
      update(newValue: unknown) {
        const nextProgress = clampProgress(newValue);
        if (useStaticDisplayValue && nextProgress !== progress) {
          useStaticDisplayValue = false;
        }
        applyProgress(nextProgress);
      },
      destroy() {
        interaction.destroy();
        group.removeAll();
      }
    };
  };
}

/**
 * 创建默认 toggle renderer。
 * 它作为第二种正式交互件，用来验证“按压触发型 Widget”也能复用统一宿主交互层。
 */
function createToggleWidgetRenderer(): LeaferGraphWidgetRenderer {
  return ({ ui, group, node, widget, value, bounds, setValue }) => {
    const options = widget.options as DemoWidgetOptions | undefined;
    const accent = readNodeAccent(node);
    let checked = Boolean(value);
    const switchWidth = 42;
    const switchHeight = 22;
    const switchX = bounds.x + bounds.width - switchWidth;
    const switchY = bounds.y + 27;

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

    const stateText = new ui.Text({
      x: bounds.x,
      y: bounds.y + 33,
      text: resolveToggleDisplayValue(checked, options),
      fill: checked ? accent : SLOT_LABEL_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 11,
      fontWeight: "600",
      hittable: false
    });

    const track = new ui.Rect({
      x: switchX,
      y: switchY,
      width: switchWidth,
      height: switchHeight,
      fill: checked ? accent : TRACK_FILL,
      stroke: checked ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.10)",
      strokeWidth: 1,
      cornerRadius: 999,
      hittable: false
    });

    const thumb = new ui.Rect({
      x: switchX + (checked ? switchWidth - 20 : 2),
      y: switchY + 2,
      width: 18,
      height: 18,
      fill: "#FFFFFF",
      stroke: "rgba(15, 23, 42, 0.08)",
      strokeWidth: 1,
      cornerRadius: 999,
      hittable: false
    });

    const hitArea = new ui.Rect({
      name: LEAFER_GRAPH_WIDGET_HIT_AREA_NAME,
      x: bounds.x,
      y: bounds.y + 24,
      width: bounds.width,
      height: 28,
      fill: "rgba(255, 255, 255, 0.001)",
      cornerRadius: 999,
      cursor: "pointer"
    });

    const applyChecked = (nextChecked: boolean): void => {
      checked = nextChecked;
      stateText.text = resolveToggleDisplayValue(nextChecked, options);
      stateText.fill = nextChecked ? accent : SLOT_LABEL_FILL;
      track.fill = nextChecked ? accent : TRACK_FILL;
      track.stroke = nextChecked
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(255, 255, 255, 0.10)";
      thumb.x = switchX + (nextChecked ? switchWidth - 20 : 2);
    };

    const interaction = bindPressWidgetInteraction({
      hitArea,
      onPress() {
        setValue(!checked);
      }
    });

    group.add([label, stateText, track, thumb, hitArea]);
    applyChecked(checked);

    return {
      update(newValue: unknown) {
        applyChecked(Boolean(newValue));
      },
      destroy() {
        interaction.destroy();
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

/** 根据 toggle 当前状态生成展示文本。 */
function resolveToggleDisplayValue(
  checked: boolean,
  options?: DemoWidgetOptions
): string {
  return checked ? options?.onText ?? "ON" : options?.offText ?? "OFF";
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
  private resizeState: DemoResizeState | null = null;
  private readonly handleWindowPointerMove = (event: PointerEvent): void => {
    if (this.resizeState) {
      const point = this.getPagePointByClient(event);
      const width = this.resizeState.startWidth + (point.x - this.resizeState.startPageX);
      const height = this.resizeState.startHeight + (point.y - this.resizeState.startPageY);

      this.resizeNode(this.resizeState.nodeId, { width, height });
      this.container.style.cursor = "nwse-resize";
      return;
    }

    if (!this.dragState) {
      return;
    }

    const point = this.getPagePointByClient(event);
    const anchorX = point.x - this.dragState.offsetX;
    const anchorY = point.y - this.dragState.offsetY;
    const deltaX = anchorX - this.dragState.anchorStartX;
    const deltaY = anchorY - this.dragState.anchorStartY;

    this.moveNodesByDelta(this.dragState.nodes, deltaX, deltaY);
    this.container.style.cursor = "grabbing";
  };
  private readonly handleWindowPointerUp = (): void => {
    const resizeNodeId = this.resizeState?.nodeId;
    const dragNodeId = this.dragState?.anchorNodeId;

    if (this.resizeState) {
      this.resizeState = null;
      this.container.style.cursor = "";
    }

    if (this.dragState) {
      this.dragState = null;
      this.container.style.cursor = "";
    }

    if (resizeNodeId) {
      const state = this.nodeViews.get(resizeNodeId);
      if (state) {
        this.syncNodeResizeHandleVisibility(state);
      }
    }

    if (dragNodeId && dragNodeId !== resizeNodeId) {
      const state = this.nodeViews.get(dragNodeId);
      if (state) {
        this.syncNodeResizeHandleVisibility(state);
      }
    }
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

    this.dragState = null;
    this.resizeState = null;
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

    if (this.dragState?.nodes.some((item) => item.nodeId === nodeId)) {
      this.dragState = null;
      this.container.style.cursor = "";
    }
    if (this.resizeState?.nodeId === nodeId) {
      this.resizeState = null;
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

    const state = this.nodeViews.get(nodeId);

    if (state) {
      this.refreshNodeView(state);
    } else {
      this.mountNodeView(node);
    }

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

    if (!this.moveNodeInternally(nodeId, position)) {
      return node;
    }

    this.updateConnectedLinksForNodes([nodeId]);
    this.app.forceRender();
    return node;
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
    const node = this.graphState.nodes.get(nodeId);
    const state = this.nodeViews.get(nodeId);

    if (!node || !state) {
      return node;
    }

    const constraint = this.resolveNodeResizeConstraint(node);
    if (!constraint.enabled) {
      return node;
    }

    const currentWidth = node.layout.width ?? constraint.defaultWidth;
    const currentHeight = node.layout.height ?? constraint.defaultHeight;
    let nextWidth = coerceFiniteNumber(size.width, currentWidth);
    let nextHeight = coerceFiniteNumber(size.height, currentHeight);

    if (constraint.lockRatio) {
      const ratio =
        constraint.defaultHeight > 0
          ? constraint.defaultWidth / constraint.defaultHeight
          : currentHeight > 0
            ? currentWidth / currentHeight
            : 1;
      const widthDelta = Math.abs(nextWidth - currentWidth);
      const heightDelta = Math.abs(nextHeight - currentHeight);
      const widthDriven = widthDelta >= heightDelta;

      if (widthDriven) {
        nextHeight = nextWidth / ratio;
      } else {
        nextWidth = nextHeight * ratio;
      }
    }

    nextWidth = snapToStep(nextWidth, constraint.snap);
    nextHeight = snapToStep(nextHeight, constraint.snap);

    nextWidth = clampToRange(
      nextWidth,
      constraint.minWidth,
      constraint.maxWidth
    );
    nextHeight = clampToRange(
      nextHeight,
      constraint.minHeight,
      constraint.maxHeight
    );

    if (node.layout.width === nextWidth && node.layout.height === nextHeight) {
      return node;
    }

    node.layout.width = Math.round(nextWidth);
    node.layout.height = Math.round(nextHeight);
    this.refreshNodeView(state);
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
    this.registerWidgetRenderer("toggle", createToggleWidgetRenderer());
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

    this.dragState = null;
    this.resizeState = null;
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
    this.bindNodeResize(node.id, state);
    this.bindNodeCollapseToggle(node.id, state);
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

  /**
   * 在同一个根 Group 内重建节点壳内容。
   * 这样可以保留 editor 绑定在节点根视图上的菜单、选区和拖拽监听，
   * 同时让端口、Widget 区和 resize 句柄按最新布局重新生成。
   */
  private refreshNodeView(state: NodeViewState): void {
    const shellLayout = resolveNodeShellLayout(
      state.state,
      NODE_SHELL_LAYOUT_METRICS
    );
    const nextShellView = this.buildNodeShell(state.state, shellLayout);
    const nextChildren = [...nextShellView.view.children];

    this.destroyNodeWidgets(state);
    state.view.x = state.state.layout.x;
    state.view.y = state.state.layout.y;
    state.view.name = nextShellView.view.name;
    state.view.removeAll();
    state.view.add(nextChildren as unknown as Group[]);

    state.card = nextShellView.card;
    state.selectedRing = nextShellView.selectedRing;
    state.widgetLayer = nextShellView.widgetLayer;
    state.resizeHandle = nextShellView.resizeHandle;
    state.shellView = nextShellView;
    state.widgetInstances = shellLayout.hasWidgets
      ? this.renderNodeWidgets(state.state, nextShellView.widgetLayer, shellLayout)
      : [];

    this.bindNodeResize(state.state.id, state);
    this.bindNodeCollapseToggle(state.state.id, state);
    this.applyNodeSelectionStyles(state);
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

  /**
   * 启动一次节点拖拽。
   * 它会记录锚点节点与当前拖拽成员的初始坐标，
   * 供窗口级 `pointermove` 统一换算出整组选区的新位置。
   */
  private startNodeDrag(
    nodeId: string,
    state: NodeViewState,
    event: LeaferGraphWidgetPointerEvent
  ): void {
    const point = this.getPagePointFromGraphEvent(event);
    const anchorStartX = state.state.layout.x;
    const anchorStartY = state.state.layout.y;
    const draggedNodeIds = this.resolveDraggedNodeIds(nodeId);

    this.resizeState = null;
    this.dragState = {
      anchorNodeId: nodeId,
      offsetX: point.x - anchorStartX,
      offsetY: point.y - anchorStartY,
      anchorStartX,
      anchorStartY,
      nodes: draggedNodeIds.map((draggedNodeId) => {
        const node = this.graphState.nodes.get(draggedNodeId);

        return {
          nodeId: draggedNodeId,
          startX: node?.layout.x ?? 0,
          startY: node?.layout.y ?? 0
        };
      })
    };
    this.container.style.cursor = "grabbing";
  }

  /** 绑定节点拖拽交互。 */
  private bindNodeDragging(nodeId: string, view: Group): void {
    view.on("pointer.enter", (event: LeaferGraphWidgetPointerEvent) => {
      const state = this.nodeViews.get(nodeId);
      if (state) {
        state.hovered = true;
        this.syncNodeResizeHandleVisibility(state);
      }

      if (
        !this.dragState &&
        !this.resizeState &&
        !this.isResizeHandleTarget(event.target)
      ) {
        this.container.style.cursor = "grab";
      }
    });
    view.on("pointer.leave", () => {
      const state = this.nodeViews.get(nodeId);
      if (state) {
        state.hovered = false;
        this.syncNodeResizeHandleVisibility(state);
      }

      if (!this.dragState && !this.resizeState) {
        this.container.style.cursor = "";
      }
    });
    view.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      const state = this.nodeViews.get(nodeId);
      if (
        event.right ||
        event.middle ||
        isWidgetInteractionTarget(event.target) ||
        this.isResizeHandleTarget(event.target) ||
        (state && this.isResizeHandleHit(event, state))
      ) {
        return;
      }

      if (!state) {
        return;
      }

      this.startNodeDrag(nodeId, state, event);
    });
  }

  /**
   * 绑定节点右下角 resize 句柄。
   * 当前先做最小自定义实现，不直接缩放整个 Group，
   * 而是把拖拽结果写回节点布局尺寸，再走局部刷新。
   */
  private bindNodeResize(nodeId: string, state: NodeViewState): void {
    if (!this.canResizeNode(nodeId)) {
      return;
    }

    state.resizeHandle.on("pointer.down", (event: LeaferGraphWidgetPointerEvent) => {
      const node = this.graphState.nodes.get(nodeId);
      if (!node) {
        return;
      }

      event.stopNow?.();
      event.stop?.();
      this.dragState = null;
      const point = this.getPagePointFromGraphEvent(event);
      this.resizeState = {
        nodeId,
        startWidth: node.layout.width ?? DEFAULT_NODE_WIDTH,
        startHeight: node.layout.height ?? DEFAULT_NODE_MIN_HEIGHT,
        startPageX: point.x,
        startPageY: point.y
      };
      this.syncNodeResizeHandleVisibility(state);
      this.container.style.cursor = "nwse-resize";
    });
  }

  /**
   * 绑定左上角信号球的折叠开关。
   * 这里直接在 `pointer.down` 阶段消费事件，避免它被根节点拖拽逻辑抢走。
   */
  private bindNodeCollapseToggle(nodeId: string, state: NodeViewState): void {
    state.shellView.signalButton.on(
      "pointer.down",
      (event: LeaferGraphWidgetPointerEvent) => {
        event.stopNow?.();
        event.stop?.();
        this.dragState = null;
        this.resizeState = null;
        this.container.style.cursor = "";
        this.setNodeCollapsed(nodeId, !Boolean(state.state.flags.collapsed));
      }
    );
  }

  /** 只更新与某个节点相连的连线，避免全量重算。 */
  private updateConnectedLinks(nodeId: string): void {
    this.updateConnectedLinksForNodes([nodeId]);
  }

  /**
   * 批量刷新与一组节点相关的连线。
   * 多选拖拽时如果仍按单节点逐个扫描，会把同一条连线反复重算，
   * 这里统一按节点集合收敛目标范围，减少重复刷新。
   */
  private updateConnectedLinksForNodes(nodeIds: readonly string[]): void {
    if (!nodeIds.length) {
      return;
    }

    const nodeIdSet = new Set(nodeIds);

    for (const link of this.linkViews) {
      if (!nodeIdSet.has(link.sourceId) && !nodeIdSet.has(link.targetId)) {
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

  /**
   * 只回写节点坐标本身，不直接触发整批渲染。
   * `moveNode(...)` 和多选拖拽都会先走这条最小路径，再决定是否统一刷新连线。
   */
  private moveNodeInternally(
    nodeId: string,
    position: LeaferGraphMoveNodeInput
  ): boolean {
    const node = this.graphState.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    const nextX = position.x;
    const nextY = position.y;
    if (node.layout.x === nextX && node.layout.y === nextY) {
      return false;
    }

    node.layout.x = nextX;
    node.layout.y = nextY;

    const state = this.nodeViews.get(nodeId);
    if (state) {
      state.view.x = nextX;
      state.view.y = nextY;
    }

    return true;
  }

  /**
   * 按位移量批量移动一组选中节点，并保留它们的相对布局。
   * 该逻辑仅负责拖拽链路使用，避免 editor 为多选拖拽重复维护一套节点同步协议。
   */
  private moveNodesByDelta(
    positions: readonly DemoDragNodePosition[],
    deltaX: number,
    deltaY: number
  ): void {
    const movedNodeIds: string[] = [];

    for (const item of positions) {
      if (
        this.moveNodeInternally(item.nodeId, {
          x: item.startX + deltaX,
          y: item.startY + deltaY
        })
      ) {
        movedNodeIds.push(item.nodeId);
      }
    }

    if (!movedNodeIds.length) {
      return;
    }

    this.updateConnectedLinksForNodes(movedNodeIds);
    this.app.forceRender();
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

  /**
   * 判断当前事件命中是否来自节点 resize 句柄。
   * 这样可以避免根节点拖拽监听误把 resize 手势识别成移动节点。
   */
  private isResizeHandleTarget(
    target: LeaferGraphWidgetPointerEvent["target"]
  ): boolean {
    let current = target;

    while (current) {
      if ((current.name ?? "").startsWith("node-resize-handle-")) {
        return true;
      }
      current = current.parent ?? null;
    }

    return false;
  }

  /**
   * 通过节点局部坐标兜底判断一次按下是否命中了 resize 热区。
   * 有些 Leafer 事件在冒泡到根 Group 时，`target` 可能已经不是句柄本身，
   * 因此这里再补一层几何判断，避免 resize 和拖拽同时起效。
   */
  private isResizeHandleHit(
    event: LeaferGraphWidgetPointerEvent,
    state: NodeViewState
  ): boolean {
    const width = state.state.layout.width ?? DEFAULT_NODE_WIDTH;
    const height = state.state.layout.height ?? DEFAULT_NODE_MIN_HEIGHT;
    const point = this.getPagePointFromGraphEvent(event);
    const localX = point.x - state.state.layout.x;
    const localY = point.y - state.state.layout.y;

    return localX >= width - 20 && localY >= height - 20;
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
    const widget = state?.state.widgets[widgetIndex];

    if (!state || !widget) {
      return;
    }

    widget.value = newValue;
    state.widgetInstances[widgetIndex]?.update?.(newValue);
    this.app.forceRender();
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
        widgetRegistry: this.nodeRegistry.widgetRegistry
      })
    );
    this.app.forceRender();
    return true;
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

  /**
   * 根据节点当前运行时状态构建节点壳。
   * 这里把“布局求解 + 分类徽标 + 主题色解析”收敛到一处，
   * 便于首次挂载和后续局部刷新共用同一条逻辑。
   */
  private buildNodeShell(
    node: GraphNodeState,
    shellLayout = resolveNodeShellLayout(node, NODE_SHELL_LAYOUT_METRICS)
  ): NodeShellView {
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
      theme: NODE_SHELL_RENDER_THEME
    });
  }

  /** 根据节点运行时状态创建完整的 Leafer 节点视图。 */
  private createNodeView(node: GraphNodeState): NodeViewState {
    const shellLayout = resolveNodeShellLayout(node, NODE_SHELL_LAYOUT_METRICS);
    const shellView = this.buildNodeShell(node, shellLayout);
    const widgetInstances = shellLayout.hasWidgets
      ? this.renderNodeWidgets(node, shellView.widgetLayer, shellLayout)
      : [];

    const state: NodeViewState = {
      state: node,
      view: shellView.view,
      card: shellView.card,
      selectedRing: shellView.selectedRing,
      resizeHandle: shellView.resizeHandle,
      shellView,
      widgetLayer: shellView.widgetLayer,
      widgetInstances,
      hovered: false
    };

    this.applyNodeSelectionStyles(state);

    return state;
  }

  /** 渲染节点内部全部 Widget，并保存 renderer 返回实例。 */
  private renderNodeWidgets(
    node: GraphNodeState,
    widgetLayer: Box,
    shellLayout: ReturnType<typeof resolveNodeShellLayout>
  ): Array<LeaferGraphWidgetRenderInstance | null> {
    const instances: Array<LeaferGraphWidgetRenderInstance | null> = [];

    for (let index = 0; index < node.widgets.length; index += 1) {
      const widget = node.widgets[index];
      const bounds = shellLayout.widgets[index].bounds;
      const group = new Box({
        name: `widget-${node.id}-${index}`,
        width: bounds.width,
        height: bounds.height,
        resizeChildren: false
      });
      const renderer = this.getWidgetRenderer(widget.type) ?? this.defaultWidgetRenderer;
      const instance = renderer({
        ui: LeaferUI,
        group,
        node,
        widget,
        widgetIndex: index,
        value: widget.value,
        bounds: {
          x: 0,
          y: 0,
          width: bounds.width,
          height: bounds.height
        },
        setValue: (newValue) => {
          this.setNodeWidgetValue(node.id, index, newValue);
        },
        requestRender: () => {
          this.app.forceRender();
        },
        emitAction: (action, param, options) =>
          this.emitNodeWidgetAction(node.id, action, param, {
            ...(options ?? {}),
            source: "widget",
            widgetIndex: index,
            widgetName: widget.name,
            widgetType: widget.type
          })
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
      (state.hovered || this.resizeState?.nodeId === state.state.id);

    state.resizeHandle.visible = visible;
  }

  /** 节点选中态统一使用固定描边色，保证整张图的焦点反馈一致。 */
  private resolveSelectedNodeStroke(): string {
    return NODE_SELECTED_STROKE;
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
