/**
 * 连线数据流动画内部类型模块。
 *
 * @remarks
 * 负责统一 controller、效果更新和环境适配层之间共享的类型结构。
 */

import type { Arrow } from "@leafer-in/arrow";
import type { GraphLink } from "@leafergraph/core/node";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/core/contracts";
import type {
  LeaferGraphDataFlowAnimationStyleConfig,
  LeaferGraphThemeMode,
  NodeShellLayoutMetrics
} from "@leafergraph/core/theme";
import type { Group, Rect } from "leafer-ui";

/**
 * 连线求解阶段只依赖节点布局和槽位结构。
 */
export type LeaferGraphLinkAnimationNodeState = Pick<
  import("@leafergraph/core/node").NodeRuntimeState,
  "layout" | "inputs" | "outputs" | "flags"
>;

/**
 * 动画层在单次传播中解析出的正式连线快照。
 */
export interface LeaferGraphResolvedAnimatedLink<
  TNodeState extends LeaferGraphLinkAnimationNodeState
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
  /** 当前正式连线的路径字符串。 */
  path: string;
  /** 按进度采样曲线上的一个世界坐标点。 */
  samplePoint(progress: number): readonly [number, number];
}

/**
 * 连线数据流动画宿主对外装配选项。
 */
export interface LeaferGraphLinkDataFlowAnimationHostOptions<
  TNodeState extends LeaferGraphLinkAnimationNodeState
> {
  /** 图容器元素。 */
  container: HTMLElement;
  /** 连线层。 */
  linkLayer: Group;
  /** 节点壳布局度量。 */
  layoutMetrics: NodeShellLayoutMetrics;
  /** 默认节点宽度。 */
  defaultNodeWidth: number;
  /** 端口尺寸。 */
  portSize: number;
  /** 解析当前动画样式。 */
  resolveStyle(): LeaferGraphDataFlowAnimationStyleConfig;
  /** 是否遵循系统 reduced motion 偏好。 */
  respectReducedMotion: boolean;
  /** 读取当前主题模式。 */
  getThemeMode(): LeaferGraphThemeMode;
  /** 请求宿主渲染一帧。 */
  requestRender(): void;
  /** 订阅连线传播事件。 */
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void;
  /** 按连线 ID 解析一条可动画的正式连线快照。 */
  resolveAnimatedLink(
    linkId: string,
    sourceSlotOverride?: number
  ): LeaferGraphResolvedAnimatedLink<TNodeState> | null;
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
  TNodeState extends LeaferGraphLinkAnimationNodeState
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
