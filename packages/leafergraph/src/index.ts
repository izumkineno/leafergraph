import { App, Group, Rect, Text } from "leafer-ui";
import * as LeaferUI from "leafer-ui";
import { Arrow } from "@leafer-in/arrow";
import * as NodeSDK from "@leafergraph/node";
import {
  installNodeModule,
  NodeRegistry,
  createNodeState,
  type LeaferGraphNodeData,
  type InstallNodeModuleOptions,
  type NodeDefinition,
  type NodeModule,
  type NodeRuntimeState,
  type RegisterNodeOptions,
  type RegisterWidgetOptions,
  type ResolvedNodeModule,
  type WidgetDefinition
} from "@leafergraph/node";
export { LeaferUI };
export type { LeaferGraphNodeData } from "@leafergraph/node";
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
interface NodeViewState {
  state: GraphNodeState;
  view: Group;
  widgetLayer: Group;
  widgetInstances: Array<LeaferGraphWidgetRenderInstance | null>;
}

interface DemoLinkViewState {
  sourceId: string;
  targetId: string;
  view: Arrow;
}

interface DemoDragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface DemoNodeProperties {
  subtitle?: string;
  accent?: string;
  category?: string;
  status?: string;
}

interface DemoWidgetOptions {
  label?: string;
  displayValue?: string;
}

interface InstalledPluginRecord {
  name: string;
  version?: string;
  nodeTypes: string[];
  widgetTypes: string[];
}

type GraphNodeState = NodeRuntimeState & {
  properties: DemoNodeProperties;
};

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

function createDemoNodeRegistry(): NodeRegistry {
  const registry = new NodeRegistry();
  registry.registerNode(DEMO_NODE_DEFINITION);
  return registry;
}

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

function clampProgress(value: unknown): number {
  const progress = typeof value === "number" ? value : Number(value ?? 0.5);
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0.5));
}

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

function readNodeAccent(node: NodeRuntimeState): string {
  const accent = node.properties?.accent;
  return typeof accent === "string" && accent ? accent : OUTPUT_PORT_FILL;
}

export class LeaferGraph {
  readonly container: HTMLElement;
  readonly app: App;
  readonly root: Group;
  readonly linkLayer: Group;
  readonly nodeLayer: Group;
  readonly ready: Promise<void>;

