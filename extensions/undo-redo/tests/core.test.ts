import { describe, expect, it } from "bun:test";
import { createUndoRedoController } from "../src";

describe("@leafergraph/undo-redo core", () => {
  it("push / undo / redo 会维护历史栈状态", () => {
    const controller = createUndoRedoController();
    const calls: string[] = [];

    controller.push({
      id: "entry-1",
      label: "Entry 1",
      undo() {
        calls.push("undo");
      },
      redo() {
        calls.push("redo");
      }
    });

    expect(controller.getState()).toEqual({
      canUndo: true,
      canRedo: false,
      undoCount: 1,
      redoCount: 0,
      nextUndoLabel: "Entry 1",
      nextRedoLabel: undefined
    });

    expect(controller.undo()).toBe(true);
    expect(controller.redo()).toBe(true);
    expect(calls).toEqual(["undo", "redo"]);
  });

  it("maxEntries 会裁剪最旧历史，并在新 push 时清空 redo 栈", () => {
    const controller = createUndoRedoController({
      maxEntries: 2
    });

    controller.push(createEntry("entry-1"));
    controller.push(createEntry("entry-2"));
    controller.push(createEntry("entry-3"));

    expect(controller.getState().undoCount).toBe(2);
    expect(controller.getState().nextUndoLabel).toBe("entry-3");

    expect(controller.undo()).toBe(true);
    expect(controller.getState()).toMatchObject({
      canUndo: true,
      canRedo: true,
      nextUndoLabel: "entry-2",
      nextRedoLabel: "entry-3"
    });

    controller.push(createEntry("entry-4"));
    expect(controller.getState()).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoCount: 2,
      redoCount: 0,
      nextUndoLabel: "entry-4"
    });
  });

  it("maxEntries: 0 会禁用新历史并仍保持状态稳定", () => {
    const controller = createUndoRedoController({
      maxEntries: 0
    });

    expect(controller.push(createEntry("entry-1"))).toBe(false);
    expect(controller.getState()).toEqual({
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      nextUndoLabel: undefined,
      nextRedoLabel: undefined
    });
  });

  it("state 订阅会收到最新 next label 投影", () => {
    const controller = createUndoRedoController();
    const snapshots: string[] = [];
    const unsubscribe = controller.subscribeState((state) => {
      snapshots.push(
        `${state.nextUndoLabel ?? "-"}|${state.nextRedoLabel ?? "-"}`
      );
    });

    controller.push(createEntry("entry-1"));
    controller.undo();
    controller.redo();
    unsubscribe();

    expect(snapshots).toEqual([
      "-|-",
      "entry-1|-",
      "-|entry-1",
      "entry-1|-"
    ]);
  });
});

function createEntry(id: string) {
  return {
    id,
    label: id,
    undo() {},
    redo() {}
  };
}
