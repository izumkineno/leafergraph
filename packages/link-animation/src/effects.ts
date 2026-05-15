/**
 * 连线数据流动画效果模块。
 *
 * @remarks
 * 负责 pulse / particle 的创建、复用与上限裁剪。
 */

import { Arrow } from "@leafer-in/arrow";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/core/contracts";
import { Rect } from "leafer-ui";
import {
  updateLeaferGraphLinkDataFlowParticle,
  updateLeaferGraphLinkDataFlowPulse
} from "./frame_loop";
import type {
  LeaferGraphActiveDataFlowParticle,
  LeaferGraphActiveDataFlowPulse,
  LeaferGraphLinkAnimationNodeState,
  LeaferGraphLinkDataFlowAnimationRuntime
} from "./types";

let dataFlowPulseSeed = 1;
let dataFlowParticleSeed = 1;

export function triggerLeaferGraphLinkDataFlowPulse<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  event: LeaferGraphLinkPropagationEvent
): void {
  const style = host.getStyle();
  if (style.maxPulses <= 0) {
    return;
  }

  const existingPulse = host.activePulses.find(
    (pulse) => pulse.linkId === event.linkId
  );
  if (existingPulse) {
    existingPulse.startedAt = host.now();
    updateLeaferGraphLinkDataFlowPulse(host, existingPulse, existingPulse.startedAt);
    return;
  }

  const pulse = createLeaferGraphLinkDataFlowPulse(host, event);
  if (!pulse) {
    return;
  }

  while (host.activePulses.length >= style.maxPulses) {
    const oldestPulse = host.activePulses.shift();
    if (oldestPulse) {
      removeLeaferGraphLinkDataFlowPulse(oldestPulse);
    }
  }

  host.activePulses.push(pulse);
  host.overlayGroup.add(pulse.view);
  updateLeaferGraphLinkDataFlowPulse(host, pulse, host.now());
}

export function triggerLeaferGraphLinkDataFlowParticle<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  event: LeaferGraphLinkPropagationEvent
): void {
  const style = host.getStyle();
  if (style.maxParticles <= 0) {
    return;
  }

  const particle = createLeaferGraphLinkDataFlowParticle(host, event);
  if (!particle) {
    return;
  }

  while (host.activeParticles.length >= style.maxParticles) {
    const oldestParticle = host.activeParticles.shift();
    if (oldestParticle) {
      removeLeaferGraphLinkDataFlowParticle(oldestParticle);
    }
  }

  host.activeParticles.push(particle);
  host.overlayGroup.add([particle.glow, particle.core]);
  updateLeaferGraphLinkDataFlowParticle(host, particle, host.now());
}

export function createLeaferGraphLinkDataFlowPulse<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  event: LeaferGraphLinkPropagationEvent
): LeaferGraphActiveDataFlowPulse | null {
  const resolvedLink = host.resolveAnimatedLink(event.linkId, event.sourceSlot);
  if (!resolvedLink) {
    return null;
  }

  const style = host.getStyle();
  const view = new Arrow({
    name: `graph-link-data-flow-pulse-${dataFlowPulseSeed}`,
    path: resolvedLink.path,
    endArrow: "none",
    fill: "transparent",
    stroke: host.resolvePulseStrokeColor(resolvedLink.color),
    strokeWidth: style.pulseBaseStrokeWidth + style.pulseExtraStrokeWidth,
    strokeCap: "round",
    strokeJoin: "round",
    opacity: host.resolvePulseOpacity(0),
    hittable: false,
    hitSelf: false
  });
  const pulseId = `link-pulse:${event.linkId}:${dataFlowPulseSeed}`;
  dataFlowPulseSeed += 1;

  return {
    id: pulseId,
    linkId: event.linkId,
    startedAt: host.now(),
    view
  };
}

export function createLeaferGraphLinkDataFlowParticle<
  TNodeState extends LeaferGraphLinkAnimationNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  event: LeaferGraphLinkPropagationEvent
): LeaferGraphActiveDataFlowParticle | null {
  const resolvedLink = host.resolveAnimatedLink(event.linkId, event.sourceSlot);
  if (!resolvedLink) {
    return null;
  }

  const style = host.getStyle();
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
    startedAt: host.now(),
    glow,
    core
  };
}

export function removeLeaferGraphLinkDataFlowPulse(
  pulse: LeaferGraphActiveDataFlowPulse
): void {
  pulse.view.remove();
}

export function removeLeaferGraphLinkDataFlowParticle(
  particle: LeaferGraphActiveDataFlowParticle
): void {
  particle.glow.remove();
  particle.core.remove();
}
