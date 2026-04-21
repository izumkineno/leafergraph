/**
 * Widget 生命周期工具模块。
 *
 * @remarks
 * 负责把统一生命周期对象适配成主包可调度的 Widget renderer。
 */

import type { Box, Rect, Text } from "leafer-ui";
import { LEAFER_GRAPH_WIDGET_HIT_AREA_NAME } from "./widget_interaction";
import type {
  LeaferGraphWidgetLifecycle,
  LeaferGraphWidgetRenderer,
  LeaferGraphWidgetRendererContext
} from "@leafergraph/core/contracts";
import type { LeaferGraphWidgetThemeTokens } from "@leafergraph/core/theme";

/**
 * Widget 标题文本的创建参数。
 * 用于统一控制 label 的位置与排版风格。
 */
export interface LeaferGraphWidgetLabelOptions {
  /** 标签文本起始 X。 */
  x: number;
  /** 标签文本起始 Y。 */
  y: number;
  /** 标签文本内容。 */
  text: string;
  /** 标签文本宽度。 */
  width?: number;
  /** 标签文本颜色。 */
  fill?: string;
  /** 标签字体族。 */
  fontFamily?: string;
  /** 标签字号。 */
  fontSize?: number;
  /** 标签字重。 */
  fontWeight?: string;
  /** 标签文本对齐方式。 */
  textAlign?: "left" | "center" | "right";
}

/**
 * Widget 值文本的创建参数。
 * 通常用于只读值、输入控件的显示值。
 */
export interface LeaferGraphWidgetValueTextOptions {
  /** 值文本起始 X。 */
  x: number;
  /** 值文本起始 Y。 */
  y: number;
  /** 值文本内容。 */
  text: string;
  /** 值文本宽度。 */
  width?: number;
  /** 值文本高度。 */
  height?: number;
  /** 值文本颜色。 */
  fill?: string;
  /** 值文本字体族。 */
  fontFamily?: string;
  /** 值文本字号。 */
  fontSize?: number;
  /** 值文本字重。 */
  fontWeight?: string;
  /** 值文本对齐方式。 */
  textAlign?: "left" | "center" | "right";
}

/**
 * Widget 表面矩形的创建参数。
 * 适合输入框、按钮、下拉框等组件的背景或描边层。
 */
export interface LeaferGraphWidgetSurfaceOptions {
  /** 表面矩形起始 X。 */
  x: number;
  /** 表面矩形起始 Y。 */
  y: number;
  /** 表面矩形宽度。 */
  width: number;
  /** 表面矩形高度。 */
  height: number;
  /** 图元名称。 */
  name?: string;
  /** 填充色。 */
  fill?: string;
  /** 描边色。 */
  stroke?: string;
  /** 描边宽度。 */
  strokeWidth?: number;
  /** 圆角。 */
  cornerRadius?: number | number[];
  /** 鼠标指针样式。 */
  cursor?: string;
  /** 是否允许命中。 */
  hittable?: boolean;
}

/**
 * 现代字段表面的创建参数。
 * 它在普通表面之上补充了 hover / press / focus 三类常用状态。
 */
export interface LeaferGraphWidgetFieldSurfaceOptions
  extends LeaferGraphWidgetSurfaceOptions {
  /** 当前主题 token。 */
  theme: LeaferGraphWidgetThemeTokens;
  /** hover 填充色覆写。 */
  hoverFill?: string;
  /** hover 描边色覆写。 */
  hoverStroke?: string;
  /** press 填充色覆写。 */
  pressFill?: string;
  /** press 描边色覆写。 */
  pressStroke?: string;
}

/**
 * Widget 命中层的创建参数。
 * 命中层默认带有统一的 name，便于宿主判断“事件来自 Widget”。
 */
export interface LeaferGraphWidgetHitAreaOptions {
  /** 命中层起始 X。 */
  x: number;
  /** 命中层起始 Y。 */
  y: number;
  /** 命中层宽度。 */
  width: number;
  /** 命中层高度。 */
  height: number;
  /** 鼠标指针样式。 */
  cursor?: string;
  /** 图元名称。 */
  name?: string;
  /** 圆角。 */
  cornerRadius?: number | number[];
}

/** Widget 焦点环参数。 */
export interface LeaferGraphWidgetFocusRingOptions {
  /** 焦点环起始 X。 */
  x: number;
  /** 焦点环起始 Y。 */
  y: number;
  /** 焦点环宽度。 */
  width: number;
  /** 焦点环高度。 */
  height: number;
  /** 焦点环圆角。 */
  cornerRadius?: number | number[];
  /** 焦点环描边色。 */
  stroke: string;
}

/** 分段 / 候选项组容器参数。 */
export interface LeaferGraphWidgetSegmentContainerOptions {
  /** 容器起始 X。 */
  x: number;
  /** 容器起始 Y。 */
  y: number;
  /** 容器宽度。 */
  width: number;
  /** 容器高度。 */
  height?: number;
  /** 子项间距。 */
  gap?: number;
  /** 子项流向。 */
  flow?: "x" | "y";
  /** 是否允许换行。 */
  wrap?: boolean;
}

/**
 *  创建 Widget 标题文本。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
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

/**
 *  创建 Widget 值文本。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
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

/**
 *  创建 Widget 输入/按钮等组件的表面矩形。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createWidgetSurface(
  ui: typeof import("leafer-ui"),
  options: LeaferGraphWidgetSurfaceOptions
): Rect {
  return new ui.Rect({
    ...options,
    hittable: options.hittable ?? false
  });
}

/**
 *  创建带 hover / press / focus 状态的字段表面。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
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

/**
 *  创建统一的 Widget 焦点环。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
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

/**
 *  创建分段 / 候选项组容器。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
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

/**
 *  创建 Widget 统一命中层。
 *
 * @param ui - `ui`。
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
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
 *
 * @param lifecycle - `lifecycle`。
 * @returns 创建后的结果对象。
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

/**
 *  统一切换一个字段图元与焦点环的 focus 状态。
 *
 * @param field - 字段。
 * @param focusRing - 焦点`Ring`。
 * @param focused - `focused`。
 * @returns 无返回值。
 */
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
