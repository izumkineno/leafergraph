/**
 * 图入口运行时创建模块。
 *
 * @remarks
 * 负责为主包公共入口准备默认图状态容器、默认宿主装配参数和初始化 ready 链，
 * 让 `src/index.ts` 更接近纯公共入口，而不是继续堆叠内部默认配置细节。
 */

import type { App, Group } from "leafer-ui";
import type { LeaferGraphOptions } from "@leafergraph/contracts";
import {
  normalizeLeaferGraphConfig,
  type NormalizedLeaferGraphConfig
} from "@leafergraph/config";
import { createMissingWidgetRenderer } from "@leafergraph/widget-runtime";
import { resolveThemePreset, type LeaferGraphThemeMode } from "@leafergraph/theme";
import type { LeaferGraphGraphThemeTokens } from "@leafergraph/theme/graph";
import type { LeaferGraphApiHost } from "../../api/graph_api_host";
import { createLeaferGraphRuntimeAssembly } from "./runtime";
import { normalizeGraphLinkSlotIndex } from "../host/mutation";
import { createDisabledDataFlowAnimationStyleConfig } from "../style";
import type {
  GraphLinkViewState,
  GraphNodeState,
  GraphNodeViewState,
  GraphRuntimeState
} from "../types";

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
  defaultFitViewPadding: number;
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
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const initialThemeMode: LeaferGraphThemeMode = options.themeMode ?? "light";
  const resolvedConfig = normalizeLeaferGraphConfig(options.config);
  const themePreset = resolveThemePreset(options.themePreset);
  const initialThemeBundle = themePreset.modes[initialThemeMode];
  const initialGraphTheme = initialThemeBundle.graph;
  const graphState: GraphRuntimeState = {
    document: {
      documentId: "local-document",
      revision: 0,
      appKind: "leafergraph-local"
    },
    nodes: new Map(),
    links: new Map()
  };
  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  const nodeViews = new Map<string, GraphNodeViewState>();
  const linkViews: GraphLinkViewState[] = [];
  const runtime = createLeaferGraphRuntimeAssembly<GraphNodeState>({
    container,
    graphState,
    nodeViews,
    linkViews,
    config: resolvedConfig,
    themeMode: initialThemeMode,
    createMissingWidgetRenderer,
    resolveGraphTheme: (mode) => themePreset.modes[mode].graph,
    resolveWidgetTheme: (mode) => ({
      mode,
      tokens: themePreset.modes[mode].widget
    }),
    nodeShellLayoutMetrics: initialGraphTheme.nodeShellLayoutMetrics,
    nodeShellStyle: initialGraphTheme.nodeShellStyle,
    resolveCanvasBackground: (mode) => themePreset.modes[mode].graph.canvasBackground,
    resolveSelectedStroke: (mode) => themePreset.modes[mode].graph.selectedStroke,
    resolveNodeShellRenderTheme: (mode) =>
      themePreset.modes[mode].graph.nodeShellRenderTheme,
    normalizeLinkSlotIndex: (slot) => normalizeGraphLinkSlotIndex(slot),
    linkDefaultNodeWidth: initialGraphTheme.nodeShellLayoutMetrics.defaultNodeWidth,
    linkPortSize: initialGraphTheme.nodeShellLayoutMetrics.portSize,
    linkStroke: initialGraphTheme.linkStroke,
    dataFlowAnimationStyle: resolveConfiguredDataFlowAnimationStyle(
      initialGraphTheme,
      resolvedConfig
    )
  });
  const ready = runtime.apiHost.initialize(options);
  ready.catch((error) => {
    console.error("[leafergraph] 初始化失败", error);
  });

  return {
    ...runtime,
    defaultFitViewPadding: resolvedConfig.graph.view.defaultFitPadding,
    ready
  };
}

/**
 * 解析`Configured` 数据流动画样式。
 *
 * @param graphTheme - 图主题。
 * @param config - 当前配置。
 * @returns 处理后的结果。
 */
function resolveConfiguredDataFlowAnimationStyle(
  graphTheme: LeaferGraphGraphThemeTokens,
  config: NormalizedLeaferGraphConfig
) {
  const preset = config.graph.runtime.linkPropagationAnimation;

  if (preset === false) {
    const disabledStyle = createDisabledDataFlowAnimationStyleConfig();
    const performanceStyle = graphTheme.dataFlowAnimationStyles.performance;

    return {
      ...performanceStyle,
      ...disabledStyle,
      pulseDurationMs: performanceStyle.pulseDurationMs,
      pulseDarkOpacity: performanceStyle.pulseDarkOpacity,
      pulseLightOpacity: performanceStyle.pulseLightOpacity,
      pulseBaseStrokeWidth: performanceStyle.pulseBaseStrokeWidth,
      pulseExtraStrokeWidth: performanceStyle.pulseExtraStrokeWidth,
      particleSize: performanceStyle.particleSize,
      glowSize: performanceStyle.glowSize,
      durationMs: performanceStyle.durationMs,
      coreOpacity: performanceStyle.coreOpacity,
      darkGlowOpacity: performanceStyle.darkGlowOpacity,
      lightGlowOpacity: performanceStyle.lightGlowOpacity,
      fadeInRatio: performanceStyle.fadeInRatio,
      fadeOutRatio: performanceStyle.fadeOutRatio
    };
  }

  return graphTheme.dataFlowAnimationStyles[preset];
}
