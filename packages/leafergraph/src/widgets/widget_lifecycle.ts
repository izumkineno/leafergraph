/**
 * Widget 生命周期工具模块。
 *
 * @remarks
 * 负责把统一生命周期对象适配成主包可调度的 Widget renderer。
 */

import type { Box, Rect, Text } from "leafer-ui";
import { LEAFER_GRAPH_WIDGET_HIT_AREA_NAME } from "./widget_interaction";
import type {
  LeaferGraphWidgetThemeTokens,
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererContext
} from "../api/plugin";

/**
 * Widget 标题文本的创建参数。
 * 用于统一控制 label 的位置与排版风格。
 */
export interface LeaferGraphWidgetLabelOptions {
  x: number;
  y: number;
  text: string;
  width?: number;
  fill?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
}

/**
 * Widget 值文本的创建参数。
 * 通常用于只读值、输入控件的显示值。
 */
export interface LeaferGraphWidgetValueTextOptions {
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  fill?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
}

/**
 * Widget 表面矩形的创建参数。
 * 适合输入框、按钮、下拉框等组件的背景或描边层。
 */
export interface LeaferGraphWidgetSurfaceOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number | number[];
  cursor?: string;
  hittable?: boolean;
}

/**
 * 现代字段表面的创建参数。
 * 它在普通表面之上补充了 hover / press / focus 三类常用状态。
 */
export interface LeaferGraphWidgetFieldSurfaceOptions
  extends LeaferGraphWidgetSurfaceOptions {
  theme: LeaferGraphWidgetThemeTokens;
  hoverFill?: string;
  hoverStroke?: string;
  pressFill?: string;
  pressStroke?: string;
}

/**
 * Widget 命中层的创建参数。
 * 命中层默认带有统一的 name，便于宿主判断“事件来自 Widget”。
 */
export interface LeaferGraphWidgetHitAreaOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  cursor?: string;
  name?: string;
  cornerRadius?: number | number[];
}

/** Widget 焦点环参数。 */
export interface LeaferGraphWidgetFocusRingOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number | number[];
  stroke: string;
}

/** 分段 / 候选项组容器参数。 */
export interface LeaferGraphWidgetSegmentContainerOptions {
  x: number;
  y: number;
  width: number;
  height?: number;
  gap?: number;
  flow?: "x" | "y";
  wrap?: boolean;
}

/** 创建 Widget 标题文本。 */
export function createWidgetLabel(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetLabelOptions
): Text {
  return new ui.Text({
    ...options,
    textAlign: options.textAlign ?? "left",
    hittable: false
  });
}

/** 创建 Widget 值文本。 */
export function createWidgetValueText(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetValueTextOptions
): Text {
  return new ui.Text({
    ...options,
    textAlign: options.textAlign ?? "left",
    hittable: false
  });
}

/** 创建 Widget 输入/按钮等组件的表面矩形。 */
export function createWidgetSurface(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetSurfaceOptions
): Rect {
  return new ui.Rect({
    ...options,
    hittable: options.hittable ?? false
  });
}

/** 创建带 hover / press / focus 状态的字段表面。 */
export function createWidgetFieldSurface(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetFieldSurfaceOptions
): Rect {
  return new ui.Rect({
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    fill: options.fill ?? options.theme.fieldFill,
    stroke: options.stroke ?? options.theme.fieldStroke,
    strokeWidth: options.strokeWidth ?? 1,
    cornerRadius: options.cornerRadius ?? options.theme.fieldRadius,
    name: options.name,
    hoverStyle: {
      fill: options.hoverFill ?? options.theme.fieldHoverFill,
      stroke: options.hoverStroke ?? options.theme.fieldHoverStroke
    },
    pressStyle: {
      fill: options.pressFill ?? options.theme.fieldFocusFill,
      stroke: options.pressStroke ?? options.theme.fieldFocusStroke
    },
    selectedStyle: {
      stroke: options.theme.fieldFocusStroke,
      strokeWidth: 1.2
    },
    shadow: options.theme.fieldShadow,
    cursor: options.cursor,
    hittable: options.hittable ?? false
  });
}

/** 创建统一的 Widget 焦点环。 */
export function createWidgetFocusRing(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetFocusRingOptions
): Rect {
  return new ui.Rect({
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    cornerRadius: options.cornerRadius,
    fill: "transparent",
    stroke: options.stroke,
    strokeWidth: 1.25,
    opacity: 0,
    selectedStyle: {
      opacity: 1
    },
    hittable: false
  });
}

/** 创建分段 / 候选项组容器。 */
export function createWidgetSegmentContainer(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetSegmentContainerOptions
): Box {
  return new ui.Box({
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    flow: options.flow ?? "x",
    flowWrap: options.wrap ?? false,
    gap: options.gap ?? 8,
    resizeChildren: false
  });
}

/** 创建 Widget 统一命中层。 */
export function createWidgetHitArea(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetHitAreaOptions
): Rect {
  return new ui.Rect({
    name: options.name ?? LEAFER_GRAPH_WIDGET_HIT_AREA_NAME,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    cornerRadius: options.cornerRadius,
    cursor: options.cursor,
    fill: "rgba(255, 255, 255, 0.001)"
  });
}

/**
 * 把生命周期对象转为宿主可识别的 renderer 形态。
 * 这样内建与外部 Widget 都能走统一的 mount / update / destroy 调度。
 */
export function createWidgetLifecycleRenderer<TState>(
  lifecycle: LeaferGraphWidgetLifecycle<TState>
): LeaferGraphWidgetRenderer {
  return (context: LeaferGraphWidgetRendererContext) => {
    const runtimeContext: LeaferGraphWidgetRendererContext = { ...context };
    const state = lifecycle.mount?.(runtimeContext);

    return {
      update(newValue) {
        if (!lifecycle.update) {
          return;
        }
        runtimeContext.value = newValue;
        lifecycle.update(state as TState, runtimeContext, newValue);
      },
      destroy() {
        lifecycle.destroy?.(state as TState, runtimeContext);
        runtimeContext.group.removeAll();
      }
    };
  };
}

/** 统一切换一个字段图元与焦点环的 focus 状态。 */
export function setWidgetFocusState(
  field: Rect | undefined,
  focusRing: Rect | undefined,
  focused: boolean
): void {
  if (field) {
    field.selected = focused;
  }

  if (focusRing) {
    focusRing.selected = focused;
  }
}
