/**
 * 连线数据流动画帧循环模块。
 *
 * @remarks
 * 负责统一推进 pulse / particle 的生命周期和 RAF 循环。
 */

import { buildLinkPathFromCurve, sampleLinkCurvePoint } from "../link";
import { resolveGraphLinkCurve } from "../curve";
import {
  clamp01,
  easeOutCubic,
  resolveParticleOpacity
} from "./color";
import type {
  LeaferGraphActiveDataFlowParticle,
  LeaferGraphActiveDataFlowPulse,
  LeaferGraphLinkDataFlowAnimationRuntime
} from "./types";
import type { LeaferGraphLinkNodeState } from "../curve";

/**
 * 判断当前是否还有活动中的动画效果。
 *
 * @param host - 动画运行时壳面。
 * @returns 当前是否仍有活动动画。
 */
export function hasLeaferGraphLinkDataFlowActiveEffects<
  TNodeState extends LeaferGraphLinkNodeState
>(host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>): boolean {
  return host.activePulses.length > 0 || host.activeParticles.length > 0;
}

/**
 * 推进一帧连线数据流动画。
 *
 * @param host - 动画运行时壳面。
 * @param timestamp - 当前时间戳。
 * @returns 无返回值。
 */
export function updateLeaferGraphLinkDataFlowFrame<
  TNodeState extends LeaferGraphLinkNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  timestamp: number
): void {
  // 每一帧开始都先清空 frameId，让后续可以按“仍有活动效果”决定是否续订下一帧。
  host.setFrameId(null);

  if (!hasLeaferGraphLinkDataFlowActiveEffects(host)) {
    return;
  }

  // 如果样式被禁用或宿主切到 reduced motion，当前帧直接收口并清空活动图元。
  if (!host.getStyle().enabled || host.shouldReduceMotion()) {
    host.clear();
    return;
  }

  let hasVisualMutation = false;

  // 先推进整条连线 pulse，并在过期后同步清理对应图元。
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

  // 再推进 travelling 粒子；它们和 pulse 共用一套帧循环，但拥有各自的生命周期与清理逻辑。
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

  // 只在本帧确实改动了可视状态时触发 overlay 刷新，避免空转帧反复请求渲染。
  if (hasVisualMutation) {
    host.overlayGroup.forceUpdate();
    host.options.renderFrame();
  }

  // 仍有活动效果时再续订下一帧；没有活动效果就自然停机。
  if (hasLeaferGraphLinkDataFlowActiveEffects(host)) {
    ensureLeaferGraphLinkDataFlowLoop(host);
  }
}

/**
 * 更新单条 pulse 的路径、透明度和描边宽度。
 *
 * @param host - 动画运行时壳面。
 * @param pulse - 当前 pulse。
 * @param timestamp - 当前时间戳。
 * @returns 当前 pulse 是否仍处于活动状态。
 */
export function updateLeaferGraphLinkDataFlowPulse<
  TNodeState extends LeaferGraphLinkNodeState
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

  const curve = resolveGraphLinkCurve({
    source: resolvedLink.sourceNode,
    target: resolvedLink.targetNode,
    sourceSlot: resolvedLink.sourceSlot,
    targetSlot: resolvedLink.targetSlot,
    layoutMetrics: host.options.layoutMetrics,
    defaultNodeWidth: host.options.defaultNodeWidth,
    portSize: host.options.portSize
  });
  const inverseProgress = 1 - easeOutCubic(progress);
  const style = host.getStyle();

  pulse.view.path = buildLinkPathFromCurve(curve);
  pulse.view.stroke = host.resolvePulseStrokeColor(resolvedLink.color);
  pulse.view.opacity = host.resolvePulseOpacity(progress);
  pulse.view.strokeWidth =
    style.pulseBaseStrokeWidth + style.pulseExtraStrokeWidth * inverseProgress;
  pulse.view.forceUpdate();
  return true;
}

/**
 * 更新 travelling 粒子的当前位置和透明度。
 *
 * @param host - 动画运行时壳面。
 * @param particle - 当前粒子。
 * @param timestamp - 当前时间戳。
 * @returns 当前粒子是否仍处于活动状态。
 */
export function updateLeaferGraphLinkDataFlowParticle<
  TNodeState extends LeaferGraphLinkNodeState
>(
  host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>,
  particle: LeaferGraphActiveDataFlowParticle,
  timestamp: number
): boolean {
  // 先重新解析正式连线，确保节点移动、折叠或主题切换后粒子仍沿着最新曲线前进。
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

  // 再按当前连线曲线采样粒子位置，并根据 fade in/out 配置解析本帧透明度。
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
  const point = sampleLinkCurvePoint(curve, easeOutCubic(progress));
  const opacity = resolveParticleOpacity(
    progress,
    style.fadeInRatio,
    style.fadeOutRatio
  );

  // glow 和 core 共享同一点位，但尺寸与透明度不同，用来形成 travelling comet 的层次感。
  particle.glow.fill = resolvedLink.color;
  particle.glow.x = point[0] - style.glowSize / 2;
  particle.glow.y = point[1] - style.glowSize / 2;
  particle.glow.opacity = host.resolveGlowOpacity() * opacity;
  particle.core.fill = resolvedLink.color;
  particle.core.x = point[0] - style.particleSize / 2;
  particle.core.y = point[1] - style.particleSize / 2;
  particle.core.opacity = style.coreOpacity * opacity;
  particle.glow.forceUpdate();
  particle.core.forceUpdate();
  return true;
}

/**
 * 若当前没有活动 RAF，则启动统一动画循环。
 *
 * @param host - 动画运行时壳面。
 * @returns 无返回值。
 */
export function ensureLeaferGraphLinkDataFlowLoop<
  TNodeState extends LeaferGraphLinkNodeState
>(host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>): void {
  if (host.getFrameId() !== null || !host.ownerWindow) {
    return;
  }

  host.setFrameId(host.ownerWindow.requestAnimationFrame(host.handleFrame));
}

/**
 * 停止当前 RAF 循环。
 *
 * @param host - 动画运行时壳面。
 * @returns 无返回值。
 */
export function stopLeaferGraphLinkDataFlowLoop<
  TNodeState extends LeaferGraphLinkNodeState
>(host: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>): void {
  const frameId = host.getFrameId();
  if (frameId === null || !host.ownerWindow) {
    return;
  }

  host.ownerWindow.cancelAnimationFrame(frameId);
  host.setFrameId(null);
}
