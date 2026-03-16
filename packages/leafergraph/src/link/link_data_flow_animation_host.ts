/**
 * 连线数据流动画宿主模块。
 *
 * @remarks
 * 负责在正式 `setOutputData(...)` 命中真实连线传播时，
 * 在连线层上播放瞬时脉冲粒子动画。
 */

import type { LeaferGraphLinkData } from "@leafergraph/node";
import { Group, Rect } from "leafer-ui";
import type { LeaferGraphThemeMode } from "../api/plugin";
import type { LeaferGraphDataFlowAnimationStyleConfig } from "../graph/graph_runtime_style";
import type { NodeShellLayoutMetrics } from "../node/node_layout";
import type { LeaferGraphLinkPropagationEvent } from "../node/node_runtime_host";
import { sampleLinkCurvePoint } from "./link";
import {
  resolveGraphLinkCurve,
  type LeaferGraphLinkNodeState
} from "./link_host";

interface LeaferGraphLinkDataFlowAnimationHostOptions<
  TNodeState extends LeaferGraphLinkNodeState
> {
  container: HTMLElement;
  linkLayer: Group;
  graphNodes: Map<string, TNodeState>;
  graphLinks: Map<string, LeaferGraphLinkData>;
  layoutMetrics: NodeShellLayoutMetrics;
  defaultNodeWidth: number;
  portSize: number;
  linkStroke: string;
  slotTypeFillMap: Readonly<Record<string, string>>;
  style: LeaferGraphDataFlowAnimationStyleConfig;
  getThemeMode(): LeaferGraphThemeMode;
  requestRender(): void;
  renderFrame(): void;
  subscribeLinkPropagation(
    listener: (event: LeaferGraphLinkPropagationEvent) => void
  ): () => void;
}

interface LeaferGraphActiveDataFlowParticle {
  id: string;
  linkId: string;
  startedAt: number;
  glow: Rect;
  core: Rect;
}

let dataFlowParticleSeed = 1;

/**
 * 连线数据流动画宿主。
 *
 * @remarks
 * 第一版只做真实传播时的视觉反馈：
 * - 不改变执行顺序
 * - 不等待动画结束
 * - 不覆盖连接预览线和缺失态
 */
export class LeaferGraphLinkDataFlowAnimationHost<
  TNodeState extends LeaferGraphLinkNodeState
