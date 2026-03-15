import type { Path } from "leafer-ui";
import type { NodeOptionWidgetOptions } from "@leafergraph/node";
import type { LeaferGraphWidgetRendererContext } from "../../api/plugin";
import {
  bindPressWidgetInteraction,
  type LeaferGraphWidgetPointerEvent
} from "../widget_interaction";
import { WIDGET_FIELD_Y } from "./constants";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface SelectFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  caret: Path;
  disabled: boolean;
  focusKey: string;
  options: NodeOptionWidgetOptions;
}

/**
 * select renderer。
 * 默认使用统一宿主菜单来承接离散候选项，避免把 DOM 菜单逻辑散在各个控件内部。
 */
export class SelectFieldController extends BasicWidgetController<
  NodeOptionWidgetOptions,
  SelectFieldState
> {
  protected mountState(context: LeaferGraphWidgetRendererContext): SelectFieldState {
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const view = new WidgetFieldView(context, {
      label: this.resolveLabel(context.widget, options),
      theme: this.resolveTheme(context),
      cursor: disabled ? "default" : "pointer",
      valueWidth: context.bounds.width - 36
    });
    const { ui, group, bounds } = context;
    const caret = new ui.Path({
      path: `M ${bounds.width - 22} ${WIDGET_FIELD_Y + 13} L ${bounds.width - 16} ${WIDGET_FIELD_Y + 19} L ${bounds.width - 10} ${WIDGET_FIELD_Y + 13}`,
      stroke: this.resolveTheme(context).mutedFill,
      strokeWidth: 1.8,
      strokeCap: "round",
      strokeJoin: "round",
      fill: "transparent",
      hittable: false
    });
    group.add(caret);
    const focusKey = this.resolveFocusKey(context);

    const state: SelectFieldState = {
      view,
      caret,
      disabled,
      focusKey,
      options,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        const theme = this.resolveTheme(runtimeContext);
        view.setTheme(theme, disabled);
        caret.stroke = disabled ? theme.disabledFill : theme.mutedFill;
      },
      syncValue: (runtimeContext, newValue) => {
        const items = this.resolveOptionItems(options.items, newValue);
        const selected = this.resolveSelectedOption(newValue, items);
        view.setDisplay(
          this.resolveTheme(runtimeContext),
          {
            text: selected.label,
            placeholder: false
          },
          disabled
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
        onKeyDown: (event) => this.handleKeyDown(state, context, event)
      })
    );
    this.addCleanup(
      state,
      bindPressWidgetInteraction({
        hitArea: view.hitArea,
        allowPointer: () => !disabled,
        onPress: (event) => {
          context.editing.focusWidget(focusKey);
          this.openMenu(state, context, event);
        }
      })
    );

    return state;
  }

  private handleKeyDown(
    state: SelectFieldState,
    context: LeaferGraphWidgetRendererContext,
    event: KeyboardEvent
  ): boolean {
    if (state.disabled) {
      return this.isReservedWidgetKey(event);
    }

    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowDown" ||
      event.key === "ArrowUp"
    ) {
      this.openMenu(state, context);
      return true;
    }

    if (event.key === "Escape") {
      context.editing.closeActiveEditor();
      return true;
    }

    return this.isReservedWidgetKey(event);
  }

  private openMenu(
    state: SelectFieldState,
    context: LeaferGraphWidgetRendererContext,
    event?: LeaferGraphWidgetPointerEvent
  ): void {
    const items = this.resolveOptionItems(state.options.items, context.value);
    const pointerAnchor =
      typeof event?.origin?.clientX === "number" &&
      typeof event?.origin?.clientY === "number"
        ? {
            x: event.origin.clientX,
            y: event.origin.clientY
          }
        : this.resolveWidgetAnchorClientPoint(state.view.field);

    context.editing.openOptionsMenu({
      nodeId: context.node.id,
      widgetIndex: context.widgetIndex,
      anchorClientX: pointerAnchor.x,
      anchorClientY: pointerAnchor.y,
      value: this.formatWidgetValue(context.value),
      options: items,
      onSelect: (nextValue) => {
        context.setValue(nextValue);
      }
    });
  }
}
