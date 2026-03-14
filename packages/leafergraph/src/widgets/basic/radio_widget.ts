import type { Rect, Text } from "leafer-ui";
import type { NodeOptionWidgetOptions, NodeWidgetOptionItem } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../plugin";
import { bindPressWidgetInteraction } from "../../widget_interaction";
import {
  createWidgetFieldSurface,
  createWidgetFocusRing,
  createWidgetHitArea,
  createWidgetLabel,
  createWidgetSurface,
  createWidgetValueText,
  setWidgetFocusState
} from "../widget_lifecycle";
import {
  WIDGET_FIELD_FONT_SIZE,
  WIDGET_FIELD_MIN_HEIGHT,
  WIDGET_FIELD_Y,
  WIDGET_LABEL_FONT_SIZE,
  WIDGET_LABEL_Y,
  WIDGET_RADIO_ITEM_GAP,
  WIDGET_RADIO_ITEM_HEIGHT,
  WIDGET_RADIO_TOP_PADDING
} from "./constants";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type {
  BasicWidgetLifecycleState,
  ChoiceItemView
} from "./types";

interface RadioFieldState extends BasicWidgetLifecycleState {
  label: Text;
  field: Rect;
  focusRing: Rect;
  items: ChoiceItemView[];
  disabled: boolean;
  options: NodeOptionWidgetOptions;
  focusKey: string;
}

/** radio renderer。 */
export class RadioFieldController extends BasicWidgetController<
  NodeOptionWidgetOptions,
  RadioFieldState
