/**
 * 图画布宿主模块。
 *
 * @remarks
 * 负责创建 Leafer App、根图层和视口基础配置。
 */

import { App, Group } from "leafer-ui";
import { addViewport } from "@leafer-in/viewport";
import type {
  NormalizedLeaferGraphLeaferAppConfig,
  NormalizedLeaferGraphLeaferTreeConfig,
  NormalizedLeaferGraphLeaferViewportConfig
} from "@leafergraph/core/config";
import type { LeaferGraphThemeMode } from "@leafergraph/core/theme";

interface LeaferGraphCanvasHostOptions {
  container: HTMLElement;
  fill?: string;
  themeMode?: LeaferGraphThemeMode;
  resolveBackground(mode: LeaferGraphThemeMode): string;
  leaferAppConfig: NormalizedLeaferGraphLeaferAppConfig;
  leaferTreeConfig: NormalizedLeaferGraphLeaferTreeConfig;
  leaferViewportConfig: NormalizedLeaferGraphLeaferViewportConfig;
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

  /**
   * 初始化 LeaferGraphCanvasHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphCanvasHostOptions) {
    this.options = options;
  }

  /**
   *  创建主包当前所需的最小画布结构，并返回后续宿主要复用的层引用。
   *
   * @returns 处理后的结果。
   */
  mount(): LeaferGraphCanvasState {
    // 先准备宿主依赖、初始状态和需要挂载的资源。
    this.prepareContainer();

    const appRaw = this.options.leaferAppConfig.raw ?? {};
    const appTreeRaw =
      appRaw.tree && typeof appRaw.tree === "object" ? appRaw.tree : undefined;
    const app = new App({
      ...appRaw,
      view: this.options.container,
      fill: this.options.fill ?? "transparent",
      pixelSnap: this.options.leaferAppConfig.pixelSnap,
      usePartRender: this.options.leaferAppConfig.usePartRender,
      usePartLayout: this.options.leaferAppConfig.usePartLayout,
      tree: {
        ...(appTreeRaw ?? {}),
        ...(this.options.leaferTreeConfig.raw ?? {})
      }
    });
    const root = new Group({ name: "leafergraph-root" });
    const linkLayer = new Group({
      name: "links",
      hitSelf: false,
      hitChildren: true
    });
    // 再建立绑定与同步关系，让运行期交互能够稳定生效。
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

  /**
   *  主题切换时同步刷新画布背景。
   *
   * @param mode - 模式。
   * @returns 无返回值。
   */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    this.applyContainerBackground(mode);
  }

  /**
   *  规范化容器样式与背景。
   *
   * @returns 无返回值。
   */
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

  /**
   *  统一应用画布背景，显式 fill 仍然拥有最高优先级。
   *
   * @param mode - 模式。
   * @returns 无返回值。
   */
  private applyContainerBackground(mode: LeaferGraphThemeMode): void {
    const { container, fill, resolveBackground } = this.options;
    container.style.background = fill ?? resolveBackground(mode);
  }

  /**
   * 接入 `@leafer-in/viewport` 的最小工作区视口能力。
   * 当前阶段只打开最常用的缩放和平移语义，不接管节点拖拽。
   * 这里显式使用自由平移，避免节点靠近边缘时被 viewport 的 limit 阻尼“卡”在画布内。
   *
   * @param app - 应用。
   * @returns 无返回值。
   */
  private setupViewport(app: App): void {
    const viewportRaw = this.options.leaferViewportConfig.raw ?? {};
    const viewportRawZoom =
      viewportRaw.zoom && typeof viewportRaw.zoom === "object"
        ? viewportRaw.zoom
        : undefined;
    const viewportRawMove =
      viewportRaw.move && typeof viewportRaw.move === "object"
        ? viewportRaw.move
        : undefined;

    addViewport(app.tree, {
      ...viewportRaw,
      zoom: {
        ...(viewportRawZoom ?? {}),
        min: this.options.leaferViewportConfig.zoom.min,
        max: this.options.leaferViewportConfig.zoom.max
      },
      move: {
        ...(viewportRawMove ?? {}),
        holdSpaceKey: this.options.leaferViewportConfig.move.holdSpaceKey,
        holdMiddleKey: this.options.leaferViewportConfig.move.holdMiddleKey,
        scroll: this.options.leaferViewportConfig.move.scroll
      }
    });
  }
}
