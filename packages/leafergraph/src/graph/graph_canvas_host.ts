/**
 * 图画布宿主模块。
 *
 * @remarks
 * 负责创建 Leafer App、根图层和视口基础配置。
 */

import { App, Group } from "leafer-ui";
import { addViewport } from "@leafer-in/viewport";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";

interface LeaferGraphCanvasHostOptions {
  container: HTMLElement;
  fill?: string;
  themeMode?: LeaferGraphThemeMode;
  resolveBackground(mode: LeaferGraphThemeMode): string;
  viewportMinScale: number;
  viewportMaxScale: number;
}

export interface LeaferGraphCanvasState {
  app: App;
  root: Group;
  linkLayer: Group;
  nodeLayer: Group;
  selectionLayer: Group;
}

/**
 * 画布装配宿主。
 * 当前集中收口：
 * 1. 容器样式与背景准备
 * 2. `App/root/linkLayer/nodeLayer/selectionLayer` 的初始化
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
    const linkLayer = new Group({
      name: "links",
      hitSelf: false,
      hitChildren: true
    });
    const nodeLayer = new Group({ name: "nodes" });
    const selectionLayer = new Group({
      name: "selection",
      hitSelf: false,
      hitChildren: false,
      hittable: false,
      zIndex: 999998
    });

    root.add([linkLayer, nodeLayer, selectionLayer]);
    app.tree.add(root);
    this.setupViewport(app);

    return {
      app,
      root,
      linkLayer,
      nodeLayer,
      selectionLayer
    };
  }

  /** 主题切换时同步刷新画布背景。 */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    this.applyContainerBackground(mode);
  }

  /** 规范化容器样式与背景。 */
  private prepareContainer(): void {
    const { container } = this.options;

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
    container.style.backgroundSize = "auto, auto, 20px 20px, auto";
    this.applyContainerBackground(this.options.themeMode ?? "light");
  }

  /** 统一应用画布背景，显式 fill 仍然拥有最高优先级。 */
  private applyContainerBackground(mode: LeaferGraphThemeMode): void {
    const { container, fill, resolveBackground } = this.options;
    container.style.background = fill ?? resolveBackground(mode);
  }

  /**
   * 接入 `@leafer-in/viewport` 的最小工作区视口能力。
   * 当前阶段只打开最常用的缩放和平移语义，不接管节点拖拽。
   * 这里显式使用自由平移，避免节点靠近边缘时被 viewport 的 limit 阻尼“卡”在画布内。
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
        scroll: true
      }
    });
  }
}
