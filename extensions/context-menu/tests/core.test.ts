import { afterEach, describe, expect, it } from "bun:test";
import {
  createContextMenuController,
  findContextMenuItemByKey,
  normalizeContextMenuItems,
  type ContextMenuContext,
  type ContextMenuItem,
  type ContextMenuSelectionState
} from "../src/core/index";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("@leafergraph/context-menu core", () => {
  it("会按目标分类、显隐规则和 enableWhen 过滤菜单项", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const context = createContext(container, "node");
    const selectionState: ContextMenuSelectionState = {
      checkboxState: new Map(),
      radioState: new Map(),
      lazyChildrenState: new Map()
    };

    const items: ContextMenuItem[] = [
      { kind: "separator" },
      { key: "canvas-only", label: "画布菜单", targetKinds: ["canvas"] },
      { key: "hidden", label: "隐藏项", hidden: true },
      { key: "node-only", label: "节点菜单", targetKinds: ["node"] },
      {
        key: "disabled-by-rule",
        label: "条件禁用",
        enableWhen: () => false
      },
      { kind: "separator" },
      { kind: "separator" },
      { key: "visible", label: "可见项" },
      { kind: "separator" }
    ];

    const normalized = normalizeContextMenuItems(items, context, selectionState);

    expect(normalized.map((item) => ("key" in item ? item.key : item.kind))).toEqual([
      "node-only",
      "disabled-by-rule",
      "separator",
      "visible"
    ]);

    expect(findContextMenuItemByKey(normalized, "canvas-only")).toBeUndefined();
    expect(
      findContextMenuItemByKey(normalized, "disabled-by-rule")
    ).toMatchObject({ disabled: true });
  });

  it("控制器会维护 checkbox 与 radio 的非受控状态", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const controller = createContextMenuController();
    controller.open(createContext(container, "node"), [
      {
        kind: "checkbox",
        key: "auto-run",
        label: "自动运行",
        defaultChecked: false,
        closeOnSelect: false
      },
      {
        kind: "radio",
        key: "light",
        groupKey: "theme",
        value: "light",
        label: "浅色",
        defaultChecked: true,
        closeOnSelect: false
      },
      {
        kind: "radio",
        key: "dark",
        groupKey: "theme",
        value: "dark",
        label: "深色",
        closeOnSelect: false
      }
    ]);

    await controller.activateKey(0, "auto-run");
    await controller.activateKey(0, "dark");

    const state = controller.getState();
    expect(findContextMenuItemByKey(state.items, "auto-run")).toMatchObject({
      checked: true
    });
    expect(findContextMenuItemByKey(state.items, "light")).toMatchObject({
      checked: false
    });
    expect(findContextMenuItemByKey(state.items, "dark")).toMatchObject({
      checked: true
    });

    controller.destroy();
  });
});

function createContext(
  container: HTMLElement,
  kind: ContextMenuContext["target"]["kind"]
): ContextMenuContext {
  return {
    container,
    host: document.body,
    target: { kind },
    triggerReason: "manual",
    pagePoint: { x: 24, y: 24 },
    clientPoint: { x: 24, y: 24 },
    containerPoint: { x: 24, y: 24 }
  };
}
