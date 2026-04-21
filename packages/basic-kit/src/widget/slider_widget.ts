/**
 * slider 基础 Widget 模块。
 *
 * @remarks
 * 负责内建滑块控件的范围计算、拖拽绑定和数值同步。
 */

import type { Rect, Text } from "leafer-ui";
import type { NodeSliderWidgetOptions } from "@leafergraph/core/node";
import type { LeaferGraphWidgetRendererContext } from "@leafergraph/core/contracts";
import { bindLinearWidgetDrag } from "@leafergraph/widget-runtime";
import {
  createWidgetFieldSurface,
  createWidgetFocusRing,
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetSurface,
  createWidgetValueText,
  setWidgetFocusState
} from "@leafergraph/widget-runtime";
import {
  WIDGET_FIELD_MIN_HEIGHT,
  WIDGET_FIELD_Y,
  WIDGET_LABEL_FONT_SIZE,
  WIDGET_LABEL_Y,
  WIDGET_SLIDER_THUMB_SIZE,
  WIDGET_SLIDER_TRACK_HEIGHT,
  WIDGET_SLIDER_TRACK_INSET,
  WIDGET_SLIDER_VALUE_Y
} from "./constants";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type {
  BasicWidgetLifecycleState,
  ResolvedLinearRange
} from "./types";

interface SliderFieldState extends BasicWidgetLifecycleState {
  label: Text;
  valueText: Text;
  field: Rect;
  focusRing: Rect;
  track: Rect;
  activeTrack: Rect;
  thumb: Rect;
  hitArea: Rect;
  disabled: boolean;
  range: ResolvedLinearRange;
  options: NodeSliderWidgetOptions;
  focusKey: string;
  preferStaticDisplayValue: boolean;
}

/**
 *  slider renderer。
 */
export class SliderFieldController extends BasicWidgetController<
  NodeSliderWidgetOptions,
  SliderFieldState
