import { describe, expect, test } from "bun:test";

import { ButtonFieldController } from "../../src/widget/button_widget";
import { CheckboxFieldController } from "../../src/widget/checkbox_widget";
import { ReadonlyFieldController } from "../../src/widget/readonly_widget";
import { RadioFieldController } from "../../src/widget/radio_widget";
import { SelectFieldController } from "../../src/widget/select_widget";
import { SliderFieldController } from "../../src/widget/slider_widget";
import { TextFieldController } from "../../src/widget/text_widget";
import { ToggleFieldController } from "../../src/widget/toggle_widget";
import {
  createPointerEvent,
  createWidgetTestContext
} from "./test_utils";

function createKeyEvent(key: string): KeyboardEvent {
  return { key } as KeyboardEvent;
}

describe("basic-kit widget behaviors", () => {
  test("readonly widget focuses and cleans up its bindings", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "string",
      widgetName: "readOnlyValue",
      value: "hello"
    });
    const controller = new ReadonlyFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;
    const focusKey = `${context.node.id}:${context.widgetIndex}`;

    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(editing.focusedWidgetKey).toBe(focusKey);
    expect(records.renders).toBe(1);
    expect(state.view.field.selected).toBe(true);
    expect(state.view.focusRing.selected).toBe(true);

    lifecycle.destroy(state, context as never);
    expect(editing.focusBindings.size).toBe(0);

    editing.clearWidgetFocus();
    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(editing.focusedWidgetKey).toBeNull();
  });

  test("button widget keeps pointer and keyboard activation", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "button",
      widgetName: "runAction",
      value: "payload",
      widgetOptions: {
        action: "run",
        text: "Run"
      }
    });
    const controller = new ButtonFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;
    const focusKey = `${context.node.id}:${context.widgetIndex}`;

    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(editing.focusedWidgetKey).toBe(focusKey);
    expect(records.renders).toBeGreaterThan(0);
    expect(records.actions).toEqual([["run", "payload", { widgetType: "button" }]]);

    expect(editing.dispatchKeyDown(createKeyEvent("Enter"))).toBe(true);
    expect(records.actions).toHaveLength(2);

    lifecycle.destroy(state, context as never);
    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(records.actions).toHaveLength(2);
  });

  test("checkbox widget toggles on press and Enter/Space", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "checkbox",
      widgetName: "checked",
      value: false,
      widgetOptions: {
        onText: "Yes",
        offText: "No"
      }
    });
    const controller = new CheckboxFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;
    const focusKey = `${context.node.id}:${context.widgetIndex}`;

    state.view.hitArea.emit("pointer.down", createPointerEvent());
    lifecycle.update(state, context as never, context.value);
    expect(editing.focusedWidgetKey).toBe(focusKey);
    expect(records.commitValues).toEqual([true]);
    expect(state.stateText.text).toBe("Yes");

    expect(editing.dispatchKeyDown(createKeyEvent("Enter"))).toBe(true);
    lifecycle.update(state, context as never, context.value);
    expect(records.commitValues).toEqual([true, false]);

    lifecycle.destroy(state, context as never);
    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(records.commitValues).toEqual([true, false]);
  });

  test("toggle widget preserves the same boolean activation flow", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "toggle",
      widgetName: "isEnabled",
      value: false,
      widgetOptions: {
        onText: "ON",
        offText: "OFF"
      }
    });
    const controller = new ToggleFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;

    state.view.hitArea.emit("pointer.down", createPointerEvent());
    lifecycle.update(state, context as never, context.value);
    expect(records.commitValues).toEqual([true]);
    expect(state.stateText.text).toBe("ON");

    expect(editing.dispatchKeyDown(createKeyEvent(" "))).toBe(true);
    lifecycle.update(state, context as never, context.value);
    expect(records.commitValues).toEqual([true, false]);

    lifecycle.destroy(state, context as never);
    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(records.commitValues).toEqual([true, false]);
  });

  test("select widget opens the menu and writes the chosen option", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "select",
      widgetName: "mode",
      value: "alpha",
      widgetOptions: {
        items: [
          { label: "Alpha", value: "alpha" },
          { label: "Beta", value: "beta" }
        ]
      }
    });
    const controller = new SelectFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;

    state.view.hitArea.emit("pointer.down", createPointerEvent({ origin: { clientX: 12, clientY: 18 } }));
    expect(editing.openOptionsMenuRequests).toHaveLength(1);
    expect(editing.openOptionsMenuRequests[0].options.map((item: any) => item.label)).toEqual([
      "Alpha",
      "Beta"
    ]);
    editing.openOptionsMenuRequests[0].onSelect("beta");
    expect(records.commitValues).toEqual(["beta"]);

    expect(editing.dispatchKeyDown(createKeyEvent("ArrowDown"))).toBe(true);
    expect(editing.openOptionsMenuRequests).toHaveLength(2);

    lifecycle.destroy(state, context as never);
  });

  test("text widget begins editing with the current request shape", () => {
    const { context, editing } = createWidgetTestContext({
      widgetType: "input",
      widgetName: "title",
      value: "hello world",
      widgetOptions: {
        placeholder: "Type here",
        maxLength: 12,
        readOnly: false
      }
    });
    const controller = new TextFieldController(false);
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;

    state.view.hitArea.emit("pointer.down", createPointerEvent());
    expect(editing.beginTextEditRequests).toHaveLength(1);
    expect(editing.beginTextEditRequests[0]).toMatchObject({
      nodeId: context.node.id,
      widgetIndex: context.widgetIndex,
      value: "hello world",
      multiline: false,
      placeholder: "Type here",
      readOnly: false,
      maxLength: 12
    });

    expect(editing.dispatchKeyDown(createKeyEvent("Escape"))).toBe(true);
    expect(editing.closeActiveEditorCalls).toBe(1);

    lifecycle.destroy(state, context as never);
  });

  test("radio widget skips disabled options and commits the active choice", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "radio",
      widgetName: "choice",
      value: "alpha",
      widgetOptions: {
        items: [
          { label: "Alpha", value: "alpha" },
          { label: "Beta", value: "beta", disabled: true },
          { label: "Gamma", value: "gamma" }
        ]
      }
    });
    const controller = new RadioFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;
    const focusKey = `${context.node.id}:${context.widgetIndex}`;

    state.items[1].hitArea.emit("pointer.down", createPointerEvent());
    expect(records.commitValues).toEqual([]);

    state.items[2].hitArea.emit("pointer.down", createPointerEvent());
    expect(editing.focusedWidgetKey).toBe(focusKey);
    expect(records.commitValues).toEqual(["gamma"]);

    expect(editing.dispatchKeyDown(createKeyEvent("ArrowDown"))).toBe(true);
    expect(records.commitValues).toEqual(["gamma", "alpha"]);

    lifecycle.destroy(state, context as never);
  });

  test("slider widget keeps drag and key-step behavior", () => {
    const { context, editing, records } = createWidgetTestContext({
      widgetType: "slider",
      widgetName: "progress",
      value: 5,
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 56
      },
      nodeLayoutX: 0,
      widgetOptions: {
        min: 0,
        max: 10,
        step: 1
      }
    });
    const controller = new SliderFieldController();
    const lifecycle = controller.createLifecycle();
    const state = lifecycle.mount(context as never) as any;
    const focusKey = `${context.node.id}:${context.widgetIndex}`;
    const dragEvent = createPointerEvent({
      x: 50,
      getLocalPoint() {
        return { x: 50, y: 0 };
      }
    });

    state.hitArea.emit("pointer.down", dragEvent);
    state.hitArea.emit("pointer.up", dragEvent);
    expect(editing.focusedWidgetKey).toBe(focusKey);
    expect(records.setValues).toContain(5);
    expect(records.commitValues).toContain(5);

    expect(editing.dispatchKeyDown(createKeyEvent("ArrowRight"))).toBe(true);
    expect(records.commitValues.at(-1)).toBe(6);
    expect(editing.dispatchKeyDown(createKeyEvent("Home"))).toBe(true);
    expect(records.commitValues.at(-1)).toBe(0);

    lifecycle.destroy(state, context as never);
  });
});
