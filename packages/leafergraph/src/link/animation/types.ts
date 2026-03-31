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
  container: HTMLElement;
  linkLayer: Group;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, GraphLink>;
  layoutMetrics: NodeShellLayoutMetrics;
  defaultNodeWidth: number;
  portSize: number;
  resolveLinkStroke(): string;
  resolveSlotTypeFillMap(): Readonly<Record<string, string>>;
  resolveStyle(): LeaferGraphDataFlowAnimationStyleConfig;
  getThemeMode(): LeaferGraphThemeMode;
  requestRender(): void;
  renderFrame(): void;
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
  link: GraphLink;
  sourceNode: TNodeState;
  targetNode: TNodeState;
  sourceSlot: number;
  targetSlot: number;
  color: string;
}

/**
 * 正在播放的 pulse 效果。
 */
export interface LeaferGraphActiveDataFlowPulse {
  id: string;
  linkId: string;
  startedAt: number;
  view: Arrow;
}

/**
 * 正在播放的 travelling 粒子效果。
 */
export interface LeaferGraphActiveDataFlowParticle {
  id: string;
  linkId: string;
  startedAt: number;
  glow: Rect;
  core: Rect;
}

/**
 * 动画子模块之间共享的最小运行时能力。
 */
export interface LeaferGraphLinkDataFlowAnimationRuntime<
  TNodeState extends LeaferGraphLinkNodeState
> {
  readonly options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>;
  readonly overlayGroup: Group;
  readonly activePulses: LeaferGraphActiveDataFlowPulse[];
  readonly activeParticles: LeaferGraphActiveDataFlowParticle[];
  readonly ownerWindow: Window | null;
  readonly reducedMotionMediaQuery: MediaQueryList | null;
  getFrameId(): number | null;
  setFrameId(frameId: number | null): void;
  getStyle(): LeaferGraphDataFlowAnimationStyleConfig;
  shouldReduceMotion(): boolean;
  resolveAnimatedLink(
    linkId: string,
    sourceSlotOverride?: number
  ): LeaferGraphResolvedAnimatedLink<TNodeState> | null;
  resolvePulseOpacity(progress: number): number;
  resolveGlowOpacity(): number;
  resolvePulseStrokeColor(baseColor: string): string;
  now(): number;
  clear(): void;
  handleFrame(timestamp: number): void;
}