> {
  /**
   * 挂载状态。
   *
   * @param context - 当前上下文。
   * @returns 挂载状态的结果。
   */
  protected mountState(context: LeaferGraphWidgetRendererContext): SliderFieldState {
    // 先准备宿主依赖、初始状态和需要挂载的资源。
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const theme = this.resolveTheme(context);
    const { ui, group, bounds } = context;
    const label = createWidgetLabel(ui, {
      x: 0,
      y: WIDGET_LABEL_Y,
      width: bounds.width - 76,
      text: this.resolveLabel(context.widget, options),
      fill: theme.labelFill,
      fontFamily: theme.fontFamily,
      fontSize: WIDGET_LABEL_FONT_SIZE,
      fontWeight: "600"
    });
    const valueText = createWidgetValueText(ui, {
      x: bounds.width - 76,
      y: WIDGET_SLIDER_VALUE_Y,
      width: 76,
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: WIDGET_LABEL_FONT_SIZE,
      fontWeight: "600",
      textAlign: "right"
    });
    const fieldHeight = Math.max(bounds.height - WIDGET_FIELD_Y, WIDGET_FIELD_MIN_HEIGHT);
    const field = createWidgetFieldSurface(ui, {
      x: 0,
      y: WIDGET_FIELD_Y,
      width: bounds.width,
      height: fieldHeight,
      cursor: disabled ? "default" : "ew-resize",
      theme
    });
    const focusRing = createWidgetFocusRing(ui, {
      x: -1.5,
      y: WIDGET_FIELD_Y - 1.5,
      width: bounds.width + 3,
      height: fieldHeight + 3,
      cornerRadius: theme.fieldRadius + 2,
      stroke: theme.focusRing
    });
    const track = createWidgetSurface(ui, {
      x: WIDGET_SLIDER_TRACK_INSET,
      y: WIDGET_FIELD_Y + 15,
      width: Math.max(bounds.width - WIDGET_SLIDER_TRACK_INSET * 2, 12),
      height: WIDGET_SLIDER_TRACK_HEIGHT,
      cornerRadius: 999
    });
    // 再建立绑定与同步关系，让运行期交互能够稳定生效。
    const activeTrack = createWidgetSurface(ui, {
      x: WIDGET_SLIDER_TRACK_INSET,
      y: WIDGET_FIELD_Y + 15,
      width: 0,
      height: WIDGET_SLIDER_TRACK_HEIGHT,
      cornerRadius: 999
    });
    const thumb = createWidgetSurface(ui, {
      x: WIDGET_SLIDER_TRACK_INSET - WIDGET_SLIDER_THUMB_SIZE / 2,
      y: WIDGET_FIELD_Y + 10,
      width: WIDGET_SLIDER_THUMB_SIZE,
      height: WIDGET_SLIDER_THUMB_SIZE,
      cornerRadius: 999,
      strokeWidth: 1.2
    });
    const hitArea = createWidgetHitArea(ui, {
      x: 0,
      y: WIDGET_FIELD_Y,
      width: bounds.width,
      height: fieldHeight,
      cursor: disabled ? "default" : "ew-resize",
      cornerRadius: theme.fieldRadius
    });
    group.add([focusRing, label, valueText, field, track, activeTrack, thumb, hitArea]);
    const range = this.resolveLinearRange(options);
    const focusKey = this.resolveFocusKey(context);

    const state: SliderFieldState = {
      label,
      valueText,
      field,
      focusRing,
      track,
      activeTrack,
      thumb,
      hitArea,
      disabled,
      range,
      options,
      focusKey,
      preferStaticDisplayValue: true,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        const runtimeTheme = this.resolveTheme(runtimeContext);
        label.fill = disabled ? runtimeTheme.disabledFill : runtimeTheme.labelFill;
        label.fontFamily = runtimeTheme.fontFamily;
        valueText.fill = disabled ? runtimeTheme.disabledFill : runtimeTheme.valueFill;
        valueText.fontFamily = runtimeTheme.fontFamily;
        field.cornerRadius = runtimeTheme.fieldRadius;
        field.fill = disabled ? runtimeTheme.fieldDisabledFill : runtimeTheme.fieldFill;
        field.stroke = disabled ? runtimeTheme.fieldDisabledStroke : runtimeTheme.fieldStroke;
        field.hoverStyle = {
          fill: disabled ? runtimeTheme.fieldDisabledFill : runtimeTheme.fieldHoverFill,
          stroke: disabled ? runtimeTheme.fieldDisabledStroke : runtimeTheme.fieldHoverStroke
        };
        field.pressStyle = {
          fill: disabled ? runtimeTheme.fieldDisabledFill : runtimeTheme.fieldFocusFill,
          stroke: disabled ? runtimeTheme.fieldDisabledStroke : runtimeTheme.fieldFocusStroke
        };
        field.selectedStyle = {
          stroke: disabled ? runtimeTheme.fieldDisabledStroke : runtimeTheme.fieldFocusStroke,
          strokeWidth: 1.2
        };
        focusRing.stroke = runtimeTheme.focusRing;
        track.fill = runtimeTheme.trackFill;
        activeTrack.fill = this.resolveNodeAccent(runtimeContext.node, runtimeTheme);
        thumb.fill = runtimeTheme.thumbFill;
        thumb.stroke = this.resolveNodeAccent(runtimeContext.node, runtimeTheme);
      },
      syncValue: (runtimeContext, newValue) => {
        const themeTokens = this.resolveTheme(runtimeContext);
        const progress = this.resolveSliderProgress(newValue, range);
        const width = Math.max(track.width ?? 0, 1);
        const centerX = (track.x ?? WIDGET_SLIDER_TRACK_INSET) + progress * width;
        activeTrack.width = Math.max(progress * width, 4);
        thumb.x = centerX - WIDGET_SLIDER_THUMB_SIZE / 2;
        valueText.text = this.resolveSliderDisplayValue(
          newValue,
          range,
          options,
          state.preferStaticDisplayValue
        );
        activeTrack.fill = this.resolveNodeAccent(runtimeContext.node, themeTokens);
        thumb.stroke = this.resolveNodeAccent(runtimeContext.node, themeTokens);
      }
    };

    this.addCleanup(
      state,
      context.editing.registerFocusableWidget({
        key: focusKey,
        onFocusChange: (focused) => {
          setWidgetFocusState(field, focusRing, focused);
          runtimeRequestRender(context);
        },
        onKeyDown: (event) => this.handleSliderKeyDown(state, context, event)
      })
    );
    this.addCleanup(
      state,
      bindLinearWidgetDrag({
        hitArea,
        group,
        bounds: {
          x: 0,
          y: WIDGET_FIELD_Y,
          width: bounds.width,
          height: fieldHeight
        },
        getNodeX: () => context.node.layout.x,
        allowPointer: () => !disabled,
        onStart: () => {
          state.preferStaticDisplayValue = false;
          context.editing.focusWidget(focusKey);
        },
        onValue: (progress) => {
          state.preferStaticDisplayValue = false;
          context.setValue(this.resolveSliderValue(progress, range));
        },
        onEnd: () => {
          context.commitValue(
            context.node.widgets[context.widgetIndex]?.value
          );
        }
      })
    );

    return state;
  }

  /**
   * 处理 `handleSliderKeyDown` 相关逻辑。
   *
   * @param state - 当前状态。
   * @param context - 当前上下文。
   * @param event - 当前事件对象。
   * @returns 对应的判断结果。
   */
  private handleSliderKeyDown(
    state: SliderFieldState,
    context: LeaferGraphWidgetRendererContext,
    event: KeyboardEvent
  ): boolean {
    // 先读取当前目标状态与上下文约束，避免处理中出现不一致的中间态。
    if (state.disabled) {
      return this.isReservedWidgetKey(event);
    }

    const currentValue =
      typeof context.value === "number" ? context.value : Number(context.value);
    const safeValue = Number.isFinite(currentValue)
      ? currentValue
      : state.range.min;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      state.preferStaticDisplayValue = false;
      context.commitValue(
        this.roundToStep(safeValue - state.range.step, state.range)
      );
      return true;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      state.preferStaticDisplayValue = false;
      // 再执行核心更新步骤，并同步派生副作用与收尾状态。
      context.commitValue(
        this.roundToStep(safeValue + state.range.step, state.range)
      );
      return true;
    }

    if (event.key === "Home") {
      state.preferStaticDisplayValue = false;
      context.commitValue(state.range.min);
      return true;
    }

    if (event.key === "End") {
      state.preferStaticDisplayValue = false;
      context.commitValue(state.range.max);
      return true;
    }

    return this.isReservedWidgetKey(event);
  }
}
