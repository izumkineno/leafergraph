/**
 * 连线数据流动画宿主模块。
 *
 * @remarks
 * 负责在正式 `setOutputData(...)` 命中真实连线传播时，
 * 在连线层上播放预设化的运行时反馈动画。
 */

import type { GraphLink } from "@leafergraph/node";
import { Arrow } from "@leafer-in/arrow";
import { Group, Rect } from "leafer-ui";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/contracts";
import type { LeaferGraphThemeMode } from "@leafergraph/theme";
import type { LeaferGraphDataFlowAnimationStyleConfig } from "../graph/graph_runtime_style";
import type { NodeShellLayoutMetrics } from "../node/node_layout";
import { buildLinkPathFromCurve, sampleLinkCurvePoint } from "./link";
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

interface LeaferGraphResolvedAnimatedLink<
  TNodeState extends LeaferGraphLinkNodeState
> {
  link: GraphLink;
  sourceNode: TNodeState;
  targetNode: TNodeState;
  sourceSlot: number;
  targetSlot: number;
  color: string;
}

interface LeaferGraphActiveDataFlowPulse {
  id: string;
  linkId: string;
  startedAt: number;
  view: Arrow;
}

interface LeaferGraphActiveDataFlowParticle {
  id: string;
  linkId: string;
  startedAt: number;
  glow: Rect;
  core: Rect;
}

let dataFlowPulseSeed = 1;
let dataFlowParticleSeed = 1;

/**
 * 连线数据流动画宿主。
 *
 * @remarks
 * 当前只负责真实传播时的视觉反馈：
 * - 不改变执行顺序
 * - 不等待动画结束
 * - 不覆盖连接预览线和缺失态
 */
export class LeaferGraphLinkDataFlowAnimationHost<
  TNodeState extends LeaferGraphLinkNodeState
