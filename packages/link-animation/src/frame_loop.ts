/**
 * 连线数据流动画帧循环模块。
 *
 * @remarks
 * 负责统一推进 pulse / particle 的生命周期和 RAF 循环。
 */

import { clamp01, easeOutCubic, resolveParticleOpacity } from "./color";
import type {
  LeaferGraphActiveDataFlowParticle,
  LeaferGraphActiveDataFlowPulse,
  LeaferGraphLinkAnimationNodeState,
  LeaferGraphLinkDataFlowAnimationRuntime
} from "./types";

export function hasLeaferGraphLinkDataFlowActiveEffects<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>): boolean {
  return host.activePulses.length > 0 || host.activeParticles.length > 0;
}

export function updateLeaferGraphLinkDataFlowFrame<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  timestamp: number
): void {
  host.setFrameId(null);

  if (!hasLeaferGraphLinkDataFlowActiveEffects(host)) {
    return;
  }

  if (!host.getStyle().enabled || host.shouldReduceMotion()) {
    host.clear();
    return;
  }

  let hasVisualMutation = false;

  for (let index = host.activePulses.length - 1; index >= 0; index -= 1) {
    const pulse = host.activePulses[index];
    const active = updateLeaferGraphLinkDataFlowPulse(host, pulse, timestamp);
    if (!active) {
      host.activePulses.splice(index, 1);
      pulse.view.remove();
      hasVisualMutation = true;
      continue;
    }

    hasVisualMutation = true;
  }

  for (let index = host.activeParticles.length - 1; index >= 0; index -= 1) {
    const particle = host.activeParticles[index];
    const active = updateLeaferGraphLinkDataFlowParticle(
      host,
      particle,
      timestamp
    );
    if (!active) {
      host.activeParticles.splice(index, 1);
      particle.glow.remove();
      particle.core.remove();
      hasVisualMutation = true;
      continue;
    }

    hasVisualMutation = true;
  }

  if (hasVisualMutation) {
    host.options.requestRender();
  }

  if (hasLeaferGraphLinkDataFlowActiveEffects(host)) {
    ensureLeaferGraphLinkDataFlowLoop(host);
  }
}

export function updateLeaferGraphLinkDataFlowPulse<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  pulse: LeaferGraphActiveDataFlowPulse,
  timestamp: number
): boolean {
  const resolvedLink = host.resolveAnimatedLink(pulse.linkId);
  if (!resolvedLink) {
    return false;
  }

  const progress = clamp01(
    (timestamp - pulse.startedAt) / host.getStyle().pulseDurationMs
  );
  if (progress >= 1) {
    return false;
  }

  const inverseProgress = 1 - easeOutCubic(progress);
  const style = host.getStyle();

  pulse.view.path = resolvedLink.path;
  pulse.view.stroke = host.resolvePulseStrokeColor(resolvedLink.color);
  pulse.view.opacity = host.resolvePulseOpacity(progress);
  pulse.view.strokeWidth =
    style.pulseBaseStrokeWidth + style.pulseExtraStrokeWidth * inverseProgress;
  return true;
}

export function updateLeaferGraphLinkDataFlowParticle<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  particle: LeaferGraphActiveDataFlowParticle,
  timestamp: number
): boolean {
  const resolvedLink = host.resolveAnimatedLink(particle.linkId);
  if (!resolvedLink) {
    return false;
  }

  const progress = clamp01(
    (timestamp - particle.startedAt) / host.getStyle().durationMs
  );
  if (progress >= 1) {
    return false;
  }

  const style = host.getStyle();
  const point = resolvedLink.samplePoint(easeOutCubic(progress));
  const opacity = resolveParticleOpacity(
    progress,
    style.fadeInRatio,
    style.fadeOutRatio
  );

  particle.glow.fill = resolvedLink.color;
  particle.glow.x = point[0] - style.glowSize / 2;
  particle.glow.y = point[1] - style.glowSize / 2;
  particle.glow.opacity = host.resolveGlowOpacity() * opacity;
  particle.core.fill = resolvedLink.color;
  particle.core.x = point[0] - style.particleSize / 2;
  particle.core.y = point[1] - style.particleSize / 2;
  particle.core.opacity = style.coreOpacity * opacity;
  return true;
}

export function ensureLeaferGraphLinkDataFlowLoop<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>): void {
  if (host.getFrameId() !== null || !host.ownerWindow) {
    return;
  }

  host.setFrameId(host.ownerWindow.requestAnimationFrame(host.handleFrame));
}

export function stopLeaferGraphLinkDataFlowLoop<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>): void {
  const frameId = host.getFrameId();
  if (frameId === null || !host.ownerWindow) {
    return;
  }

  host.ownerWindow.cancelAnimationFrame(frameId);
  host.setFrameId(null);
}
