import { bindPressWidgetInteraction } from "../widget_interaction";
import type { NodeButtonWidgetOptions, NodeWidgetSpec } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../api/plugin";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface ButtonFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  disabled: boolean;
  options: NodeButtonWidgetOptions;
  focusKey: string;
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
      cleanups: [],
      syncTheme: (runtimeContext) => {
        this.applyButtonTheme(runtimeContext, view, options, disabled);
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
    disabled: boolean
  ): void {
    const theme = this.resolveTheme(context);
    const variant = options.variant ?? "secondary";
    view.label.fill = disabled ? theme.disabledFill : theme.labelFill;
    view.focusRing.stroke = theme.focusRing;
    view.field.cornerRadius = theme.fieldRadius;
    view.field.shadow = theme.fieldShadow;
    view.valueText.fontFamily = theme.fontFamily;

    if (disabled) {
      view.field.fill = theme.fieldDisabledFill;
      view.field.stroke = theme.fieldDisabledStroke;
      view.valueText.fill = theme.disabledFill;
      return;
    }

    if (variant === "primary") {
      view.field.fill = theme.buttonPrimaryFill;
      view.field.stroke = theme.buttonPrimaryFill;
      view.field.hoverStyle = {
        fill: theme.buttonPrimaryHoverFill,
        stroke: theme.buttonPrimaryHoverFill
      };
      view.field.pressStyle = {
        fill: theme.buttonPrimaryHoverFill,
        stroke: theme.buttonPrimaryHoverFill
      };
      view.field.selectedStyle = {
        stroke: theme.fieldFocusStroke,
        strokeWidth: 1.2
      };
      view.valueText.fill = theme.buttonTextFill;
      return;
    }

    if (variant === "ghost") {
      view.field.fill = theme.buttonGhostFill;
      view.field.stroke = "transparent";
      view.field.hoverStyle = {
        fill: theme.buttonGhostHoverFill,
        stroke: "transparent"
      };
      view.field.pressStyle = {
        fill: theme.buttonGhostHoverFill,
        stroke: theme.fieldFocusStroke
      };
      view.field.selectedStyle = {
        stroke: theme.fieldFocusStroke,
        strokeWidth: 1.2
      };
      view.valueText.fill = theme.buttonGhostTextFill;
      return;
    }

    view.field.fill = theme.buttonSecondaryFill;
    view.field.stroke = theme.fieldStroke;
    view.field.hoverStyle = {
      fill: theme.buttonSecondaryHoverFill,
      stroke: theme.fieldHoverStroke
    };
    view.field.pressStyle = {
      fill: theme.buttonSecondaryHoverFill,
      stroke: theme.fieldFocusStroke
    };
    view.field.selectedStyle = {
      stroke: theme.fieldFocusStroke,
      strokeWidth: 1.2
    };
    view.valueText.fill = context.theme.mode === "dark" ? theme.valueFill : "#0F172A";
  }
}
