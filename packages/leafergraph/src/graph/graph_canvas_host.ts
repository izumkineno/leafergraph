/**
 * 图画布宿主模块。
 *
 * @remarks
 * 负责创建 Leafer App、根图层和视口基础配置。
 */

import { App, Group } from "leafer-ui";
import { addViewport } from "@leafer-in/viewport";

interface LeaferGraphCanvasHostOptions {
  container: HTMLElement;
  fill?: string;
  viewportMinScale: number;
  viewportMaxScale: number;
}

export interface LeaferGraphCanvasState {
  app: App;
  root: Group;
  linkLayer: Group;
  nodeLayer: Group;
}

/**
 * 画布装配宿主。
 * 当前集中收口：
 * 1. 容器样式与背景准备
 * 2. `App/root/linkLayer/nodeLayer` 的初始化
 * 3. 视口缩放和平移能力接入
 */
export class LeaferGraphCanvasHost {
  private readonly options: LeaferGraphCanvasHostOptions;

  constructor(options: LeaferGraphCanvasHostOptions) {
    this.options = options;
  }

  /** 创建主包当前所需的最小画布结构，并返回后续宿主要复用的层引用。 */
  mount(): LeaferGraphCanvasState {
    this.prepareContainer();

    const app = new App({
      view: this.options.container,
      fill: this.options.fill ?? "transparent",
      pixelSnap: true,
      usePartRender: true,
      usePartLayout: true,
      tree: {}
    });
    const root = new Group({ name: "leafergraph-root" });
    const linkLayer = new Group({ name: "links", hittable: false });
    const nodeLayer = new Group({ name: "nodes" });

    root.add([linkLayer, nodeLayer]);
    app.tree.add(root);
    this.setupViewport(app);

    return {
      app,
      root,
      linkLayer,
      nodeLayer
    };
  }

  /** 规范化容器样式与背景。 */
  private prepareContainer(): void {
    const { container, fill } = this.options;

    container.replaceChildren();
    if (!container.style.position) {
      container.style.position = "relative";
    }
    if (!container.style.width) {
      container.style.width = "100%";
    }
    if (!container.style.height) {
      container.style.height = "100%";
    }
    container.style.overflow = "hidden";
    container.style.background =
      fill ??
      [
        "radial-gradient(circle at top left, rgba(56, 189, 248, 0.20), transparent 30%)",
        "radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 28%)",
        "radial-gradient(circle at center, rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
        "linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)"
      ].join(", ");
    container.style.backgroundSize = "auto, auto, 20px 20px, auto";
  }

  /**
   * 接入 `@leafer-in/viewport` 的最小工作区视口能力。
   * 当前阶段只打开最常用的缩放和平移语义，不接管节点拖拽。
   */
  private setupViewport(app: App): void {
    addViewport(app.tree, {
      zoom: {
        min: this.options.viewportMinScale,
        max: this.options.viewportMaxScale
      },
      move: {
        holdSpaceKey: true,
        holdMiddleKey: true,
        scroll: "limit"
      }
    });
  }
}