> {
  private readonly options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>;

  private readonly overlayGroup: Group;

  private readonly activeParticles: LeaferGraphActiveDataFlowParticle[] = [];

  private readonly ownerWindow: Window | null;

  private readonly reducedMotionMediaQuery: MediaQueryList | null;

  private readonly disposeLinkPropagationSubscription: () => void;

  private frameId: number | null = null;

  constructor(
    options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>
  ) {
    this.options = options;
    this.ownerWindow = resolveOwnerWindow(options.container);
    this.overlayGroup = new Group({
      name: "graph-link-data-flow-overlay",
      hitSelf: false,
      hitChildren: false,
      zIndex: 999998
    });
    this.restoreLayer();
    this.disposeLinkPropagationSubscription =
      options.subscribeLinkPropagation((event) => {
        this.handleLinkPropagation(event);
      });
    this.reducedMotionMediaQuery = this.ownerWindow?.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ) ?? null;
    this.attachReducedMotionListener();
  }

  /** 在外部清空连线层后，把动画 overlay 稳定补回去。 */
  restoreLayer(): void {
    this.overlayGroup.remove();
    this.options.linkLayer.add(this.overlayGroup);
  }

  /** 清空当前全部活动粒子，并停止 RAF 驱动。 */
  clear(): void {
    const hadParticles = this.activeParticles.length > 0;

    this.stopLoop();
    this.activeParticles.length = 0;
    this.overlayGroup.removeAll();

    if (hadParticles) {
      this.options.renderFrame();
    }
  }

  /** 销毁宿主并清理订阅、动画状态与 overlay 图元。 */
  destroy(): void {
    this.disposeLinkPropagationSubscription();
    this.detachReducedMotionListener();
    this.clear();
    this.overlayGroup.remove();
  }

  /** 命中一条真实传播事件后，创建对应的脉冲粒子。 */
  private handleLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    if (this.shouldReduceMotion() || !this.ownerWindow) {
      return;
    }

    const particle = this.createParticle(event);
    if (!particle) {
      return;
    }

    while (this.activeParticles.length >= this.options.style.maxParticles) {
      const oldestParticle = this.activeParticles.shift();
      if (oldestParticle) {
        this.removeParticle(oldestParticle);
      }
    }

    this.activeParticles.push(particle);
    this.overlayGroup.add([particle.glow, particle.core]);
    this.updateParticle(particle, this.now());
    this.ensureLoop();
    this.options.renderFrame();
  }

  /** 创建单个瞬时粒子。 */
  private createParticle(
    event: LeaferGraphLinkPropagationEvent
  ): LeaferGraphActiveDataFlowParticle | null {
    const link = this.options.graphLinks.get(event.linkId);
    if (!link) {
      return null;
    }

    const sourceNode = this.options.graphNodes.get(link.source.nodeId);
    const targetNode = this.options.graphNodes.get(link.target.nodeId);
    if (!sourceNode || !targetNode) {
      return null;
    }

    const color = resolveSlotColor(
      sourceNode,
      event.sourceSlot,
      this.options.slotTypeFillMap,
      this.options.linkStroke
    );
    const glow = new Rect({
      name: `graph-link-data-flow-glow-${dataFlowParticleSeed}`,
      x: 0,
      y: 0,
      width: this.options.style.glowSize,
      height: this.options.style.glowSize,
      cornerRadius: 999,
      fill: color,
      opacity: 0,
      hitSelf: false,
      hitChildren: false
    });
    const core = new Rect({
      name: `graph-link-data-flow-core-${dataFlowParticleSeed}`,
      x: 0,
      y: 0,
      width: this.options.style.particleSize,
      height: this.options.style.particleSize,
      cornerRadius: 999,
      fill: color,
      opacity: 0,
      hitSelf: false,
      hitChildren: false
    });

    const particleId = `link-flow:${event.linkId}:${dataFlowParticleSeed}`;
    dataFlowParticleSeed += 1;

    return {
      id: particleId,
      linkId: event.linkId,
      startedAt: this.now(),
      glow,
      core
    };
  }

  /** 统一推进一帧粒子动画。 */
  private updateFrame = (timestamp: number): void => {
    this.frameId = null;

    if (!this.activeParticles.length) {
      return;
    }

    if (this.shouldReduceMotion()) {
      this.clear();
      return;
    }

    let hasVisualMutation = false;

    for (let index = this.activeParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.activeParticles[index];
      const active = this.updateParticle(particle, timestamp);

      if (!active) {
        this.activeParticles.splice(index, 1);
        this.removeParticle(particle);
        hasVisualMutation = true;
        continue;
      }

      hasVisualMutation = true;
    }

    if (hasVisualMutation) {
      this.overlayGroup.forceUpdate();
      this.options.renderFrame();
    }

    if (this.activeParticles.length) {
      this.ensureLoop();
    }
  };

  /** 更新单个粒子的当前位置和透明度。 */
  private updateParticle(
    particle: LeaferGraphActiveDataFlowParticle,
    timestamp: number
  ): boolean {
    const link = this.options.graphLinks.get(particle.linkId);
    if (!link) {
      return false;
    }

    const sourceNode = this.options.graphNodes.get(link.source.nodeId);
    const targetNode = this.options.graphNodes.get(link.target.nodeId);
    if (!sourceNode || !targetNode) {
      return false;
    }

    const progress = clamp01(
      (timestamp - particle.startedAt) / this.options.style.durationMs
    );
    if (progress >= 1) {
      return false;
    }

    const curve = resolveGraphLinkCurve({
      source: sourceNode,
      target: targetNode,
      sourceSlot: normalizeSafeSlot(link.source.slot),
      targetSlot: normalizeSafeSlot(link.target.slot),
      layoutMetrics: this.options.layoutMetrics,
      defaultNodeWidth: this.options.defaultNodeWidth,
      portSize: this.options.portSize
    });
    const point = sampleLinkCurvePoint(curve, easeOutCubic(progress));
    const opacity = resolveParticleOpacity(
      progress,
      this.options.style.fadeInRatio,
      this.options.style.fadeOutRatio
    );
    particle.glow.x = point[0] - this.options.style.glowSize / 2;
    particle.glow.y = point[1] - this.options.style.glowSize / 2;
    particle.glow.opacity = this.resolveGlowOpacity() * opacity;
    particle.core.x = point[0] - this.options.style.particleSize / 2;
    particle.core.y = point[1] - this.options.style.particleSize / 2;
    particle.core.opacity = this.options.style.coreOpacity * opacity;
    particle.glow.forceUpdate();
    particle.core.forceUpdate();
    return true;
  }

  /** 删除单个粒子图元。 */
  private removeParticle(particle: LeaferGraphActiveDataFlowParticle): void {
    particle.glow.remove();
    particle.core.remove();
  }

  /** 若当前没有活动 RAF，则启动统一动画循环。 */
  private ensureLoop(): void {
    if (this.frameId !== null || !this.ownerWindow) {
      return;
    }

    this.frameId = this.ownerWindow.requestAnimationFrame(this.updateFrame);
  }

  /** 停止当前 RAF 循环。 */
  private stopLoop(): void {
    if (this.frameId === null || !this.ownerWindow) {
      return;
    }

    this.ownerWindow.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  /** 解析当前主题模式下的 glow 透明度。 */
  private resolveGlowOpacity(): number {
    return this.options.getThemeMode() === "dark"
      ? this.options.style.darkGlowOpacity
      : this.options.style.lightGlowOpacity;
  }

  /** 当前环境是否要求减少动态效果。 */
  private shouldReduceMotion(): boolean {
    return Boolean(this.reducedMotionMediaQuery?.matches);
  }

  /** 读取统一时钟。 */
  private now(): number {
    return this.ownerWindow?.performance?.now?.() ?? Date.now();
  }

  /** 在支持时监听 `prefers-reduced-motion` 变化。 */
  private attachReducedMotionListener(): void {
    if (!this.reducedMotionMediaQuery) {
      return;
    }

    const listener = this.handleReducedMotionChange;
    if ("addEventListener" in this.reducedMotionMediaQuery) {
      this.reducedMotionMediaQuery.addEventListener("change", listener);
      return;
    }

    const legacyMediaQuery =
      this.reducedMotionMediaQuery as MediaQueryList & {
        addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      };
    legacyMediaQuery.addListener?.(listener);
  }

  /** 清理 `prefers-reduced-motion` 监听。 */
  private detachReducedMotionListener(): void {
    if (!this.reducedMotionMediaQuery) {
      return;
    }

    const listener = this.handleReducedMotionChange;
    if ("removeEventListener" in this.reducedMotionMediaQuery) {
      this.reducedMotionMediaQuery.removeEventListener("change", listener);
      return;
    }

    const legacyMediaQuery =
      this.reducedMotionMediaQuery as MediaQueryList & {
        removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      };
    legacyMediaQuery.removeListener?.(listener);
  }

  /** 用户偏好切到减少动态时，立刻清空当前动画。 */
  private readonly handleReducedMotionChange = (
    event: MediaQueryListEvent
  ): void => {
    if (event.matches) {
      this.clear();
    }
  };
}

