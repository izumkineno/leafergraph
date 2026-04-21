/**
 * 基础 Widget 字段视图模块。
 *
 * @remarks
 * 负责复用型字段底座、标签、焦点环和内容图元的封装。
 */

import type { Rect, Text } from "leafer-ui";
import type { LeaferGraphWidgetRendererContext } from "@leafergraph/core/contracts";
import {
  createWidgetFieldSurface,
  createWidgetFocusRing,
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetValueText,
  setWidgetFocusState
} from "@leafergraph/core/widget-runtime";
import {
  WIDGET_FIELD_FONT_SIZE,
  WIDGET_FIELD_MIN_HEIGHT,
  WIDGET_FIELD_PADDING_X,
  WIDGET_FIELD_PADDING_Y,
  WIDGET_FIELD_Y,
  WIDGET_LABEL_FONT_SIZE,
  WIDGET_LABEL_Y,
  WIDGET_VALUE_TOP_OFFSET
} from "./constants";
import type { BasicWidgetTheme, ResolvedTextDisplay } from "./types";

/**
 * 字段公共壳层视图。
 * 它负责统一管理以下 UI 基元：
 * - 顶部标签
 * - 字段表面
 * - 焦点环
 * - 字段命中层
 * - 字段主值文本
 *
 * 这样多数控件都只需要关注“值怎么同步、交互怎么回写”。
 */
export class WidgetFieldView {
  readonly label: Text;
  readonly field: Rect;
  readonly focusRing: Rect;
  readonly valueText: Text;
  readonly hitArea: Rect;

  /**
   * 初始化 WidgetFieldView 实例。
   *
   * @param context - 当前上下文。
   * @param options - 可选配置项。
   */
  constructor(
    context: LeaferGraphWidgetRendererContext,
    options: {
      label: string;
      theme: BasicWidgetTheme;
      fieldHeight?: number;
      cursor?: string;
      textAlign?: "left" | "center" | "right";
      multiline?: boolean;
      valueX?: number;
      valueWidth?: number;
      valueY?: number;
      valueHeight?: number;
    }
  ) {
    // 先整理当前阶段需要的输入、状态与依赖。
    const { ui, group, bounds } = context;
    const fieldHeight = Math.max(
      options.fieldHeight ?? bounds.height - WIDGET_FIELD_Y,
      WIDGET_FIELD_MIN_HEIGHT
    );
    const valueX = options.valueX ?? WIDGET_FIELD_PADDING_X;
    const valueY = options.valueY ?? WIDGET_FIELD_Y + WIDGET_VALUE_TOP_OFFSET;
    const valueWidth =
      options.valueWidth ?? bounds.width - valueX - WIDGET_FIELD_PADDING_X;
    const valueHeight =
      options.valueHeight ??
      Math.max(fieldHeight - WIDGET_FIELD_PADDING_Y * 2, WIDGET_FIELD_FONT_SIZE + 4);

    this.label = createWidgetLabel(ui, {
      x: 0,
      y: WIDGET_LABEL_Y,
      text: options.label,
      width: bounds.width,
      fill: options.theme.labelFill,
      fontFamily: options.theme.fontFamily,
      fontSize: WIDGET_LABEL_FONT_SIZE,
      fontWeight: "600"
    });
    // 再执行核心逻辑，并把结果或副作用统一收口。
    this.field = createWidgetFieldSurface(ui, {
      x: 0,
      y: WIDGET_FIELD_Y,
      width: bounds.width,
      height: fieldHeight,
      cursor: options.cursor,
      theme: options.theme
    });
    this.focusRing = createWidgetFocusRing(ui, {
      x: -1.5,
      y: WIDGET_FIELD_Y - 1.5,
      width: bounds.width + 3,
      height: fieldHeight + 3,
      cornerRadius: options.theme.fieldRadius + 2,
      stroke: options.theme.focusRing
    });
    this.valueText = createWidgetValueText(ui, {
      x: valueX,
      y: valueY,
      width: valueWidth,
      height: valueHeight,
      text: "",
      fill: options.theme.valueFill,
      fontFamily: options.theme.fontFamily,
      fontSize: WIDGET_FIELD_FONT_SIZE,
      fontWeight: "500",
      textAlign: options.textAlign
    });
    this.valueText.textWrap = options.multiline ? "break" : "none";
    this.valueText.textOverflow = options.multiline ? "..." : "...";
    this.hitArea = createWidgetHitArea(ui, {
      x: 0,
      y: WIDGET_FIELD_Y,
      width: bounds.width,
      height: fieldHeight,
      cursor: options.cursor,
      cornerRadius: options.theme.fieldRadius
    });

    group.add([
      this.focusRing,
      this.label,
      this.field,
      this.valueText,
      this.hitArea
    ]);
  }

  /**
   * 设置主题。
   *
   * @param theme - 主题。
   * @param disabled - `disabled`。
   * @returns 无返回值。
   */
  setTheme(theme: BasicWidgetTheme, disabled: boolean): void {
    // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
    this.label.fill = disabled ? theme.disabledFill : theme.labelFill;
    this.valueText.fill = disabled ? theme.disabledFill : theme.valueFill;
    this.valueText.fontFamily = theme.fontFamily;
    this.field.cornerRadius = theme.fieldRadius;
    this.field.shadow = theme.fieldShadow;
    this.focusRing.stroke = theme.focusRing;

    if (disabled) {
      this.field.fill = theme.fieldDisabledFill;
      this.field.stroke = theme.fieldDisabledStroke;
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
      this.field.hoverStyle = {
        fill: theme.fieldDisabledFill,
        stroke: theme.fieldDisabledStroke
      };
      this.field.pressStyle = {
        fill: theme.fieldDisabledFill,
        stroke: theme.fieldDisabledStroke
      };
      this.field.selectedStyle = {
        stroke: theme.fieldDisabledStroke,
        strokeWidth: 1
      };
      this.hitArea.cursor = "default";
      return;
    }

    this.field.fill = theme.fieldFill;
    this.field.stroke = theme.fieldStroke;
    this.field.hoverStyle = {
      fill: theme.fieldHoverFill,
      stroke: theme.fieldHoverStroke
    };
    this.field.pressStyle = {
      fill: theme.fieldFocusFill,
      stroke: theme.fieldFocusStroke
    };
    this.field.selectedStyle = {
      stroke: theme.fieldFocusStroke,
      strokeWidth: 1.2
    };
  }

  /**
   * 设置显示。
   *
   * @param theme - 主题。
   * @param display - 显示。
   * @param disabled - `disabled`。
   * @returns 无返回值。
   */
  setDisplay(
    theme: BasicWidgetTheme,
    display: ResolvedTextDisplay,
    disabled: boolean
  ): void {
    this.valueText.text = display.text;
    this.valueText.fill = disabled
      ? theme.disabledFill
      : display.placeholder
        ? theme.mutedFill
        : theme.valueFill;
  }

  /**
   * 设置`Focused`。
   *
   * @param focused - `focused`。
   * @returns 无返回值。
   */
  setFocused(focused: boolean): void {
    setWidgetFocusState(this.field, this.focusRing, focused);
  }
}