  private readonly nodeRegistry: NodeRegistry;
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
    this.syncDraggedNode(
      this.dragState.nodeId,
      point.x - this.dragState.offsetX,
      point.y - this.dragState.offsetY
    );
    this.container.style.cursor = "grabbing";
    this.app.forceRender();
  };
  private readonly handleWindowPointerUp = (): void => {
    if (!this.dragState) {
      return;
    }

    this.dragState = null;
    this.container.style.cursor = "";
    this.app.forceRender();
  };

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
    window.addEventListener("pointermove", this.handleWindowPointerMove);
    window.addEventListener("pointerup", this.handleWindowPointerUp);
    window.addEventListener("pointercancel", this.handleWindowPointerUp);
    this.registerBuiltinWidgetRenderers();
    this.ready = this.initialize(options);
    this.ready.catch((error) => {
      console.error("[leafergraph] 初始化失败", error);
    });
  }

  destroy(): void {
    for (const state of this.nodeViews.values()) {
      this.destroyNodeWidgets(state);
    }

    window.removeEventListener("pointermove", this.handleWindowPointerMove);
    window.removeEventListener("pointerup", this.handleWindowPointerUp);
    window.removeEventListener("pointercancel", this.handleWindowPointerUp);
    this.app.destroy();
  }

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

  installModule(module: NodeModule, options?: InstallNodeModuleOptions): void {
    this.installModuleInternal(module, options);
  }

  registerNode(definition: NodeDefinition, options?: RegisterNodeOptions): void {
    this.nodeRegistry.registerNode(definition, options);
  }

  registerWidget(definition: WidgetDefinition, options?: RegisterWidgetOptions): void {
    this.nodeRegistry.registerWidget(definition, options);
  }

  registerWidgetRenderer(type: string, renderer: LeaferGraphWidgetRenderer): void {
    const safeType = type.trim();

    if (!safeType) {
      throw new Error("Widget 渲染器类型不能为空");
    }

    this.widgetRenderers.set(safeType, renderer);
  }

  getWidgetRenderer(type: string): LeaferGraphWidgetRenderer | undefined {
    return this.widgetRenderers.get(type);
  }

  listNodes(): NodeDefinition[] {
    return this.nodeRegistry.listNodes();
  }

  private async initialize(options: LeaferGraphOptions): Promise<void> {
    for (const module of options.modules ?? []) {
      this.installModule(module);
    }

    for (const plugin of options.plugins ?? []) {
      await this.use(plugin);
    }

    this.renderDemo(options.nodes ?? DEFAULT_NODES);
  }

  private installModuleInternal(
    module: NodeModule,
    options?: InstallNodeModuleOptions
  ): ResolvedNodeModule {
    return installNodeModule(this.nodeRegistry, module, options);
  }

  private registerBuiltinWidgetRenderers(): void {
    this.registerWidgetRenderer("slider", createSliderWidgetRenderer());
    this.registerWidgetRenderer("number", createValueWidgetRenderer());
    this.registerWidgetRenderer("string", createValueWidgetRenderer());
    this.registerWidgetRenderer("combo", createValueWidgetRenderer());
    this.registerWidgetRenderer("toggle", createValueWidgetRenderer());
    this.registerWidgetRenderer("custom", createValueWidgetRenderer());
  }

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

  private renderDemo(nodes: LeaferGraphNodeData[]): void {
    for (const state of this.nodeViews.values()) {
      this.destroyNodeWidgets(state);
    }

    this.nodeViews.clear();
    this.linkViews.length = 0;
    this.nodeLayer.removeAll();
    this.linkLayer.removeAll();

    const localNodes = nodes.map((node) => this.createGraphNodeState(node));

    for (const node of localNodes) {
      const state = this.createNode(node);
      this.nodeViews.set(node.id, state);
      this.nodeLayer.add(state.view);
      this.bindNodeDragging(node.id, state.view);
    }

    for (let index = 0; index < localNodes.length - 1; index += 1) {
      const source = localNodes[index];
      const target = localNodes[index + 1];
      const view = this.createLink(source, target);
      this.linkViews.push({ sourceId: source.id, targetId: target.id, view });
      this.linkLayer.add(view);
    }
  }

  private createLink(
    source: GraphNodeState,
    target: GraphNodeState
  ): Arrow {
    const sourceWidth = source.layout.width ?? DEFAULT_NODE_WIDTH;
    const endpoints = resolveLinkEndpoints({
      sourceX: source.layout.x,
      sourceY: source.layout.y,
      sourceWidth,
      targetX: target.layout.x,
      targetY: target.layout.y,
      sourcePortY: this.resolvePrimaryPortY(source),
      targetPortY: this.resolvePrimaryPortY(target),
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

  private syncDraggedNode(nodeId: string, x: number, y: number): void {
    const state = this.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    state.state.layout.x = x;
    state.state.layout.y = y;
    state.view.x = x;
    state.view.y = y;

    this.updateConnectedLinks(nodeId);
  }

  private updateConnectedLinks(nodeId: string): void {
    for (const link of this.linkViews) {
      if (link.sourceId !== nodeId && link.targetId !== nodeId) {
        continue;
      }

      const source = this.nodeViews.get(link.sourceId)?.state;
      const target = this.nodeViews.get(link.targetId)?.state;
      if (!source || !target) {
        continue;
      }

      const sourceWidth = source.layout.width ?? DEFAULT_NODE_WIDTH;
      const endpoints = resolveLinkEndpoints({
        sourceX: source.layout.x,
        sourceY: source.layout.y,
        sourceWidth,
        targetX: target.layout.x,
        targetY: target.layout.y,
        sourcePortY: this.resolvePrimaryPortY(source),
        targetPortY: this.resolvePrimaryPortY(target),
        portSize: PORT_SIZE
      });

      link.view.path = buildLinkPath(
        endpoints.start,
        endpoints.end,
        PORT_DIRECTION_RIGHT,
        PORT_DIRECTION_LEFT
      );
    }
  }

  private getContainerPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

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

  private createGraphNodeState(node: LeaferGraphNodeData): GraphNodeState {
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
      inputs: node.inputs ? this.toSlotSpecs(node.inputs) : undefined,
      outputs: node.outputs ? this.toSlotSpecs(node.outputs) : undefined,
      widgets:
        node.widgets ??
        (type === DEMO_NODE_TYPE
          ? [
              {
                type: "slider",
                name: DEMO_CONTROL_WIDGET,
                value: node.controlProgress ?? 0.5,
                options: {
                  label: node.controlLabel ?? "Value",
                  displayValue: node.controlValue
                }
              }
            ]
          : undefined),
      data: node.data
    }) as GraphNodeState;
  }

  private createNode(node: GraphNodeState): NodeViewState {
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
    const hasWidgets = node.widgets.length > 0;
    const widgetTop = this.resolveWidgetTop(node);

    const group = new Group({
      x: node.layout.x,
      y: node.layout.y,
      name: `node-${node.id}`
    });

    const card = new Rect({
      width,
      height,
      fill: CARD_FILL,
      stroke: CARD_STROKE,
      strokeWidth: 1,
      cornerRadius: NODE_RADIUS
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

    group.add([...parts, widgetLayer]);

    return {
      state: node,
      view: group,
      widgetLayer,
      widgetInstances
    };
  }

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

  private destroyNodeWidgets(state: NodeViewState): void {
    for (const instance of state.widgetInstances) {
      instance?.destroy?.();
    }

    state.widgetInstances = [];
    state.widgetLayer.removeAll();
  }

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

  private resolvePrimaryPortY(_node: GraphNodeState): number {
    return HEADER_HEIGHT + SECTION_PADDING_Y + SLOT_ROW_HEIGHT / 2;
  }

  private resolveSlotsHeight(slotCount: number): number {
    if (slotCount <= 1) {
      return SLOT_ROW_HEIGHT;
    }

    return slotCount * SLOT_ROW_HEIGHT + (slotCount - 1) * SLOT_ROW_GAP;
  }

  private resolveInputs(node: GraphNodeState): string[] {
    return node.inputs.length
      ? node.inputs.map((input) => input.label ?? input.name)
      : ["Input"];
  }

  private resolveOutputs(node: GraphNodeState): string[] {
    return node.outputs.length
      ? node.outputs.map((output) => output.label ?? output.name)
      : ["Output"];
  }

  private resolveWidgetSectionHeight(node: GraphNodeState): number {
    return node.widgets.length * WIDGET_HEIGHT;
  }

  private resolveWidgetTop(node: GraphNodeState): number {
    const slotCount = Math.max(
      this.resolveInputs(node).length,
      this.resolveOutputs(node).length,
      1
    );

    return HEADER_HEIGHT + SECTION_PADDING_Y + this.resolveSlotsHeight(slotCount) + SECTION_PADDING_Y;
  }

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

  private resolveNodeCategory(node: GraphNodeState): string {
    const category = node.properties.category;

    if (typeof category === "string" && category) {
      return category;
    }

    return this.nodeRegistry.getNode(node.type)?.category ?? this.startCase(node.type);
  }

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

  private toSlotSpecs(names: string[]) {
    const list = names.length ? names : ["Value"];
    return list.map((name) => ({ name }));
  }

  private startCase(value: string): string {
    return value
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function createLeaferGraph(
  container: HTMLElement,
  options?: LeaferGraphOptions
): LeaferGraph {
  return new LeaferGraph(container, options);
}