function resolveOwnerWindow(container: HTMLElement): Window | null {
  return (
    container.ownerDocument.defaultView ??
    (typeof window === "undefined" ? null : window)
  );
}

function normalizeSafeSlot(slot: number | undefined): number {
  if (typeof slot !== "number" || !Number.isFinite(slot)) {
    return 0;
  }

  return Math.max(0, Math.floor(slot));
}

function resolveSlotColor<TNodeState extends LeaferGraphLinkNodeState>(
  node: TNodeState,
  outputSlot: number,
  slotTypeFillMap: Readonly<Record<string, string>>,
  fallback: string
): string {
  const slot = node.outputs[normalizeSafeSlot(outputSlot)];
  const directColor =
    typeof slot?.color === "string" ? slot.color.trim() : undefined;
  if (directColor) {
    return directColor;
  }

  const slotType = slot?.type;
  if (slotType !== undefined) {
    const mapped = slotTypeFillMap[String(slotType)];
    if (mapped) {
      return mapped;
    }
  }

  return fallback;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function easeOutCubic(progress: number): number {
  const safeProgress = clamp01(progress);
  return 1 - Math.pow(1 - safeProgress, 3);
}

function resolveParticleOpacity(
  progress: number,
  fadeInRatio: number,
  fadeOutRatio: number
): number {
  const safeProgress = clamp01(progress);
  const safeFadeIn = Math.min(Math.max(fadeInRatio, 0.01), 0.5);
  const safeFadeOut = Math.min(Math.max(fadeOutRatio, 0.01), 0.5);

  if (safeProgress <= safeFadeIn) {
    return safeProgress / safeFadeIn;
  }

  if (safeProgress >= 1 - safeFadeOut) {
    return (1 - safeProgress) / safeFadeOut;
  }

  return 1;
}
