import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetThemeContext
} from "../api/plugin";
import type { LeaferGraphThemeRuntimeLike } from "./graph_theme_runtime_host";

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

  constructor(options: LeaferGraphThemeHostOptions) {
    this.options = options;
    this.mode = options.initialMode;
    this.widgetTheme = options.resolveWidgetTheme(options.initialMode);
  }

  /** 挂接运行时依赖，让主题切换可以驱动现有节点和编辑宿主刷新。 */
  attachRuntime(runtime: LeaferGraphThemeRuntimeLike): void {
    this.runtime = runtime;
    this.runtime.setWidgetTheme(this.widgetTheme);
  }

  /** 读取当前主题模式。 */
  getMode(): LeaferGraphThemeMode {
    return this.mode;
  }

  /** 读取当前 Widget 主题上下文。 */
  getWidgetTheme(): LeaferGraphWidgetThemeContext {
    return this.widgetTheme;
  }

  /** 运行时切换主包主题，并局部刷新现有节点壳与 Widget。 */
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
    this.runtime.refreshThemeScene();
  }
}
