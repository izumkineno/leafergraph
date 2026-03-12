import { App, Group, Path, Rect, Text } from "leafer-ui";
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
interface DemoNodeViewState {
  data: LeaferGraphNodeData;
  view: Group;
}

interface DemoLinkViewState {
  sourceId: string;
  targetId: string;
  view: Path;
}

interface DemoDragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

export interface LeaferGraphNodeData {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accent?: string;
  category?: string;
  status?: string;
  inputs?: string[];
  outputs?: string[];
  controlLabel?: string;
  controlValue?: string;
  controlProgress?: number;
}

export interface LeaferGraphOptions {
  fill?: string;
  nodes?: LeaferGraphNodeData[];
}

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

export class LeaferGraph {
  readonly container: HTMLElement;
  readonly app: App;
  readonly root: Group;
  readonly linkLayer: Group;
  readonly nodeLayer: Group;

  private readonly nodeViews = new Map<string, DemoNodeViewState>();
  private readonly linkViews: DemoLinkViewState[] = [];
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

    this.renderDemo(options.nodes ?? DEFAULT_NODES);
  }

  destroy(): void {
    window.removeEventListener("pointermove", this.handleWindowPointerMove);
    window.removeEventListener("pointerup", this.handleWindowPointerUp);
    window.removeEventListener("pointercancel", this.handleWindowPointerUp);
    this.app.destroy();
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
    const localNodes = nodes.map((node) => this.cloneNodeData(node));

    for (const node of localNodes) {
      const view = this.createNode(node);
      this.nodeViews.set(node.id, { data: node, view });
      this.nodeLayer.add(view);
      this.bindNodeDragging(node.id, view);
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
    source: LeaferGraphNodeData,
    target: LeaferGraphNodeData
  ): Path {
    const sourceWidth = source.width ?? DEFAULT_NODE_WIDTH;
    const endpoints = resolveLinkEndpoints({
      sourceX: source.x,
      sourceY: source.y,
      sourceWidth,
      targetX: target.x,
      targetY: target.y,
      sourcePortY: this.resolvePrimaryPortY(source),
      targetPortY: this.resolvePrimaryPortY(target),
      portSize: PORT_SIZE
    });

    return new Path({
      path: buildLinkPath(
        endpoints.start,
        endpoints.end,
        PORT_DIRECTION_RIGHT,
        PORT_DIRECTION_LEFT
      ),
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
        offsetX: event.x - state.data.x,
        offsetY: event.y - state.data.y
      };
      this.container.style.cursor = "grabbing";
    });
  }

  private syncDraggedNode(nodeId: string, x: number, y: number): void {
    const state = this.nodeViews.get(nodeId);
    if (!state) {
      return;
    }

    state.data.x = x;
    state.data.y = y;
    state.view.x = x;
    state.view.y = y;

    this.updateConnectedLinks(nodeId);
  }

  private updateConnectedLinks(nodeId: string): void {
    for (const link of this.linkViews) {
      if (link.sourceId !== nodeId && link.targetId !== nodeId) {
        continue;
      }

      const source = this.nodeViews.get(link.sourceId)?.data;
      const target = this.nodeViews.get(link.targetId)?.data;
      if (!source || !target) {
        continue;
      }

      const sourceWidth = source.width ?? DEFAULT_NODE_WIDTH;
      const endpoints = resolveLinkEndpoints({
        sourceX: source.x,
        sourceY: source.y,
        sourceWidth,
        targetX: target.x,
        targetY: target.y,
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

  private cloneNodeData(node: LeaferGraphNodeData): LeaferGraphNodeData {
    return {
      ...node,
      inputs: node.inputs ? [...node.inputs] : undefined,
      outputs: node.outputs ? [...node.outputs] : undefined
    };
  }

  private getContainerPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private createNode(node: LeaferGraphNodeData): Group {
    const width = node.width ?? DEFAULT_NODE_WIDTH;
    const inputs = this.resolveInputs(node);
    const outputs = this.resolveOutputs(node);
    const slotCount = Math.max(inputs.length, outputs.length, 1);
    const slotsHeight = this.resolveSlotsHeight(slotCount);
    const widgetTop = HEADER_HEIGHT + SECTION_PADDING_Y + slotsHeight + SECTION_PADDING_Y;
    const height = this.resolveNodeHeight(node);
    const category = this.resolveNodeCategory(node);
    const categoryWidth = Math.max(
      CATEGORY_PILL_MIN_WIDTH,
      Math.round(category.length * CATEGORY_CHAR_WIDTH + 24)
    );
    const categoryX = width - categoryWidth - 16;
    const accent = node.accent ?? OUTPUT_PORT_FILL;
    const signalColor = this.resolveSignalColor(node);
    const controlLabel = this.resolveControlLabel(node);
    const controlProgress = this.resolveControlProgress(node);
    const controlValue = this.resolveControlValue(node, controlProgress);
    const trackWidth = width - SECTION_PADDING_X * 2;
    const activeTrackWidth = trackWidth * controlProgress;
    const thumbX = SECTION_PADDING_X + trackWidth * controlProgress - 7;

    const group = new Group({
      x: node.x,
      y: node.y,
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

    const widgetPanel = new Rect({
      y: widgetTop,
      width,
      height: height - widgetTop,
      fill: WIDGET_FILL,
      cornerRadius: [0, 0, NODE_RADIUS, NODE_RADIUS],
      hittable: false
    });

    const widgetDivider = new Rect({
      y: widgetTop,
      width,
      height: 1,
      fill: HEADER_DIVIDER_FILL,
      hittable: false
    });

    const widgetLabel = new Text({
      x: SECTION_PADDING_X,
      y: widgetTop + 12,
      text: controlLabel.toUpperCase(),
      fill: WIDGET_LABEL_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 10,
      fontWeight: "600",
      hittable: false
    });

    const widgetValue = new Text({
      x: width - SECTION_PADDING_X - 38,
      y: widgetTop + 12,
      width: 38,
      text: controlValue,
      textAlign: "right",
      fill: WIDGET_VALUE_FILL,
      fontFamily: NODE_FONT_FAMILY,
      fontSize: 11,
      fontWeight: "600",
      hittable: false
    });

    const sliderTrack = new Rect({
      x: SECTION_PADDING_X,
      y: widgetTop + 36,
      width: trackWidth,
      height: WIDGET_TRACK_HEIGHT,
      fill: TRACK_FILL,
      cornerRadius: 999,
      hittable: false
    });

    const sliderActive = new Rect({
      x: SECTION_PADDING_X,
      y: widgetTop + 36,
      width: activeTrackWidth,
      height: WIDGET_TRACK_HEIGHT,
      fill: accent,
      cornerRadius: 999,
      hittable: false
    });

    const sliderThumb = new Rect({
      x: thumbX,
      y: widgetTop + 31,
      width: 14,
      height: 14,
      fill: accent,
      stroke: "rgba(255, 255, 255, 0.10)",
      strokeWidth: 1,
      cornerRadius: 999,
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
      categoryLabel,
      widgetPanel,
      widgetDivider,
      widgetLabel,
      widgetValue,
      sliderTrack,
      sliderActive,
      sliderThumb
    ];

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

    group.add(parts);

    return group;
  }

  private resolveNodeHeight(node: LeaferGraphNodeData): number {
    const slotCount = Math.max(
      this.resolveInputs(node).length,
      this.resolveOutputs(node).length,
      1
    );
    const slotsHeight = this.resolveSlotsHeight(slotCount);
    const computedHeight =
      HEADER_HEIGHT + SECTION_PADDING_Y + slotsHeight + SECTION_PADDING_Y + WIDGET_HEIGHT;

    return Math.max(node.height ?? 0, computedHeight, DEFAULT_NODE_MIN_HEIGHT);
  }

  private resolvePrimaryPortY(_node: LeaferGraphNodeData): number {
    return HEADER_HEIGHT + SECTION_PADDING_Y + SLOT_ROW_HEIGHT / 2;
  }

  private resolveSlotsHeight(slotCount: number): number {
    if (slotCount <= 1) {
      return SLOT_ROW_HEIGHT;
    }

    return slotCount * SLOT_ROW_HEIGHT + (slotCount - 1) * SLOT_ROW_GAP;
  }

  private resolveInputs(node: LeaferGraphNodeData): string[] {
    return node.inputs?.length ? node.inputs : ["Input"];
  }

  private resolveOutputs(node: LeaferGraphNodeData): string[] {
    return node.outputs?.length ? node.outputs : ["Output"];
  }

  private resolveNodeCategory(node: LeaferGraphNodeData): string {
    return node.category ?? this.startCase(node.id);
  }

  private resolveControlLabel(node: LeaferGraphNodeData): string {
    return node.controlLabel ?? "Value";
  }

  private resolveControlValue(
    node: LeaferGraphNodeData,
    progress: number
  ): string {
    if (node.controlValue) {
      return node.controlValue;
    }

    return (progress * 5).toFixed(2);
  }

  private resolveControlProgress(node: LeaferGraphNodeData): number {
    const progress = node.controlProgress ?? 0.5;
    return Math.min(1, Math.max(0, progress));
  }

  private resolveSignalColor(node: LeaferGraphNodeData): string {
    switch ((node.status ?? "READY").toUpperCase()) {
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
        return node.accent ?? "#60A5FA";
    }
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
