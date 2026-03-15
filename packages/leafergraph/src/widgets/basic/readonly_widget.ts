/**
 * 只读基础 Widget 模块。
 *
 * @remarks
 * 负责 number、string 和 custom 等只读字段样式的统一实现。
 */

import type { NodeBaseWidgetOptions } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../api/plugin";
import { bindPressWidgetInteraction } from "../widget_interaction";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface ReadonlyFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  disabled: boolean;
}

/**
 * 现代只读字段 renderer。
 * `number / string / custom` 默认都走这里，统一拥有专业面板样式和焦点行为。
 */
export class ReadonlyFieldController extends BasicWidgetController<
  NodeBaseWidgetOptions,
  ReadonlyFieldState
> {
  protected mountState(context: LeaferGraphWidgetRendererContext): ReadonlyFieldState {
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const view = new WidgetFieldView(context, {
      label: this.resolveLabel(context.widget, options),
      theme: this.resolveTheme(context),
      cursor: disabled ? "default" : "pointer"
    });

    const state: ReadonlyFieldState = {
      view,
      disabled,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        view.setTheme(this.resolveTheme(runtimeContext), disabled);
      },
      syncValue: (runtimeContext, newValue) => {
        const display = this.resolveTextDisplay(newValue);
        view.setDisplay(this.resolveTheme(runtimeContext), display, disabled);
      }
    };

    const focusKey = this.resolveFocusKey(context);
    this.addCleanup(
      state,
      context.editing.registerFocusableWidget({
        key: focusKey,
        onFocusChange: (focused) => {
          view.setFocused(focused);
          runtimeRequestRender(context);
        },
        onKeyDown: (event) => this.isReservedWidgetKey(event)
      })
    );
    this.addCleanup(
      state,
      bindPressWidgetInteraction({
        hitArea: view.hitArea,
        allowPointer: () => !disabled,
        onPress: () => {
          context.editing.focusWidget(focusKey);
        }
      })
    );

    return state;
  }
}
