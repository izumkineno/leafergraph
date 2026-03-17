/**
 * checkbox 基础 Widget 模块。
 *
 * @remarks
 * 负责内建复选框控件的渲染、状态同步和交互绑定。
 */

import type { Rect, Text, Path } from "leafer-ui";
import type { NodeCheckboxWidgetOptions } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../api/plugin";
import { bindPressWidgetInteraction } from "../widget_interaction";
import { createWidgetSurface, createWidgetValueText } from "../widget_lifecycle";
import {
  WIDGET_CHECKBOX_BOX_SIZE,
  WIDGET_FIELD_PADDING_X,
  WIDGET_FIELD_FONT_SIZE,
  WIDGET_FIELD_Y
} from "./constants";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface CheckboxFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  box: Rect;
  check: Path;
  stateText: Text;
  disabled: boolean;
  options: NodeCheckboxWidgetOptions;
  focusKey: string;
}

/** checkbox renderer。 */
export class CheckboxFieldController extends BasicWidgetController<
  NodeCheckboxWidgetOptions,
  CheckboxFieldState
> {
  protected mountState(context: LeaferGraphWidgetRendererContext): CheckboxFieldState {
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const theme = this.resolveTheme(context);
    const view = new WidgetFieldView(context, {
      label: this.resolveLabel(context.widget, options),
      theme,
      cursor: disabled ? "default" : "pointer",
      valueWidth: context.bounds.width - 44
    });
    const { ui, group } = context;
    const box = createWidgetSurface(ui, {
      x: WIDGET_FIELD_PADDING_X,
      y: WIDGET_FIELD_Y + 8,
      width: WIDGET_CHECKBOX_BOX_SIZE,
      height: WIDGET_CHECKBOX_BOX_SIZE,
      cornerRadius: 6,
      strokeWidth: 1.2
    });
    const check = new ui.Path({
      path: `M ${WIDGET_FIELD_PADDING_X + 4} ${WIDGET_FIELD_Y + 17} L ${WIDGET_FIELD_PADDING_X + 8} ${WIDGET_FIELD_Y + 21} L ${WIDGET_FIELD_PADDING_X + 15} ${WIDGET_FIELD_Y + 12}`,
      strokeWidth: 2.2,
      strokeCap: "round",
      strokeJoin: "round",
      fill: "transparent",
      visible: false,
      hittable: false
    });
    const stateText = createWidgetValueText(ui, {
      x: WIDGET_FIELD_PADDING_X + 28,
      y: WIDGET_FIELD_Y + 9,
      width: context.bounds.width - 42,
      text: "",
      fill: theme.valueFill,
      fontFamily: theme.fontFamily,
      fontSize: WIDGET_FIELD_FONT_SIZE,
      fontWeight: "500"
    });

    group.add([box, check, stateText]);
    const focusKey = this.resolveFocusKey(context);

    const state: CheckboxFieldState = {
      view,
      box,
      check,
      stateText,
      disabled,
      options,
      focusKey,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        const runtimeTheme = this.resolveTheme(runtimeContext);
        const checked = Boolean(runtimeContext.value);
        view.setTheme(runtimeTheme, disabled);
        box.fill = checked ? this.resolveNodeAccent(runtimeContext.node, runtimeTheme) : "transparent";
        box.stroke = checked ? this.resolveNodeAccent(runtimeContext.node, runtimeTheme) : runtimeTheme.fieldStroke;
        stateText.fill = disabled ? runtimeTheme.disabledFill : runtimeTheme.valueFill;
        check.stroke = runtimeTheme.buttonTextFill;
      },
      syncValue: (runtimeContext, newValue) => {
        const runtimeTheme = this.resolveTheme(runtimeContext);
        const checked = Boolean(newValue);
        box.fill = checked ? this.resolveNodeAccent(runtimeContext.node, runtimeTheme) : "transparent";
        box.stroke = checked ? this.resolveNodeAccent(runtimeContext.node, runtimeTheme) : runtimeTheme.fieldStroke;
        check.visible = checked;
        stateText.text = checked
          ? options.onText?.trim() || "Checked"
          : options.offText?.trim() || "Unchecked";
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
    context.commitValue(!Boolean(context.value));
  }
}
