/**
 * 图入口运行时创建模块。
 *
 * @remarks
 * 负责为主包公共入口准备默认图状态容器、默认宿主装配参数和初始化 ready 链，
 * 让 `src/index.ts` 更接近纯公共入口，而不是继续堆叠内部默认配置细节。
 */

import type { App, Group } from "leafer-ui";
import type { LeaferGraphOptions } from "@leafergraph/contracts";
import type { LeaferGraphApiHost } from "../api/graph_api_host";
import { createLeaferGraphRuntimeAssembly } from "./graph_runtime_assembly";
import { normalizeGraphLinkSlotIndex } from "./graph_mutation_host";
import {
  NODE_SHELL_LAYOUT_METRICS,
  VIEWPORT_MAX_SCALE,
  VIEWPORT_MIN_SCALE,
  createDefaultDataFlowAnimationStyleConfig,
  createDefaultNodeShellStyleConfig,
  resolveDefaultCanvasBackground,
  resolveDefaultLinkStroke,
  resolveDefaultNodeShellRenderTheme,
  resolveDefaultSelectedStroke
} from "./graph_runtime_style";
import type {
  GraphLinkViewState,
  GraphNodeState,
  GraphNodeViewState,
  GraphRuntimeState
} from "./graph_runtime_types";
import { resolveBasicWidgetTheme } from "../widgets/basic";
import { createMissingWidgetRenderer } from "../widgets/widget_host";

/**
 * 主包入口运行时结果。
 *
 * @remarks
 * 这是 `LeaferGraph` 构造函数真正需要消费的最小结果集。
 */
export interface LeaferGraphEntryRuntime {
  app: App;
  root: Group;
  linkLayer: Group;
  nodeLayer: Group;
  apiHost: LeaferGraphApiHost<GraphNodeState, GraphNodeViewState>;
  ready: Promise<void>;
}

/**
 * 创建主包默认入口运行时。
 *
 * @remarks
 * 这里统一封装：
 * 1. 默认图状态容器初始化
 * 2. 默认主题和节点壳样式配置
 * 3. 主装配器调用
 * 4. 启动期 `ready` Promise 建立
 *
 * @param container - LeaferGraph 挂载容器。
 * @param options - 主包初始化配置。
 * @returns 供 `LeaferGraph` 入口实例直接消费的运行时结果。
 */
export function createLeaferGraphEntryRuntime(
  container: HTMLElement,
  options: LeaferGraphOptions = {}
): LeaferGraphEntryRuntime {
  const graphState: GraphRuntimeState = {
    nodes: new Map(),
    links: new Map()
  };
  const nodeViews = new Map<string, GraphNodeViewState>();
  const linkViews: GraphLinkViewState[] = [];
  const runtime = createLeaferGraphRuntimeAssembly<GraphNodeState>({
    container,
    graphState,
    nodeViews,
    linkViews,
    fill: options.fill,
    themeMode: options.themeMode,
    widgetEditing: options.widgetEditing,
    viewportMinScale: VIEWPORT_MIN_SCALE,
    viewportMaxScale: VIEWPORT_MAX_SCALE,
    createMissingWidgetRenderer,
    resolveWidgetTheme: (mode) => ({
      mode,
      tokens: resolveBasicWidgetTheme(mode)
    }),
    nodeShellLayoutMetrics: NODE_SHELL_LAYOUT_METRICS,
    nodeShellStyle: createDefaultNodeShellStyleConfig(),
    resolveCanvasBackground: (mode) => resolveDefaultCanvasBackground(mode),
    resolveSelectedStroke: (mode) => resolveDefaultSelectedStroke(mode),
    resolveNodeShellRenderTheme: (mode) =>
      resolveDefaultNodeShellRenderTheme(mode),
    normalizeLinkSlotIndex: (slot) => normalizeGraphLinkSlotIndex(slot),
    linkDefaultNodeWidth: NODE_SHELL_LAYOUT_METRICS.defaultNodeWidth,
    linkPortSize: NODE_SHELL_LAYOUT_METRICS.portSize,
    linkStroke: resolveDefaultLinkStroke(),
    dataFlowAnimationStyle: createDefaultDataFlowAnimationStyleConfig(
      options.linkPropagationAnimation ?? "performance"
    )
  });
  const ready = runtime.apiHost.initialize(options);
  ready.catch((error) => {
    console.error("[leafergraph] 初始化失败", error);
  });

  return {
    ...runtime,
    ready
  };
}
