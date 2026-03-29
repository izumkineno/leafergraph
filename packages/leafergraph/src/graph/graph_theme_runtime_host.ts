/**
 * 图主题运行时宿主模块。
 *
 * @remarks
 * 负责把主题切换影响到的节点、连线和 Widget 编辑宿主刷新收敛起来。
 */

import type {
  LeaferGraphThemeMode,
  LeaferGraphWidgetThemeContext
} from "../api/plugin";
import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphSceneRuntimeHost } from "./graph_scene_runtime_host";

/** 主题宿主对外只依赖这一层运行时壳面。 */
export interface LeaferGraphThemeRuntimeLike {
  setWidgetTheme(theme: LeaferGraphWidgetThemeContext): void;
  setCanvasThemeMode(mode: LeaferGraphThemeMode): void;
  refreshThemeScene(): void;
}

/**
 * 主题运行时桥接宿主依赖项。
 *
 * @remarks
 * 主题切换本身不会直接操作节点或连线图元，
 * 而是通过 `widgetEditingManager` 和 `sceneRuntime` 两条链分发到编辑浮层与场景刷新层。
 */
interface LeaferGraphThemeRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends { state: TNodeState }
> {
  widgetEditingManager: {
    setTheme(theme: LeaferGraphWidgetThemeContext): void;
  };
  canvasHost: {
    setThemeMode(mode: LeaferGraphThemeMode): void;
  };
  sceneRuntime: Pick<
    LeaferGraphSceneRuntimeHost<TNodeState, TNodeViewState>,
    "refreshAllNodeViews" | "refreshAllConnectedLinks" | "requestRender"
  >;
}

/**
 * 主题运行时桥接宿主。
 * 当前专门负责把主题切换影响到的编辑宿主、节点局部刷新和连线局部刷新收成单一入口，
 * 避免 `graph_theme_host` 继续直接感知节点视图集合和场景刷新细节。
 */
export class LeaferGraphThemeRuntimeHost<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends { state: TNodeState }
>
  implements LeaferGraphThemeRuntimeLike
{
  private readonly options: LeaferGraphThemeRuntimeHostOptions<
    TNodeState,
    TNodeViewState
  >;

  constructor(
    options: LeaferGraphThemeRuntimeHostOptions<TNodeState, TNodeViewState>
  ) {
    this.options = options;
  }

  /**
   * 同步 Widget 编辑宿主的主题。
   *
   * @param theme - 新的 Widget 主题上下文。
   */
  setWidgetTheme(theme: LeaferGraphWidgetThemeContext): void {
    this.options.widgetEditingManager.setTheme(theme);
  }

  /** 同步画布背景的主题。 */
  setCanvasThemeMode(mode: LeaferGraphThemeMode): void {
    this.options.canvasHost.setThemeMode(mode);
  }

  /**
   * 刷新主题切换后受影响的节点壳、连线和渲染帧。
   *
   * @remarks
   * 当前策略是：
   * 1. 批量重建节点视图，确保节点壳和 Widget 重新读取主题
   * 2. 批量刷新相关连线，避免与新主题下的节点锚点视觉失配
   * 3. 最后请求一帧统一渲染
   */
  refreshThemeScene(): void {
    this.options.sceneRuntime.refreshAllNodeViews();
    this.options.sceneRuntime.refreshAllConnectedLinks();
    this.options.sceneRuntime.requestRender();
  }
}
