/**
 * 连线数据流动画 controller。
 *
 * @remarks
 * 负责持有动画状态，并把正式连线解析、效果创建和帧循环委托给 `animation/*` 子模块。
 */

import { Group } from "leafer-ui";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/core/contracts";
import { clamp01, mixColorToward } from "./color";
import {
  attachLeaferGraphReducedMotionListener,
  detachLeaferGraphReducedMotionListener,
  resolveLeaferGraphAnimationOwnerWindow
} from "./environment";
import {
  triggerLeaferGraphLinkDataFlowParticle,
  triggerLeaferGraphLinkDataFlowPulse
} from "./effects";
import {
  ensureLeaferGraphLinkDataFlowLoop,
  hasLeaferGraphLinkDataFlowActiveEffects,
  stopLeaferGraphLinkDataFlowLoop,
  updateLeaferGraphLinkDataFlowFrame
} from "./frame_loop";
import type {
  LeaferGraphActiveDataFlowParticle,
  LeaferGraphActiveDataFlowPulse,
  LeaferGraphLinkAnimationNodeState,
  LeaferGraphLinkDataFlowAnimationHostOptions,
  LeaferGraphLinkDataFlowAnimationRuntime
} from "./types";

export class LeaferGraphLinkDataFlowAnimationHost<
  TNodeState extends LeaferGraphLinkAnimationNodeState
> {
  private readonly options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>;
  private readonly overlayGroup: Group;
  private readonly activePulses: LeaferGraphActiveDataFlowPulse[] = [];
  private readonly activeParticles: LeaferGraphActiveDataFlowParticle[] = [];
  private readonly ownerWindow: Window | null;
  private readonly reducedMotionMediaQuery: MediaQueryList | null;
  private readonly disposeLinkPropagationSubscription: () => void;
  private readonly runtime: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>;
  private frameId: number | null = null;

  constructor(options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>) {
    this.options = options;
    this.ownerWindow = resolveLeaferGraphAnimationOwnerWindow(options.container);
    this.overlayGroup = new Group({
      name: "graph-link-data-flow-overlay",
      hitSelf: false,
      hitChildren: false,
      zIndex: 999998
    });
    this.reducedMotionMediaQuery =
      this.ownerWindow?.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;

    const runtime: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState> = {
      options: this.options,
      overlayGroup: this.overlayGroup,
      activePulses: this.activePulses,
      activeParticles: this.activeParticles,
      ownerWindow: this.ownerWindow,
      reducedMotionMediaQuery: this.reducedMotionMediaQuery,
      getFrameId: () => this.frameId,
      setFrameId: (frameId) => {
        this.frameId = frameId;
      },
      getStyle: () => this.getStyle(),
      shouldReduceMotion: () => this.shouldReduceMotion(),
      resolveAnimatedLink: (linkId, sourceSlotOverride) =>
        this.resolveAnimatedLink(linkId, sourceSlotOverride),
      resolvePulseOpacity: (progress) => this.resolvePulseOpacity(progress),
      resolveGlowOpacity: () => this.resolveGlowOpacity(),
      resolvePulseStrokeColor: (baseColor) =>
        this.resolvePulseStrokeColor(baseColor),
      now: () => this.now(),
      clear: () => this.clear(),
      handleFrame: (timestamp) => updateLeaferGraphLinkDataFlowFrame(runtime, timestamp)
    };
    this.runtime = runtime;

    this.restoreLayer();
    this.disposeLinkPropagationSubscription = options.subscribeLinkPropagation(
      (event) => {
        this.handleLinkPropagation(event);
      }
    );
    attachLeaferGraphReducedMotionListener(
      this.reducedMotionMediaQuery,
      this.handleReducedMotionChange
    );
  }

  restoreLayer(): void {
    this.overlayGroup.remove();
    this.options.linkLayer.add(this.overlayGroup);
  }

  clear(): void {
    const hadEffects = hasLeaferGraphLinkDataFlowActiveEffects(this.runtime);

    stopLeaferGraphLinkDataFlowLoop(this.runtime);
    this.activePulses.length = 0;
    this.activeParticles.length = 0;
    this.overlayGroup.removeAll();

    if (hadEffects) {
      this.options.requestRender();
    }
  }

  destroy(): void {
    this.disposeLinkPropagationSubscription();
    detachLeaferGraphReducedMotionListener(
      this.reducedMotionMediaQuery,
      this.handleReducedMotionChange
    );
    this.clear();
    this.overlayGroup.remove();
  }

  private handleLinkPropagation(event: LeaferGraphLinkPropagationEvent): void {
    const style = this.getStyle();
    if (!style.enabled || this.shouldReduceMotion() || !this.ownerWindow) {
      return;
    }

    switch (style.preset) {
      case "balanced":
        triggerLeaferGraphLinkDataFlowParticle(this.runtime, event);
        break;
      case "expressive":
        triggerLeaferGraphLinkDataFlowPulse(this.runtime, event);
        triggerLeaferGraphLinkDataFlowParticle(this.runtime, event);
        break;
      case "performance":
      default:
        triggerLeaferGraphLinkDataFlowPulse(this.runtime, event);
        break;
    }

    if (!hasLeaferGraphLinkDataFlowActiveEffects(this.runtime)) {
      return;
    }

    ensureLeaferGraphLinkDataFlowLoop(this.runtime);
    this.options.requestRender();
  }

  private resolveAnimatedLink(linkId: string, sourceSlotOverride?: number) {
    return this.options.resolveAnimatedLink(linkId, sourceSlotOverride);
  }

  private resolvePulseOpacity(progress: number): number {
    const style = this.getStyle();
    const baseOpacity =
      this.options.getThemeMode() === "dark"
        ? style.pulseDarkOpacity
        : style.pulseLightOpacity;
    return baseOpacity * (1 - clamp01(progress));
  }

  private resolveGlowOpacity(): number {
    const style = this.getStyle();
    return this.options.getThemeMode() === "dark"
      ? style.darkGlowOpacity
      : style.lightGlowOpacity;
  }

  private resolvePulseStrokeColor(baseColor: string): string {
    const mixedColor = mixColorToward(
      baseColor,
      "#ffffff",
      this.options.getThemeMode() === "dark" ? 0.78 : 0.88
    );

    return mixedColor ?? baseColor;
  }

  private getStyle() {
    return this.options.resolveStyle();
  }

  private shouldReduceMotion(): boolean {
    if (!this.options.respectReducedMotion) {
      return false;
    }

    return Boolean(this.reducedMotionMediaQuery?.matches);
  }

  private now(): number {
    return this.ownerWindow?.performance?.now?.() ?? Date.now();
  }

  private readonly handleReducedMotionChange = (
    event: MediaQueryListEvent
  ): void => {
    if (this.options.respectReducedMotion && event.matches) {
      this.clear();
    }
  };
}

export type { LeaferGraphLinkDataFlowAnimationHostOptions } from "./types";
