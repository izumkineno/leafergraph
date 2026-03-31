/**
 * 连线数据流动画内部类型模块。
 *
 * @remarks
 * 负责统一 controller、效果更新和环境适配层之间共享的类型结构。
 */

import type { Arrow } from "@leafer-in/arrow";
import type { GraphLink } from "@leafergraph/node";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/contracts";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type { Group, Rect } from "leafer-ui";
import type { LeaferGraphDataFlowAnimationStyleConfig } from "../../graph/style";
import type { NodeShellLayoutMetrics } from "../../node/shell/layout";
import type { LeaferGraphLinkNodeState } from "../curve";

/**
 * 连线数据流动画宿主对外装配选项。
 */
export interface LeaferGraphLinkDataFlowAnimationHostOptions<
  TNodeState extends LeaferGraphLinkNodeState
> {
  /** 图容器元素。 */
  container: HTMLElement;
  /** 连线层。 */
  linkLayer: Group;
  /** 当前图中的节点映射。 */
  graphNodes: Map<string, TNodeState>;
  /** 当前图中的连线映射。 */
  graphLinks: Map<string, GraphLink>;
  /** 节点壳布局度量。 */
  layoutMetrics: NodeShellLayoutMetrics;
  /** 默认节点宽度。 */
  defaultNodeWidth: number;
  /** 端口尺寸。 */
  portSize: number;
  /** 解析连线基础颜色。 */
  resolveLinkStroke(): string;
  /** 解析按槽位类型着色的颜色表。 */
  resolveSlotTypeFillMap(): Readonly<Record<string, string>>;
  /** 解析当前动画样式。 */
  resolveStyle(): LeaferGraphDataFlowAnimationStyleConfig;
  /** 读取当前主题模式。 */
  getThemeMode(): LeaferGraphThemeMode;
  /** 请求宿主渲染一帧。 */
  requestRender(): void;
  /** 触发动画用强制帧渲染。 */
  renderFrame(): void;
  /** 订阅连线传播事件。 */
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void;
}

/**
 * 动画层在单次传播中解析出的正式连线快照。
 */
export interface LeaferGraphResolvedAnimatedLink<
  TNodeState extends LeaferGraphLinkNodeState
> {
  /** 当前正式连线。 */
  link: GraphLink;
  /** 起点节点状态。 */
  sourceNode: TNodeState;
  /** 终点节点状态。 */
  targetNode: TNodeState;
  /** 起点槽位索引。 */
  sourceSlot: number;
  /** 终点槽位索引。 */
  targetSlot: number;
  /** 当前连线解析出的显示颜色。 */
  color: string;
}

/**
 * 正在播放的 pulse 效果。
 */
export interface LeaferGraphActiveDataFlowPulse {
  /** pulse 实例 ID。 */
  id: string;
  /** 所属连线 ID。 */
  linkId: string;
  /** 动画开始时间戳。 */
  startedAt: number;
  /** pulse 对应的 Arrow 视图。 */
  view: Arrow;
}

/**
 * 正在播放的 travelling 粒子效果。
 */
export interface LeaferGraphActiveDataFlowParticle {
  /** 粒子实例 ID。 */
  id: string;
  /** 所属连线 ID。 */
  linkId: string;
  /** 动画开始时间戳。 */
  startedAt: number;
  /** 粒子 glow 图元。 */
  glow: Rect;
  /** 粒子核心图元。 */
  core: Rect;
}

/**
 * 动画子模块之间共享的最小运行时能力。
 */
export interface LeaferGraphLinkDataFlowAnimationRuntime<
  TNodeState extends LeaferGraphLinkNodeState
> {
  /** 动画宿主初始化选项。 */
  readonly options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>;
  /** 动画 overlay 分组。 */
  readonly overlayGroup: Group;
  /** 当前活动 pulse 列表。 */
  readonly activePulses: LeaferGraphActiveDataFlowPulse[];
  /** 当前活动 travelling 粒子列表。 */
  readonly activeParticles: LeaferGraphActiveDataFlowParticle[];
  /** 所属 Window；在非浏览器环境下可能为空。 */
  readonly ownerWindow: Window | null;
  /** 降低动态效果偏好查询。 */
  readonly reducedMotionMediaQuery: MediaQueryList | null;
  /** 读取当前帧循环 ID。 */
  getFrameId(): number | null;
  /** 更新当前帧循环 ID。 */
  setFrameId(frameId: number | null): void;
  /** 读取当前动画样式。 */
  getStyle(): LeaferGraphDataFlowAnimationStyleConfig;
  /** 当前是否应启用 reduced motion。 */
  shouldReduceMotion(): boolean;
  /** 按连线 ID 解析一条可动画的正式连线快照。 */
  resolveAnimatedLink(
    linkId: string,
    sourceSlotOverride?: number
  ): LeaferGraphResolvedAnimatedLink<TNodeState> | null;
  /** 按进度解析 pulse 透明度。 */
  resolvePulseOpacity(progress: number): number;
  /** 解析 glow 透明度。 */
  resolveGlowOpacity(): number;
  /** 解析 pulse 描边颜色。 */
  resolvePulseStrokeColor(baseColor: string): string;
  /** 读取当前时间。 */
  now(): number;
  /** 清空当前全部动画。 */
  clear(): void;
  /** 推进一帧动画。 */
  handleFrame(timestamp: number): void;
}
