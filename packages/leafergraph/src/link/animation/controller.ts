/**
 * 连线数据流动画 controller。
 *
 * @remarks
 * 负责持有动画状态，并把正式连线解析、效果创建和帧循环委托给 `animation/*` 子模块。
 */

import { Group } from "leafer-ui";
import type { LeaferGraphLinkPropagationEvent } from "@leafergraph/contracts";
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
import { resolveLeaferGraphAnimatedLink } from "./resolved_link";
import type {
  LeaferGraphActiveDataFlowParticle,
  LeaferGraphActiveDataFlowPulse,
  LeaferGraphLinkDataFlowAnimationHostOptions,
  LeaferGraphLinkDataFlowAnimationRuntime
} from "./types";
import type { LeaferGraphLinkNodeState } from "../curve";

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
  private readonly runtime: LeaferGraphLinkDataFlowAnimationRuntime<TNodeState>;
  private frameId: number | null = null;

  /**
   * 初始化连线数据流动画宿主。
   *
   * @param options - 动画宿主装配选项。
   */
  constructor(options: LeaferGraphLinkDataFlowAnimationHostOptions<TNodeState>) {
    // 先固定环境相关依赖，保证后续动画样式和 reduced motion 判断都基于同一宿主窗口。
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

    // 再把真实运行时壳面组装出来，让 effect / frame loop 子模块只依赖统一 runtime 接口。
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

    // 最后完成外部接线：把 overlay 挂回连线层，并安装传播与 reduced motion 监听。
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

  /**
   * 在外部清空连线层后，把动画 overlay 稳定补回去。
   *
   * @returns 无返回值。
   */
  restoreLayer(): void {
    this.overlayGroup.remove();
    this.options.linkLayer.add(this.overlayGroup);
  }

  /**
   * 清空当前全部活动动画，并停止 RAF 驱动。
   *
   * @returns 无返回值。
   */
  clear(): void {
    const hadEffects = hasLeaferGraphLinkDataFlowActiveEffects(this.runtime);

    stopLeaferGraphLinkDataFlowLoop(this.runtime);
    this.activePulses.length = 0;
    this.activeParticles.length = 0;
    this.overlayGroup.removeAll();

    if (hadEffects) {
      this.options.renderFrame();
    }
  }

  /**
   * 销毁宿主并清理订阅、动画状态与 overlay 图元。
   *
   * @returns 无返回值。
   */
  destroy(): void {
    this.disposeLinkPropagationSubscription();
    detachLeaferGraphReducedMotionListener(
      this.reducedMotionMediaQuery,
      this.handleReducedMotionChange
    );
    this.clear();
    this.overlayGroup.remove();
  }

  /**
   * 命中一条真实传播事件后，按预设触发对应视觉反馈。
   *
   * @param event - 当前传播事件。
   * @returns 无返回值。
   */
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
    this.options.renderFrame();
  }

  /**
   * 根据当前图状态解析一条可动画化的连线。
   *
   * @param linkId - 目标连线 ID。
   * @param sourceSlotOverride - 来源槽位覆盖值。
   * @returns 可用于动画绘制的正式连线快照。
   */
  private resolveAnimatedLink(linkId: string, sourceSlotOverride?: number) {
    return resolveLeaferGraphAnimatedLink(
      this.options,
      linkId,
      sourceSlotOverride
    );
  }

  /**
   * 解析当前主题模式下 pulse 的基础透明度。
   *
   * @param progress - 当前动画进度。
   * @returns 当前 pulse 透明度。
   */
  private resolvePulseOpacity(progress: number): number {
    const style = this.getStyle();
    const baseOpacity =
      this.options.getThemeMode() === "dark"
        ? style.pulseDarkOpacity
        : style.pulseLightOpacity;
    return baseOpacity * (1 - clamp01(progress));
  }

  /**
   * 解析当前主题模式下 glow 透明度。
   *
   * @returns 当前 glow 的基础透明度。
   */
  private resolveGlowOpacity(): number {
    const style = this.getStyle();
    return this.options.getThemeMode() === "dark"
      ? style.darkGlowOpacity
      : style.lightGlowOpacity;
  }

  /**
   * 为 pulse 计算更醒目的描边色。
   *
   * @param baseColor - 当前基础颜色。
   * @returns 提亮后的 pulse 描边色。
   */
  private resolvePulseStrokeColor(baseColor: string): string {
    const mixedColor = mixColorToward(
      baseColor,
      "#ffffff",
      this.options.getThemeMode() === "dark" ? 0.78 : 0.88
    );

    return mixedColor ?? baseColor;
  }

  /**
   * 每次按当前主题模式读取动画样式，避免继续使用初始化快照。
   *
   * @returns 当前主题下生效的动画样式。
   */
  private getStyle() {
    return this.options.resolveStyle();
  }

  /**
   * 当前环境是否要求减少动态效果。
   *
   * @returns 当前是否应关闭动态效果。
   */
  private shouldReduceMotion(): boolean {
    if (!this.options.respectReducedMotion) {
      return false;
    }

    return Boolean(this.reducedMotionMediaQuery?.matches);
  }

  /**
   * 读取统一时钟。
   *
   * @returns 当前动画时钟。
   */
  private now(): number {
    return this.ownerWindow?.performance?.now?.() ?? Date.now();
  }

  /**
   * 当用户偏好切到减少动态时，立刻清空当前动画。
   *
   * @param event - 媒体查询变化事件。
   * @returns 无返回值。
   */
  private readonly handleReducedMotionChange = (
    event: MediaQueryListEvent
  ): void => {
    if (this.options.respectReducedMotion && event.matches) {
      this.clear();
    }
  };
}

export type { LeaferGraphLinkDataFlowAnimationHostOptions } from "./types";
