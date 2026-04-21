/**
 * 文本基础 Widget 模块。
 *
 * @remarks
 * 负责 input 和 textarea 的显示、编辑请求与文本同步。
 */

import type {
  NodeTextWidgetOptions,
  NodeTextareaWidgetOptions
} from "@leafergraph/core/node";
import type {
  LeaferGraphWidgetRendererContext,
  LeaferGraphWidgetTextEditRequest
} from "@leafergraph/core/contracts";
import { bindPressWidgetInteraction } from "@leafergraph/widget-runtime";
import {
  WIDGET_FIELD_FONT_SIZE,
  WIDGET_FIELD_MIN_HEIGHT,
  WIDGET_FIELD_Y
} from "./constants";
import { WidgetFieldView } from "./field_view";
import { BasicWidgetController, runtimeRequestRender } from "./template";
import type { BasicWidgetLifecycleState } from "./types";

interface TextFieldState extends BasicWidgetLifecycleState {
  view: WidgetFieldView;
  disabled: boolean;
  multiline: boolean;
  options: NodeTextWidgetOptions | NodeTextareaWidgetOptions;
  focusKey: string;
}

/**
 * 单行 / 多行文本输入 renderer。
 * 真实编辑链路交给统一宿主处理，当前类只负责：
 * - 字段视觉
 * - 焦点与快捷键
 * - 编辑请求发起和回写
 */
export class TextFieldController extends BasicWidgetController<
  NodeTextWidgetOptions | NodeTextareaWidgetOptions,
  TextFieldState
> {
  private readonly multiline: boolean;

  /**
   * 初始化 TextFieldController 实例。
   *
   * @param multiline - `multiline`。
   */
  constructor(multiline: boolean) {
    super();
    this.multiline = multiline;
  }

  /**
   * 挂载状态。
   *
   * @param context - 当前上下文。
   * @returns 挂载状态的结果。
   */
  protected mountState(context: LeaferGraphWidgetRendererContext): TextFieldState {
    // 先准备宿主依赖、初始状态和需要挂载的资源。
    const options = this.resolveOptions(context.widget);
    const disabled = this.resolveDisabled(options);
    const fieldHeight = Math.max(
      context.bounds.height - WIDGET_FIELD_Y,
      this.multiline ? 72 : WIDGET_FIELD_MIN_HEIGHT
    );
    const view = new WidgetFieldView(context, {
      label: this.resolveLabel(context.widget, options),
      theme: this.resolveTheme(context),
      fieldHeight,
      cursor: disabled ? "default" : "text",
      multiline: this.multiline,
      valueHeight: Math.max(fieldHeight - 14, WIDGET_FIELD_FONT_SIZE + 8)
    });
    // 再建立绑定与同步关系，让运行期交互能够稳定生效。
    const focusKey = this.resolveFocusKey(context);

    const state: TextFieldState = {
      view,
      disabled,
      multiline: this.multiline,
      options,
      focusKey,
      cleanups: [],
      syncTheme: (runtimeContext) => {
        view.setTheme(this.resolveTheme(runtimeContext), disabled);
      },
      syncValue: (runtimeContext, newValue) => {
        const display = this.resolveTextDisplay(newValue, options.placeholder);
        view.setDisplay(this.resolveTheme(runtimeContext), display, disabled);
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
        onPress: () => {
          const alreadyFocused = context.editing.isWidgetFocused(focusKey);
          context.editing.focusWidget(focusKey);

          if (!this.multiline || alreadyFocused) {
            this.beginEdit(state, context);
          }
        }
      })
    );

    return state;
  }

  /**
   * 处理键值`Down`。
   *
   * @param state - 当前状态。
   * @param context - 当前上下文。
   * @param event - 当前事件对象。
   * @returns 对应的判断结果。
   */
  private handleKeyDown(
    state: TextFieldState,
    context: LeaferGraphWidgetRendererContext,
    event: KeyboardEvent
  ): boolean {
    if (state.disabled) {
      return this.isReservedWidgetKey(event);
    }

    if (event.key === "Escape") {
      context.editing.closeActiveEditor();
      return true;
    }

    if (event.key === "Enter") {
      this.beginEdit(state, context);
      return true;
    }

    return this.isReservedWidgetKey(event);
  }

  /**
   * 开始`Edit`。
   *
   * @param state - 当前状态。
   * @param context - 当前上下文。
   * @returns 无返回值。
   */
  private beginEdit(
    state: TextFieldState,
    context: LeaferGraphWidgetRendererContext
  ): void {
    if (state.options.readOnly) {
      return;
    }

    const value =
      typeof context.value === "string"
        ? context.value
        : this.formatWidgetValue(context.value);
    const opened = context.editing.beginTextEdit({
      nodeId: context.node.id,
      widgetIndex: context.widgetIndex,
      target: state.view.valueText,
      frame: this.resolveTextEditFrame(state.view),
      value,
      multiline: state.multiline,
      placeholder: state.options.placeholder,
      readOnly: state.options.readOnly,
      maxLength: state.options.maxLength,
      onCommit: (nextValue) => {
        context.commitValue(nextValue);
      },
      onCancel: () => {
        state.syncValue(context, context.value);
        context.requestRender();
      }
    });

    if (opened) {
      context.editing.focusWidget(state.focusKey);
    }
  }

  /**
   * 真实编辑层需要覆盖整块输入框，而不是只覆盖文本图元本身。
   * 这里把字段外框和文本实际内边距一起传给编辑宿主，
   * 让 DOM editor 能和 Leafer 中的输入框位置精确重合。
   *
   * @param view - 视图。
   * @returns 处理后的结果。
   */
  private resolveTextEditFrame(
    view: WidgetFieldView
  ): LeaferGraphWidgetTextEditRequest["frame"] {
    const borderWidth = 1;
    const fieldX = view.field.x ?? 0;
    const fieldY = view.field.y ?? 0;
    const fieldWidth = view.field.width ?? 0;
    const fieldHeight = view.field.height ?? 0;
    const textX = view.valueText.x ?? 0;
    const textY = view.valueText.y ?? 0;
    const textWidth = view.valueText.width ?? 0;
    const textHeight = view.valueText.height ?? 0;
    const leftInset = Math.max(textX - fieldX - borderWidth, 0);
    const topInset = Math.max(textY - fieldY - borderWidth, 0);
    const rightInset = Math.max(
      fieldWidth - (textX - fieldX) - textWidth - borderWidth,
      0
    );
    const bottomInset = Math.max(
      fieldHeight - (textY - fieldY) - textHeight - borderWidth,
      0
    );

    return {
      offsetX: fieldX - textX,
      offsetY: fieldY - textY,
      width: fieldWidth,
      height: fieldHeight,
      paddingTop: topInset,
      paddingRight: rightInset,
      paddingBottom: bottomInset,
      paddingLeft: leftInset
    };
  }
}