> {
  private readonly options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>;

  private readonly overlayGroup: Group;

  private readonly activePulses: LeaferGraphActiveDataFlowPulse[] = [];

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

  /** 清空当前全部活动动画，并停止 RAF 驱动。 */
  clear(): void {
    const hadEffects =
      this.activePulses.length > 0 || this.activeParticles.length > 0;

    this.stopLoop();
    this.activePulses.length = 0;
    this.activeParticles.length = 0;
    this.overlayGroup.removeAll();

    if (hadEffects) {
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

  /** 命中一条真实传播事件后，按预设触发对应视觉反馈。 */
  private handleLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    const style = this.getStyle();
    if (
      !style.enabled ||
      this.shouldReduceMotion() ||
      !this.ownerWindow
    ) {
      return;
    }

    switch (style.preset) {
      case "balanced":
        this.triggerParticle(event);
        break;
      case "expressive":
        this.triggerPulse(event);
        this.triggerParticle(event);
        break;
      case "performance":
      default:
        this.triggerPulse(event);
        break;
    }

    if (!this.hasActiveEffects()) {
      return;
    }

    this.ensureLoop();
    this.options.renderFrame();
  }

  /** 触发整条连线 pulse，高频场景下默认复用同一条 link 的现有 pulse。 */
  private triggerPulse(event: LeaferGraphLinkPropagationEvent): void {
    const style = this.getStyle();
    if (style.maxPulses <= 0) {
      return;
    }

    const existingPulse = this.activePulses.find(
      (pulse) => pulse.linkId === event.linkId
    );
    if (existingPulse) {
      existingPulse.startedAt = this.now();
      this.updatePulse(existingPulse, existingPulse.startedAt);
      return;
    }

    const pulse = this.createPulse(event);
    if (!pulse) {
      return;
    }

    while (this.activePulses.length >= style.maxPulses) {
      const oldestPulse = this.activePulses.shift();
      if (oldestPulse) {
        this.removePulse(oldestPulse);
      }
    }

    this.activePulses.push(pulse);
    this.overlayGroup.add(pulse.view);
    this.updatePulse(pulse, this.now());
  }

  /** 触发 travelling comet。 */
  private triggerParticle(event: LeaferGraphLinkPropagationEvent): void {
    const style = this.getStyle();
    if (style.maxParticles <= 0) {
      return;
    }

    const particle = this.createParticle(event);
    if (!particle) {
      return;
    }

    while (this.activeParticles.length >= style.maxParticles) {
      const oldestParticle = this.activeParticles.shift();
      if (oldestParticle) {
        this.removeParticle(oldestParticle);
      }
    }

    this.activeParticles.push(particle);
    this.overlayGroup.add([particle.glow, particle.core]);
    this.updateParticle(particle, this.now());
  }

  /** 创建单条连线 pulse。 */
  private createPulse(
    event: LeaferGraphLinkPropagationEvent
  ): LeaferGraphActiveDataFlowPulse | null {
    const resolvedLink = this.resolveAnimatedLink(event.linkId, event.sourceSlot);
    if (!resolvedLink) {
      return null;
    }

    const curve = resolveGraphLinkCurve({
      source: resolvedLink.sourceNode,
      target: resolvedLink.targetNode,
      sourceSlot: resolvedLink.sourceSlot,
      targetSlot: resolvedLink.targetSlot,
      layoutMetrics: this.options.layoutMetrics,
      defaultNodeWidth: this.options.defaultNodeWidth,
      portSize: this.options.portSize
    });
    const style = this.getStyle();
    const view = new Arrow({
      name: `graph-link-data-flow-pulse-${dataFlowPulseSeed}`,
      path: buildLinkPathFromCurve(curve),
      endArrow: "none",
      fill: "transparent",
      stroke: this.resolvePulseStrokeColor(resolvedLink.color),
      strokeWidth:
        style.pulseBaseStrokeWidth + style.pulseExtraStrokeWidth,
      strokeCap: "round",
      strokeJoin: "round",
      opacity: this.resolvePulseOpacity(0),
      hittable: false,
      hitSelf: false
    });

    const pulseId = `link-pulse:${event.linkId}:${dataFlowPulseSeed}`;
    dataFlowPulseSeed += 1;

    return {
      id: pulseId,
      linkId: event.linkId,
      startedAt: this.now(),
      view
    };
  }

  /** 创建 travelling comet。 */
  private createParticle(
    event: LeaferGraphLinkPropagationEvent
  ): LeaferGraphActiveDataFlowParticle | null {
    const resolvedLink = this.resolveAnimatedLink(event.linkId, event.sourceSlot);
    if (!resolvedLink) {
      return null;
    }
    const style = this.getStyle();

    const glow = new Rect({
      name: `graph-link-data-flow-glow-${dataFlowParticleSeed}`,
      x: 0,
      y: 0,
      width: style.glowSize,
      height: style.glowSize,
      cornerRadius: 999,
      fill: resolvedLink.color,
      opacity: 0,
      hitSelf: false,
      hitChildren: false
    });
    const core = new Rect({
      name: `graph-link-data-flow-core-${dataFlowParticleSeed}`,
      x: 0,
      y: 0,
      width: style.particleSize,
      height: style.particleSize,
      cornerRadius: 999,
      fill: resolvedLink.color,
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

  /** 统一推进一帧动画。 */
  private updateFrame = (timestamp: number): void => {
    this.frameId = null;

    if (!this.hasActiveEffects()) {
      return;
    }

    if (!this.getStyle().enabled || this.shouldReduceMotion()) {
      this.clear();
      return;
    }

    let hasVisualMutation = false;

    for (let index = this.activePulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.activePulses[index];
      const active = this.updatePulse(pulse, timestamp);
      if (!active) {
        this.activePulses.splice(index, 1);
        this.removePulse(pulse);
        hasVisualMutation = true;
        continue;
      }

      hasVisualMutation = true;
    }

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

    if (this.hasActiveEffects()) {
      this.ensureLoop();
    }
  };

  /** 更新单条连线 pulse 的路径、透明度和描边宽度。 */
  private updatePulse(
    pulse: LeaferGraphActiveDataFlowPulse,
    timestamp: number
  ): boolean {
    const resolvedLink = this.resolveAnimatedLink(pulse.linkId);
    if (!resolvedLink) {
      return false;
    }

    const progress = clamp01(
      (timestamp - pulse.startedAt) / this.getStyle().pulseDurationMs
    );
    if (progress >= 1) {
      return false;
    }

    const curve = resolveGraphLinkCurve({
      source: resolvedLink.sourceNode,
      target: resolvedLink.targetNode,
      sourceSlot: resolvedLink.sourceSlot,
      targetSlot: resolvedLink.targetSlot,
      layoutMetrics: this.options.layoutMetrics,
      defaultNodeWidth: this.options.defaultNodeWidth,
      portSize: this.options.portSize
    });
    const inverseProgress = 1 - easeOutCubic(progress);
    const style = this.getStyle();
    pulse.view.path = buildLinkPathFromCurve(curve);
    pulse.view.stroke = this.resolvePulseStrokeColor(resolvedLink.color);
    pulse.view.opacity = this.resolvePulseOpacity(progress);
    pulse.view.strokeWidth =
      style.pulseBaseStrokeWidth + style.pulseExtraStrokeWidth * inverseProgress;
    pulse.view.forceUpdate();
    return true;
  }

  /** 更新 travelling comet 的当前位置和透明度。 */
  private updateParticle(
    particle: LeaferGraphActiveDataFlowParticle,
    timestamp: number
  ): boolean {
    const resolvedLink = this.resolveAnimatedLink(particle.linkId);
    if (!resolvedLink) {
      return false;
    }

    const progress = clamp01(
      (timestamp - particle.startedAt) / this.getStyle().durationMs
    );
    if (progress >= 1) {
      return false;
    }

    const curve = resolveGraphLinkCurve({
      source: resolvedLink.sourceNode,
      target: resolvedLink.targetNode,
      sourceSlot: resolvedLink.sourceSlot,
      targetSlot: resolvedLink.targetSlot,
      layoutMetrics: this.options.layoutMetrics,
      defaultNodeWidth: this.options.defaultNodeWidth,
      portSize: this.options.portSize
    });
    const style = this.getStyle();
    const point = sampleLinkCurvePoint(curve, easeOutCubic(progress));
    const opacity = resolveParticleOpacity(
      progress,
      style.fadeInRatio,
      style.fadeOutRatio
    );

    particle.glow.fill = resolvedLink.color;
    particle.glow.x = point[0] - style.glowSize / 2;
    particle.glow.y = point[1] - style.glowSize / 2;
    particle.glow.opacity = this.resolveGlowOpacity() * opacity;
    particle.core.fill = resolvedLink.color;
    particle.core.x = point[0] - style.particleSize / 2;
    particle.core.y = point[1] - style.particleSize / 2;
    particle.core.opacity = style.coreOpacity * opacity;
    particle.glow.forceUpdate();
    particle.core.forceUpdate();
    return true;
  }

  /** 根据当前图状态解析一条可动画化的连线。 */
  private resolveAnimatedLink(
    linkId: string,
    sourceSlotOverride?: number
  ): LeaferGraphResolvedAnimatedLink<TNodeState> | null {
    const link = this.options.graphLinks.get(linkId);
    if (!link) {
      return null;
    }

    const sourceNode = this.options.graphNodes.get(link.source.nodeId);
    const targetNode = this.options.graphNodes.get(link.target.nodeId);
    if (!sourceNode || !targetNode) {
      return null;
    }

    const sourceSlot = normalizeSafeSlot(sourceSlotOverride ?? link.source.slot);
    const targetSlot = normalizeSafeSlot(link.target.slot);

    return {
      link,
      sourceNode,
      targetNode,
      sourceSlot,
      targetSlot,
      color: resolveSlotColor(
        sourceNode,
        sourceSlot,
        this.options.resolveSlotTypeFillMap(),
        this.options.resolveLinkStroke()
      )
    };
  }

  /** 删除单条 pulse 图元。 */
  private removePulse(pulse: LeaferGraphActiveDataFlowPulse): void {
    pulse.view.remove();
  }

  /** 删除单个粒子图元。 */
  private removeParticle(particle: LeaferGraphActiveDataFlowParticle): void {
    particle.glow.remove();
    particle.core.remove();
  }

  /** 当前是否还有活动动画。 */
  private hasActiveEffects(): boolean {
    return this.activePulses.length > 0 || this.activeParticles.length > 0;
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

  /** 解析当前主题模式下 pulse 的基础透明度。 */
  private resolvePulseOpacity(progress: number): number {
    const style = this.getStyle();
    const baseOpacity =
      this.options.getThemeMode() === "dark"
        ? style.pulseDarkOpacity
        : style.pulseLightOpacity;
    return baseOpacity * (1 - clamp01(progress));
  }

  /** 解析当前主题模式下 glow 透明度。 */
  private resolveGlowOpacity(): number {
    const style = this.getStyle();
    return this.options.getThemeMode() === "dark"
      ? style.darkGlowOpacity
      : style.lightGlowOpacity;
  }

  /**
   * pulse 不能继续和底线使用完全同色。
   * 同色叠加在已经不透明的底线上时，中间大部分像素几乎不会变化，
   * 默认 performance 预设肉眼就只剩两侧一点宽度差，看起来像没有动画。
   */
  private resolvePulseStrokeColor(baseColor: string): string {
    const mixedColor = mixColorToward(
      baseColor,
      "#ffffff",
      this.options.getThemeMode() === "dark" ? 0.78 : 0.88
    );

    return mixedColor ?? baseColor;
  }

  /** 每次按当前主题模式读取动画样式，避免继续使用初始化快照。 */
  private getStyle(): LeaferGraphDataFlowAnimationStyleConfig {
    return this.options.resolveStyle();
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

function mixColorToward(
  baseColor: string,
  targetColor: string,
  ratio: number
): string | null {
  const baseRgba = parseCssColor(baseColor);
  const targetRgba = parseCssColor(targetColor);
  if (!baseRgba || !targetRgba) {
    return null;
  }

  const safeRatio = clamp01(ratio);
  const mixedAlpha = baseRgba.a + (targetRgba.a - baseRgba.a) * safeRatio;

  return formatCssColor({
    r: mixChannel(baseRgba.r, targetRgba.r, safeRatio),
    g: mixChannel(baseRgba.g, targetRgba.g, safeRatio),
    b: mixChannel(baseRgba.b, targetRgba.b, safeRatio),
    a: mixedAlpha
  });
}

function mixChannel(base: number, target: number, ratio: number): number {
  return Math.round(base + (target - base) * clamp01(ratio));
}

function parseCssColor(
  color: string
): { r: number; g: number; b: number; a: number } | null {
  const normalized = color.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("#")) {
    return parseHexColor(normalized);
  }

  const rgbaMatch = normalized.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i
  );
  if (!rgbaMatch) {
    return null;
  }

  return {
    r: clampColorChannel(Number(rgbaMatch[1])),
    g: clampColorChannel(Number(rgbaMatch[2])),
    b: clampColorChannel(Number(rgbaMatch[3])),
    a: clampAlpha(Number(rgbaMatch[4] ?? 1))
  };
}

function parseHexColor(
  color: string
): { r: number; g: number; b: number; a: number } | null {
  const hex = color.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a = "f"] = hex.split("");
    return {
      r: clampColorChannel(Number.parseInt(r + r, 16)),
      g: clampColorChannel(Number.parseInt(g + g, 16)),
      b: clampColorChannel(Number.parseInt(b + b, 16)),
      a: clampAlpha(Number.parseInt(a + a, 16) / 255)
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      r: clampColorChannel(Number.parseInt(hex.slice(0, 2), 16)),
      g: clampColorChannel(Number.parseInt(hex.slice(2, 4), 16)),
      b: clampColorChannel(Number.parseInt(hex.slice(4, 6), 16)),
      a: clampAlpha(
        hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      )
    };
  }

  return null;
}

function formatCssColor(color: {
  r: number;
  g: number;
  b: number;
  a: number;
}): string {
  const alpha = Math.round(clampAlpha(color.a) * 1000) / 1000;
  return `rgba(${clampColorChannel(color.r)}, ${clampColorChannel(color.g)}, ${clampColorChannel(color.b)}, ${alpha})`;
}

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
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
