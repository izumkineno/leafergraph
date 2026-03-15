import type { LeaferGraphWidgetThemeContext } from "../api/plugin";
import type { NodeRuntimeState } from "@leafergraph/node";
import type { LeaferGraphSceneRuntimeHost } from "./graph_scene_runtime_host";

/** 主题宿主对外只依赖这一层运行时壳面。 */
export interface LeaferGraphThemeRuntimeLike {
  setWidgetTheme(theme: LeaferGraphWidgetThemeContext): void;
  refreshThemeScene(): void;
}

interface LeaferGraphThemeRuntimeHostOptions<
  TNodeState extends NodeRuntimeState,
  TNodeViewState extends { state: TNodeState }
> {
  widgetEditingManager: {
    setTheme(theme: LeaferGraphWidgetThemeContext): void;
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

  /** 同步 Widget 编辑宿主的主题。 */
  setWidgetTheme(theme: LeaferGraphWidgetThemeContext): void {
    this.options.widgetEditingManager.setTheme(theme);
  }

  /** 刷新主题切换后受影响的节点壳、连线和渲染帧。 */
  refreshThemeScene(): void {
    this.options.sceneRuntime.refreshAllNodeViews();
    this.options.sceneRuntime.refreshAllConnectedLinks();
    this.options.sceneRuntime.requestRender();
  }
}
