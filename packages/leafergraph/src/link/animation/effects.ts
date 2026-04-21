/**
 * 连线数据流动画效果模块。
 *
 * @remarks
 * 负责 pulse / particle 的创建、复用与上限裁剪。
 */

import { Arrow } from "@leafer-in/arrow";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/core/contracts";
import { Rect } from "leafer-ui";
import { buildLinkPathFromCurve } from "../link";
import { resolveGraphLinkCurve } from "../curve";
import {
  updateLeaferGraphLinkDataFlowParticle,
  updateLeaferGraphLinkDataFlowPulse
} from "./frame_loop";
import type {
  LeaferGraphActiveDataFlowParticle,
  LeaferGraphActiveDataFlowPulse,
  LeaferGraphLinkDataFlowAnimationRuntime
} from "./types";
import type { LeaferGraphLinkNodeState } from "../curve";

let dataFlowPulseSeed = 1;
let dataFlowParticleSeed = 1;

/**
 * 触发整条连线的 pulse，高频场景下会优先复用同一条 link 的现有 pulse。
 *
 * @param host - 动画运行时壳面。
 * @param event - 当前传播事件。
 * @returns 无返回值。
 */
export function triggerLeaferGraphLinkDataFlowPulse<
  TNodeState extends LeaferGraphLinkNodeState
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

/**
 * 触发 travelling comet。
 *
 * @param host - 动画运行时壳面。
 * @param event - 当前传播事件。
 * @returns 无返回值。
 */
export function triggerLeaferGraphLinkDataFlowParticle<
  TNodeState extends LeaferGraphLinkNodeState
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

/**
 * 创建单条连线 pulse。
 *
 * @param host - 动画运行时壳面。
 * @param event - 当前传播事件。
 * @returns 创建后的 pulse；无法解析正式连线时返回 `null`。
 */
export function createLeaferGraphLinkDataFlowPulse<
  TNodeState extends LeaferGraphLinkNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  event: LeaferGraphLinkPropagationEvent
): LeaferGraphActiveDataFlowPulse | null {
  const resolvedLink = host.resolveAnimatedLink(event.linkId, event.sourceSlot);
  if (!resolvedLink) {
    return null;
  }

  const curve = resolveGraphLinkCurve({
    source: resolvedLink.sourceNode,
    target: resolvedLink.targetNode,
    sourceSlot: resolvedLink.sourceSlot,
    targetSlot: resolvedLink.targetSlot,
    layoutMetrics: host.options.layoutMetrics,
    defaultNodeWidth: host.options.defaultNodeWidth,
    portSize: host.options.portSize
  });
  const style = host.getStyle();
  const view = new Arrow({
    name: `graph-link-data-flow-pulse-${dataFlowPulseSeed}`,
    path: buildLinkPathFromCurve(curve),
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

/**
 * 创建 travelling 粒子。
 *
 * @param host - 动画运行时壳面。
 * @param event - 当前传播事件。
 * @returns 创建后的粒子；无法解析正式连线时返回 `null`。
 */
export function createLeaferGraphLinkDataFlowParticle<
  TNodeState extends LeaferGraphLinkNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  event: LeaferGraphLinkPropagationEvent
): LeaferGraphActiveDataFlowParticle | null {
  // 先把正式连线解析成可动画化快照；拿不到端点时直接跳过，避免创建悬空粒子。
  const resolvedLink = host.resolveAnimatedLink(event.linkId, event.sourceSlot);
  if (!resolvedLink) {
    return null;
  }

  const style = host.getStyle();
  // glow 负责扩散光晕，core 负责中心亮点，两者共享同一条传播链路但尺寸和透明度策略不同。
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
  // 最后再落成稳定的活动粒子对象，后续帧循环只需要更新位置和透明度即可。
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

/**
 * 删除单条 pulse 图元。
 *
 * @param pulse - 目标 pulse。
 * @returns 无返回值。
 */
export function removeLeaferGraphLinkDataFlowPulse(
  pulse: LeaferGraphActiveDataFlowPulse
): void {
  pulse.view.remove();
}

/**
 * 删除单个粒子图元。
 *
 * @param particle - 目标粒子。
 * @returns 无返回值。
 */
export function removeLeaferGraphLinkDataFlowParticle(
  particle: LeaferGraphActiveDataFlowParticle
): void {
  particle.glow.remove();
  particle.core.remove();
}
