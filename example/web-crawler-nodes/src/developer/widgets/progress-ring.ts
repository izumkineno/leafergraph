import {
  BaseWidget,
  defineAuthoringWidget,
  type DevWidgetContext
} from "@leafergraph/authoring";
import { WEB_CRAWLER_PROGRESS_RING_WIDGET_TYPE } from "../shared";

import type { Ellipse, Text, Path } from "leafer-ui";

interface ProgressRingState {
  background: Ellipse;
  progress: Path;
  text: Text;
  [key: string]: unknown;
}

interface ProgressRingOptions {
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function normalizeProgressValue(value: unknown): number {
  if (typeof value === "number") {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (!isNaN(n)) {
      return Math.max(0, Math.min(1, n / 100));
    }
  }
  return 0;
}

function resolveOptions(options: unknown): ProgressRingOptions {
  const source = options && typeof options === "object"
    ? (options as Record<string, unknown>)
    : {};

  return {
    size: typeof source.size === "number" ? source.size : 40,
    strokeWidth: typeof source.strokeWidth === "number" ? source.strokeWidth : 4,
    label: typeof source.label === "string" ? source.label : ""
  };
}

function resolveColors(ctx: DevWidgetContext<number>) {
  const { tokens, mode } = ctx.theme;
  return {
    background: mode === "dark" ? "#2A2A2A" : "#E5E5E5",
    progress: mode === "dark" ? "#4A9EFF" : "#2196F3",
    text: tokens.valueFill
  };
}

export class ProgressRingWidget extends BaseWidget<number, ProgressRingState> {
  static meta = {
    type: WEB_CRAWLER_PROGRESS_RING_WIDGET_TYPE,
    title: "Progress Ring",
    description: "Circular progress indicator for showing loading progress",
    normalize: normalizeProgressValue,
    serialize: (value: number) => value
  };

  mount(ctx: DevWidgetContext<number>) {
    const options = resolveOptions(ctx.widget.options);
    const colors = resolveColors(ctx);
    const size = options.size!;
    const strokeWidth = options.strokeWidth!;

    const centerX = ctx.bounds.width / 2;
    const centerY = ctx.bounds.height / 2;
    const radius = size / 2 - strokeWidth / 2;

    const background = new ctx.ui.Ellipse({
      x: centerX - size / 2,
      y: centerY - size / 2,
      width: size,
      height: size,
      stroke: colors.background,
      strokeWidth,
      fill: "transparent",
      hittable: false
    });

    // Use Path to draw progress arc since Arc is not available in current Leafer UI
    const path = new ctx.ui.Path({
      stroke: colors.progress,
      strokeWidth,
      fill: "transparent",
      hittable: false
    });
    
    // Create progress arc path
    const endAngle = -90 + ctx.value * 360;
    const startRadians = (-90 * Math.PI) / 180;
    const endRadians = (endAngle * Math.PI) / 180;
    
    const startX = centerX + radius * Math.cos(startRadians);
    const startY = centerY + radius * Math.sin(startRadians);
    const endX = centerX + radius * Math.cos(endRadians);
    const endY = centerY + radius * Math.sin(endRadians);
    
    path.path = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${ctx.value > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`;
    
    const progress = path;

    const percentage = Math.round(ctx.value * 100);
    const text = new ctx.ui.Text({
      x: centerX,
      y: centerY,
      text: `${percentage}%`,
      fill: colors.text,
      fontSize: 10,
      fontWeight: "600",
      textAlign: "center",
      verticalAlign: "middle",
      hittable: false
    });

    const state: ProgressRingState = { background, progress, text };
    ctx.group.add([background, progress, text]);
    return state;
  }

  update(
    state: ProgressRingState | void,
    ctx: DevWidgetContext<number>,
    nextValue: number
  ) {
    if (!state) return;

    const colors = resolveColors(ctx);
    const options = resolveOptions(ctx.widget.options);
    const size = options.size!;
    const strokeWidth = options.strokeWidth!;
    
    const centerX = ctx.bounds.width / 2;
    const centerY = ctx.bounds.height / 2;
    const radius = size / 2 - strokeWidth / 2;

    // 更新进度弧路径
    const endAngle = -90 + nextValue * 360;
    const startRadians = (-90 * Math.PI) / 180;
    const endRadians = (endAngle * Math.PI) / 180;
    
    const startX = centerX + radius * Math.cos(startRadians);
    const startY = centerY + radius * Math.sin(startRadians);
    const endX = centerX + radius * Math.cos(endRadians);
    const endY = centerY + radius * Math.sin(endRadians);
    
    state.progress.path = `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${nextValue > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`;
    state.progress.stroke = colors.progress;
    state.background.stroke = colors.background;
    state.text.fill = colors.text;
    state.text.text = `${Math.round(nextValue * 100)}%`;

    // 重新居中
    state.background.x = centerX - size / 2;
    state.background.y = centerY - size / 2;
    state.text.x = centerX;
    state.text.y = centerY;

    ctx.requestRender();
  }

  destroy(state: ProgressRingState | void) {
    if (!state) return;
  }
}

export const progressRingWidgetEntry = defineAuthoringWidget(ProgressRingWidget);

/**
 * Helper to create progress ring widget spec
 */
export function createProgressRingWidgetSpec(options?: {
  size?: number;
  strokeWidth?: number;
  label?: string;
}): any {
  return {
    type: WEB_CRAWLER_PROGRESS_RING_WIDGET_TYPE,
    name: "progress",
    value: 0,
    options: options || {}
  };
}