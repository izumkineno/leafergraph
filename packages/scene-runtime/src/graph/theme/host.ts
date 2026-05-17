/**
 * 图主题宿主模块。
 *
 * @remarks
 * 负责维护主包主题模式，并驱动主题切换后的运行时刷新。
 */

import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetThemeContext
} from "@leafergraph/core/theme";
import type { LeaferGraphThemeRuntimeLike } from "./runtime";

/**
 * 主题宿主依赖项。
 *
 * @remarks
 * 主题宿主自身只维护主题状态和主题切换入口，
 * 具体 Widget token 如何从模式解析出来，由外部注入的 `resolveWidgetTheme(...)` 决定。
 */
interface LeaferGraphThemeHostOptions {
  initialMode: LeaferGraphThemeMode;
  resolveWidgetTheme(mode: LeaferGraphThemeMode): LeaferGraphWidgetThemeContext;
}

/**
 * 主题与刷新宿主。
 * 当前集中收口：
 * 1. 主题模式与 Widget 主题 token 状态
 * 2. 主题切换后编辑宿主的样式同步
 * 3. 主题切换后节点壳与连线的批量局部刷新
 */
export class LeaferGraphThemeHost {
  private readonly options: LeaferGraphThemeHostOptions;
  private runtime: LeaferGraphThemeRuntimeLike | null = null;
  private mode: LeaferGraphThemeMode;
  private widgetTheme: LeaferGraphWidgetThemeContext;

  /**
   * 初始化 LeaferGraphThemeHost 实例。
   *
   * @param options - 可选配置项。
   */
  constructor(options: LeaferGraphThemeHostOptions) {
    this.options = options;
    this.mode = options.initialMode;
    this.widgetTheme = options.resolveWidgetTheme(options.initialMode);
  }

  /**
   * 挂接运行时依赖，让主题切换可以驱动现有节点和编辑宿主刷新。
   *
   * @param runtime - 主题宿主后续用于刷新场景和同步编辑主题的运行时桥接层。
   *
   * @returns 无返回值。
   */
  attachRuntime(runtime: LeaferGraphThemeRuntimeLike): void {
    this.runtime = runtime;
    this.runtime.setWidgetTheme(this.widgetTheme);
  }

  /**
   * 读取当前主题模式。
   *
   * @returns 当前主包主题模式。
   */
  getMode(): LeaferGraphThemeMode {
    return this.mode;
  }

  /**
   * 读取当前 Widget 主题上下文。
   *
   * @returns 当前亮色或暗色模式对应的 Widget 主题对象。
   */
  getWidgetTheme(): LeaferGraphWidgetThemeContext {
    return this.widgetTheme;
  }

  /**
   * 运行时切换主包主题，并局部刷新现有节点壳与 Widget。
   *
   * @remarks
   * 主题宿主不会重建整图，只会在模式变化时更新 Widget 主题对象，
   * 然后委托运行时桥接层批量刷新节点壳、连线和编辑浮层。
   *
   * @param mode - 目标主题模式。
   *
   * @returns 无返回值。
   */
  setThemeMode(mode: LeaferGraphThemeMode): void {
    if (this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.widgetTheme = this.options.resolveWidgetTheme(mode);

    if (!this.runtime) {
      return;
    }

    this.runtime.setWidgetTheme(this.widgetTheme);
    this.runtime.setCanvasThemeMode(mode);
    this.runtime.refreshThemeScene();
  }
}
