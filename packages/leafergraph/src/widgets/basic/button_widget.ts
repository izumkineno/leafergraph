/**
 * button 基础 Widget 模块。
 *
 * @remarks
 * 负责内建按钮控件的渲染、状态同步和动作派发。
 */

import { bindPressWidgetInteraction } from "@leafergraph/widget-runtime";
import type { NodeButtonWidgetOptions, NodeWidgetSpec } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "@leafergraph/contracts";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface ButtonFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  disabled: boolean;
  options: NodeButtonWidgetOptions;
  focusKey: string;
  hovered: boolean;
  pressed: boolean;
}

/** button renderer。 */
export class ButtonFieldController extends BasicWidgetController<
  NodeButtonWidgetOptions,
  ButtonFieldState
> {
  protected mountState(context: LeaferGraphWidgetRendererContext): ButtonFieldState {
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const view = new WidgetFieldView(context, {
      label: this.resolveLabel(context.widget, options),
      theme: this.resolveTheme(context),
      cursor: disabled ? "default" : "pointer",
      textAlign: "center"
    });
    const focusKey = this.resolveFocusKey(context);

    const state: ButtonFieldState = {
      view,
      disabled,
      options,
      focusKey,
      hovered: false,
      pressed: false,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        this.applyButtonTheme(
          runtimeContext,
          view,
          options,
          disabled,
          state.hovered,
          state.pressed
        );
      },
      syncValue: (runtimeContext) => {
        view.valueText.text = this.resolveButtonText(
          runtimeContext.widget,
          options,
          runtimeContext.value
        );
      }
    };

    this.addCleanup(
      state,
      context.editing.registerFocusableWidget({
        key: focusKey,
        onFocusChange: (focused) => {
          view.setFocused(focused);
          this.applyButtonTheme(
            context,
            view,
            options,
            disabled,
            state.hovered,
            state.pressed
          );
          runtimeRequestRender(context);
        },
        onKeyDown: (event) => {
          if (event.key === " " || event.key === "Enter") {
            this.emitButtonAction(context, options);
            return true;
          }

          return this.isReservedWidgetKey(event);
        }
      })
    );
    this.addCleanup(
      state,
      bindPressWidgetInteraction({
        hitArea: view.hitArea,
        allowPointer: () => !disabled,
        onHoverChange: (hovered) => {
          state.hovered = hovered;
          this.applyButtonTheme(
            context,
            view,
            options,
            disabled,
            state.hovered,
            state.pressed
          );
          runtimeRequestRender(context);
        },
        onPressChange: (pressed) => {
          state.pressed = pressed;
          this.applyButtonTheme(
            context,
            view,
            options,
            disabled,
            state.hovered,
            state.pressed
          );
          runtimeRequestRender(context);
        },
        onPress: () => {
          context.editing.focusWidget(focusKey);
          this.emitButtonAction(context, options);
        }
      })
    );

    return state;
  }

  private resolveButtonText(
    widget: NodeWidgetSpec,
    options: NodeButtonWidgetOptions,
    value: unknown
  ): string {
    if (options.text?.trim()) {
      return options.text;
    }

    const valueText = this.formatWidgetValue(value);
    if (valueText) {
      return valueText;
    }

    return this.resolveLabel(widget, options);
  }

  private emitButtonAction(
    context: LeaferGraphWidgetRendererContext,
    options: NodeButtonWidgetOptions
  ): void {
    context.emitAction(options.action ?? context.widget.name, context.value, {
      widgetType: context.widget.type
    });
  }

  private applyButtonTheme(
    context: LeaferGraphWidgetRendererContext,
    view: WidgetFieldView,
    options: NodeButtonWidgetOptions,
    disabled: boolean,
    hovered: boolean,
    pressed: boolean
  ): void {
    const theme = this.resolveTheme(context);
    const variant = options.variant ?? "secondary";
    const darkMode = context.theme.mode === "dark";
    view.label.fill = disabled ? theme.disabledFill : theme.labelFill;
    view.focusRing.stroke = theme.focusRing;
    view.field.cornerRadius = theme.fieldRadius;
    view.field.shadow = pressed ? "0 0 0 rgba(15, 23, 42, 0)" : theme.fieldShadow;
    view.field.strokeWidth = pressed ? 1.4 : hovered ? 1.15 : 1;
    view.valueText.fontFamily = theme.fontFamily;

    if (disabled) {
      view.field.fill = theme.fieldDisabledFill;
      view.field.stroke = theme.fieldDisabledStroke;
      view.field.strokeWidth = 1;
      view.field.shadow = theme.fieldShadow;
      view.field.hoverStyle = {
        fill: theme.fieldDisabledFill,
        stroke: theme.fieldDisabledStroke
      };
      view.field.pressStyle = {
        fill: theme.fieldDisabledFill,
        stroke: theme.fieldDisabledStroke
      };
      view.field.selectedStyle = {
        stroke: theme.fieldDisabledStroke,
        strokeWidth: 1
      };
      view.valueText.fill = theme.disabledFill;
      return;
    }

    if (variant === "primary") {
      const fill = pressed
        ? darkMode
          ? "#0369A1"
          : "#1E40AF"
        : hovered
          ? theme.buttonPrimaryHoverFill
          : theme.buttonPrimaryFill;
      const stroke = pressed
        ? darkMode
          ? "#7DD3FC"
          : "#1E3A8A"
        : hovered
          ? theme.buttonPrimaryHoverFill
          : theme.buttonPrimaryFill;
      view.field.fill = fill;
      view.field.stroke = stroke;
      view.field.hoverStyle = {
        fill: theme.buttonPrimaryHoverFill,
        stroke: theme.buttonPrimaryHoverFill
      };
      view.field.pressStyle = {
        fill: darkMode ? "#0369A1" : "#1E40AF",
        stroke: darkMode ? "#7DD3FC" : "#1E3A8A"
      };
      view.field.selectedStyle = {
        stroke: theme.fieldFocusStroke,
        strokeWidth: 1.2
      };
      view.valueText.fill = theme.buttonTextFill;
      return;
    }

    if (variant === "ghost") {
      const fill = pressed
        ? darkMode
          ? "rgba(148, 163, 184, 0.2)"
          : "rgba(37, 99, 235, 0.12)"
        : hovered
          ? theme.buttonGhostHoverFill
          : theme.buttonGhostFill;
      const stroke = pressed
        ? darkMode
          ? "#60A5FA"
          : "#2563EB"
        : "transparent";
      view.field.fill = fill;
      view.field.stroke = stroke;
      view.field.hoverStyle = {
        fill: theme.buttonGhostHoverFill,
        stroke: "transparent"
      };
      view.field.pressStyle = {
        fill: darkMode
          ? "rgba(148, 163, 184, 0.2)"
          : "rgba(37, 99, 235, 0.12)",
        stroke: darkMode ? "#60A5FA" : "#2563EB"
      };
      view.field.selectedStyle = {
        stroke: theme.fieldFocusStroke,
        strokeWidth: 1.2
      };
      view.valueText.fill = pressed
        ? darkMode
          ? "#F8FAFC"
          : "#1D4ED8"
        : theme.buttonGhostTextFill;
      return;
    }

    view.field.fill = pressed
      ? darkMode
        ? "rgba(30, 41, 59, 0.98)"
        : "#EFF6FF"
      : hovered
        ? theme.buttonSecondaryHoverFill
        : theme.buttonSecondaryFill;
    view.field.stroke = pressed
      ? darkMode
        ? "#60A5FA"
        : "#2563EB"
      : hovered
        ? theme.fieldHoverStroke
        : theme.fieldStroke;
    view.field.hoverStyle = {
      fill: theme.buttonSecondaryHoverFill,
      stroke: theme.fieldHoverStroke
    };
    view.field.pressStyle = {
      fill: darkMode ? "rgba(30, 41, 59, 0.98)" : "#EFF6FF",
      stroke: darkMode ? "#60A5FA" : "#2563EB"
    };
    view.field.selectedStyle = {
      stroke: theme.fieldFocusStroke,
      strokeWidth: 1.2
    };
    view.valueText.fill = pressed
      ? darkMode
        ? "#F8FAFC"
        : "#1D4ED8"
      : darkMode
        ? theme.valueFill
        : "#0F172A";
  }
}