> {
  protected mountState(context: LeaferGraphWidgetRendererContext): RadioFieldState {
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const theme = this.resolveTheme(context);
    const { ui, group, bounds } = context;
    const label = createWidgetLabel(ui, {
      x: 0,
      y: WIDGET_LABEL_Y,
      width: bounds.width,
      text: this.resolveLabel(context.widget, options),
      fill: theme.labelFill,
      fontFamily: theme.fontFamily,
      fontSize: WIDGET_LABEL_FONT_SIZE,
      fontWeight: "600"
    });
    const fieldHeight = Math.max(bounds.height - WIDGET_FIELD_Y, WIDGET_FIELD_MIN_HEIGHT);
    const field = createWidgetFieldSurface(ui, {
      x: 0,
      y: WIDGET_FIELD_Y,
      width: bounds.width,
      height: fieldHeight,
      cursor: disabled ? "default" : "pointer",
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
    group.add([focusRing, label, field]);
    const items = this.resolveOptionItems(options.items, context.value).map((item, index) =>
      this.createChoiceItemView(context, item, index)
    );
    const focusKey = this.resolveFocusKey(context);

    const state: RadioFieldState = {
      label,
      field,
      focusRing,
      items,
      disabled,
      options,
      focusKey,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        const runtimeTheme = this.resolveTheme(runtimeContext);
        label.fill = disabled ? runtimeTheme.disabledFill : runtimeTheme.labelFill;
        label.fontFamily = runtimeTheme.fontFamily;
        field.fill = disabled ? runtimeTheme.fieldDisabledFill : runtimeTheme.fieldFill;
        field.stroke = disabled ? runtimeTheme.fieldDisabledStroke : runtimeTheme.fieldStroke;
        focusRing.stroke = runtimeTheme.focusRing;
        this.syncChoiceItems(runtimeContext, state, runtimeContext.value);
      },
      syncValue: (runtimeContext, newValue) => {
        this.syncChoiceItems(runtimeContext, state, newValue);
      }
    };

    items.forEach((itemView, index) => {
      const sourceItem = this.resolveOptionItems(options.items, context.value)[index];
      const pointerBinding = bindPressWidgetInteraction({
        hitArea: itemView.hitArea,
        allowPointer: () => !disabled && !sourceItem.disabled,
        onPress: () => {
          context.editing.focusWidget(focusKey);
          context.setValue(sourceItem.value);
        }
      });
      this.addCleanup(state, pointerBinding);
    });
    this.addCleanup(
      state,
      context.editing.registerFocusableWidget({
        key: focusKey,
        onFocusChange: (focused) => {
          setWidgetFocusState(field, focusRing, focused);
          runtimeRequestRender(context);
        },
        onKeyDown: (event) => this.handleRadioKeyDown(state, context, event)
      })
    );

    return state;
  }

  private createChoiceItemView(
    context: LeaferGraphWidgetRendererContext,
    item: NodeWidgetOptionItem,
    index: number
  ): ChoiceItemView {
    const { ui, group, bounds } = context;
    const y =
      WIDGET_FIELD_Y +
      WIDGET_RADIO_TOP_PADDING +
      index * (WIDGET_RADIO_ITEM_HEIGHT + WIDGET_RADIO_ITEM_GAP);
    const width = Math.max(bounds.width - 16, 12);
    const surface = createWidgetSurface(ui, {
      x: 8,
      y,
      width,
      height: WIDGET_RADIO_ITEM_HEIGHT,
      cornerRadius: 9,
      strokeWidth: 1
    });
    const indicatorRing = createWidgetSurface(ui, {
      x: 20,
      y: y + 8,
      width: 12,
      height: 12,
      cornerRadius: 999,
      strokeWidth: 1.2
    });
    const indicatorDot = createWidgetSurface(ui, {
      x: 23,
      y: y + 11,
      width: 6,
      height: 6,
      cornerRadius: 999
    });
    const text = createWidgetValueText(ui, {
      x: 42,
      y: y + 7,
      width: width - 52,
      text: item.label,
      fontSize: WIDGET_FIELD_FONT_SIZE,
      fontWeight: "500"
    });
    const hitArea = createWidgetHitArea(ui, {
      x: 8,
      y,
      width,
      height: WIDGET_RADIO_ITEM_HEIGHT,
      cursor: item.disabled ? "default" : "pointer",
      cornerRadius: 9
    });
    group.add([surface, indicatorRing, indicatorDot, text, hitArea]);

    return {
      surface,
      hitArea,
      indicatorRing,
      indicatorDot,
      text,
      disabled: Boolean(item.disabled)
    };
  }

  private handleRadioKeyDown(
    state: RadioFieldState,
    context: LeaferGraphWidgetRendererContext,
    event: KeyboardEvent
  ): boolean {
    if (state.disabled) {
      return this.isReservedWidgetKey(event);
    }

    const options = this.resolveOptionItems(state.options.items, context.value);
    const currentIndex = this.resolveSelectedOptionIndex(context.value, options);

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      const nextIndex = this.resolveNextEnabledOptionIndex(currentIndex, options, 1);
      context.setValue(options[nextIndex].value);
      return true;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      const nextIndex = this.resolveNextEnabledOptionIndex(currentIndex, options, -1);
      context.setValue(options[nextIndex].value);
      return true;
    }

    if (event.key === " " || event.key === "Enter") {
      context.setValue(options[currentIndex].value);
      return true;
    }

    return this.isReservedWidgetKey(event);
  }

  private syncChoiceItems(
    context: LeaferGraphWidgetRendererContext,
    state: RadioFieldState,
    value: unknown
  ): void {
    const options = this.resolveOptionItems(state.options.items, value);
    const selectedValue = this.resolveSelectedOption(value, options).value;
    const theme = this.resolveTheme(context);
    const accent = this.resolveNodeAccent(context.node, theme);

    state.items.forEach((itemView, index) => {
      const option = options[index];
      const disabled = Boolean(option?.disabled) || state.disabled;
      const checked = option?.value === selectedValue;
      itemView.surface.fill = checked
        ? theme.menuActiveFill
        : disabled
          ? theme.fieldDisabledFill
          : "transparent";
      itemView.surface.stroke = checked
        ? accent
        : disabled
          ? theme.fieldDisabledStroke
          : theme.separatorFill;
      itemView.indicatorRing.fill = "transparent";
      itemView.indicatorRing.stroke = checked
        ? accent
        : disabled
          ? theme.fieldDisabledStroke
          : theme.fieldStroke;
      itemView.indicatorDot.fill = checked ? theme.thumbFill : "transparent";
      itemView.text.fill = disabled ? theme.disabledFill : theme.valueFill;
      itemView.text.text = option?.label ?? itemView.text.text;
      itemView.hitArea.cursor = disabled ? "default" : "pointer";
    });
  }
}
