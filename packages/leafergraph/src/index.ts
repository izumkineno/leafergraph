import { App, Group, Path, Rect, Text } from "leafer-ui";

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 116;

export interface LeaferGraphNodeData {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  accent?: string;
}

export interface LeaferGraphOptions {
  fill?: string;
  nodes?: LeaferGraphNodeData[];
}

const DEFAULT_NODES: LeaferGraphNodeData[] = [
  {
    id: "source",
    title: "Source",
    subtitle: "Input signal",
    x: 88,
    y: 96,
    accent: "#FF8A5B"
  },
  {
    id: "transform",
    title: "Transform",
    subtitle: "Leafer-first runtime",
    x: 380,
    y: 176,
    accent: "#6EE7B7"
  },
  {
    id: "preview",
    title: "Preview",
    subtitle: "Editor viewport",
    x: 700,
    y: 112,
    accent: "#7DD3FC"
  }
];

export class LeaferGraph {
  readonly container: HTMLElement;
  readonly app: App;
  readonly root: Group;
  readonly linkLayer: Group;
  readonly nodeLayer: Group;

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

    this.renderDemo(options.nodes ?? DEFAULT_NODES);
  }

  destroy(): void {
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
        "radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%)",
        "radial-gradient(circle at bottom right, rgba(255, 138, 91, 0.18), transparent 22%)",
        "linear-gradient(180deg, #07111f 0%, #0d1729 100%)"
      ].join(", ");
  }

  private renderDemo(nodes: LeaferGraphNodeData[]): void {
    for (let index = 0; index < nodes.length - 1; index += 1) {
      this.linkLayer.add(this.createLink(nodes[index], nodes[index + 1]));
    }

    for (const node of nodes) {
      this.nodeLayer.add(this.createNode(node));
    }
  }

  private createLink(
    source: LeaferGraphNodeData,
    target: LeaferGraphNodeData
  ): Path {
    const sourceWidth = source.width ?? DEFAULT_NODE_WIDTH;
    const sourceHeight = source.height ?? DEFAULT_NODE_HEIGHT;
    const targetHeight = target.height ?? DEFAULT_NODE_HEIGHT;
    const startX = source.x + sourceWidth;
    const startY = source.y + sourceHeight / 2;
    const endX = target.x;
    const endY = target.y + targetHeight / 2;
    const controlOffset = Math.max(96, (endX - startX) * 0.35);

    return new Path({
      path: `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
      fill: "none",
      stroke: "#7DD3FC",
      strokeWidth: 4,
      opacity: 0.95,
      hittable: false
    });
  }

  private createNode(node: LeaferGraphNodeData): Group {
    const width = node.width ?? DEFAULT_NODE_WIDTH;
    const height = node.height ?? DEFAULT_NODE_HEIGHT;
    const accent = node.accent ?? "#7DD3FC";
    const group = new Group({
      x: node.x,
      y: node.y,
      name: `node-${node.id}`
    });

    const shadow = new Rect({
      x: 6,
      y: 12,
      width,
      height,
      fill: "rgba(4, 8, 15, 0.22)",
      cornerRadius: 22,
      hittable: false
    });

    const card = new Rect({
      width,
      height,
      fill: "#101D31",
      stroke: "rgba(125, 211, 252, 0.16)",
      strokeWidth: 1,
      cornerRadius: 22
    });

    const header = new Rect({
      width,
      height: 38,
      fill: "rgba(255, 255, 255, 0.03)",
      cornerRadius: [22, 22, 0, 0],
      hittable: false
    });

    const accentBar = new Rect({
      x: 18,
      y: 16,
      width: 56,
      height: 6,
      fill: accent,
      cornerRadius: 999,
      hittable: false
    });

    const title = new Text({
      x: 18,
      y: 34,
      text: node.title,
      fill: "#F7FAFC",
      fontSize: 18,
      fontWeight: "600",
      hittable: false
    });

    const subtitle = new Text({
      x: 18,
      y: 68,
      text: node.subtitle ?? "",
      fill: "#9FB3C8",
      fontSize: 13,
      width: width - 36,
      hittable: false
    });

    const inputPort = new Rect({
      x: -7,
      y: height / 2 - 7,
      width: 14,
      height: 14,
      fill: "#0B1320",
      stroke: accent,
      strokeWidth: 2,
      cornerRadius: 999,
      hittable: false
    });

    const outputPort = new Rect({
      x: width - 7,
      y: height / 2 - 7,
      width: 14,
      height: 14,
      fill: accent,
      stroke: "#0B1320",
      strokeWidth: 2,
      cornerRadius: 999,
      hittable: false
    });

    group.add([
      shadow,
      card,
      header,
      accentBar,
      title,
      subtitle,
      inputPort,
      outputPort
    ]);

    return group;
  }
}

export function createLeaferGraph(
  container: HTMLElement,
  options?: LeaferGraphOptions
): LeaferGraph {
  return new LeaferGraph(container, options);
}
