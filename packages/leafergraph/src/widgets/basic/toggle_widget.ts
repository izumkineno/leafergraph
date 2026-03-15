import type { Rect, Text } from "leafer-ui";
import type { NodeToggleWidgetOptions } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../api/plugin";
import { bindPressWidgetInteraction } from "../widget_interaction";
import { createWidgetSurface, createWidgetValueText } from "../widget_lifecycle";
import {
  WIDGET_FIELD_FONT_SIZE,
  WIDGET_FIELD_PADDING_X,
  WIDGET_FIELD_Y,
  WIDGET_TOGGLE_SWITCH_HEIGHT,
  WIDGET_TOGGLE_SWITCH_WIDTH,
  WIDGET_TOGGLE_THUMB_SIZE
} from "./constants";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface ToggleFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  switchTrack: Rect;
  switchThumb: Rect;
  stateText: Text;
  disabled: boolean;
  options: NodeToggleWidgetOptions;
  focusKey: string;
}

/** toggle renderer。 */
export class ToggleFieldController extends BasicWidgetController<
  NodeToggleWidgetOptions,
  ToggleFieldState
> {
  protected mountState(context: LeaferGraphWidgetRendererContext): ToggleFieldState {
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const theme = this.resolveTheme(context);
    const view = new WidgetFieldView(context, {
      label: this.resolveLabel(context.widget, options),
      theme,
      cursor: disabled ? "default" : "pointer",
      valueWidth: context.bounds.width - 70
    });
    const { ui, group, bounds } = context;
    const switchTrack = createWidgetSurface(ui, {
      x: bounds.width - WIDGET_TOGGLE_SWITCH_WIDTH - 10,
      y: WIDGET_FIELD_Y + 6,
      width: WIDGET_TOGGLE_SWITCH_WIDTH,
      height: WIDGET_TOGGLE_SWITCH_HEIGHT,
      cornerRadius: 999,
      strokeWidth: 1.2
    });
    const switchThumb = createWidgetSurface(ui, {
      x: bounds.width - WIDGET_TOGGLE_SWITCH_WIDTH - 8,
      y: WIDGET_FIELD_Y + 9,
      width: WIDGET_TOGGLE_THUMB_SIZE,
      height: WIDGET_TOGGLE_THUMB_SIZE,
      cornerRadius: 999,
      strokeWidth: 1
    });
    const stateText = createWidgetValueText(ui, {
      x: WIDGET_FIELD_PADDING_X,
      y: WIDGET_FIELD_Y + 9,
      width: bounds.width - 74,
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: WIDGET_FIELD_FONT_SIZE,
      fontWeight: "500"
    });

    group.add([switchTrack, switchThumb, stateText]);
    const focusKey = this.resolveFocusKey(context);

    const state: ToggleFieldState = {
      view,
      switchTrack,
      switchThumb,
      stateText,
      disabled,
      options,
      focusKey,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        const runtimeTheme = this.resolveTheme(runtimeContext);
        view.setTheme(runtimeTheme, disabled);
        stateText.fill = disabled ? runtimeTheme.disabledFill : runtimeTheme.valueFill;
        this.syncToggleVisual(runtimeContext, state, Boolean(runtimeContext.value));
      },
      syncValue: (runtimeContext, newValue) => {
        const checked = Boolean(newValue);
        stateText.text = checked
          ? options.onText?.trim() || "ON"
          : options.offText?.trim() || "OFF";
        this.syncToggleVisual(runtimeContext, state, checked);
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
            this.toggleValue(context);
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
          this.toggleValue(context);
        }
      })
    );

    return state;
  }

  private toggleValue(context: LeaferGraphWidgetRendererContext): void {
    context.setValue(!Boolean(context.value));
  }

  private syncToggleVisual(
    context: LeaferGraphWidgetRendererContext,
    state: ToggleFieldState,
    checked: boolean
  ): void {
    const theme = this.resolveTheme(context);
    const accent = this.resolveNodeAccent(context.node, theme);
    state.switchTrack.fill = checked ? accent : theme.trackFill;
    state.switchTrack.stroke = checked ? accent : theme.fieldStroke;
    state.switchThumb.fill = theme.thumbFill;
    state.switchThumb.stroke = checked ? accent : theme.thumbStroke;
    state.switchThumb.x = checked
      ? context.bounds.width - WIDGET_TOGGLE_THUMB_SIZE - 14
      : context.bounds.width - WIDGET_TOGGLE_SWITCH_WIDTH - 8;
  }
}
