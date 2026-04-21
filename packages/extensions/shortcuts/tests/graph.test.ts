import { describe, expect, it } from "bun:test";
import {
  bindLeaferGraphShortcuts,
  registerLeaferGraphShortcutFunctions,
  registerLeaferGraphShortcutKeymap
} from "../src/graph";
import {
  createShortcutFunctionRegistry,
  createShortcutKeymapRegistry
} from "../src";
import type { LeaferGraphShortcutHost } from "../src/graph";

describe("@leafergraph/extensions/shortcuts graph", () => {
  it("默认 graph 功能和 keymap 会被正确注册", () => {
    const functionRegistry = createShortcutFunctionRegistry();
    const keymapRegistry = createShortcutKeymapRegistry();
    const history = createFakeHistory();
    const clipboard = createFakeClipboard();

    const disposeFunctions = registerLeaferGraphShortcutFunctions(functionRegistry, {
      host: createFakeHost(),
      history,
      clipboard
    });
    const disposeKeymap = registerLeaferGraphShortcutKeymap(keymapRegistry, {
      enableClipboardBindings: true,
      enableExecutionBindings: true,
      enableHistoryBindings: true
    });

    expect(functionRegistry.list().map((entry) => entry.id)).toEqual([
      "graph.select-all",
      "graph.clear-selection",
      "graph.delete-selection",
      "graph.fit-view",
      "graph.copy",
      "graph.cut",
      "graph.paste",
      "graph.duplicate",
      "graph.undo",
      "graph.redo",
      "graph.play",
      "graph.step",
      "graph.stop"
    ]);
    expect(keymapRegistry.list().map((entry) => entry.id)).toEqual([
      "graph.select-all",
      "graph.clear-selection",
      "graph.delete-selection.delete",
      "graph.delete-selection.backspace",
      "graph.fit-view",
      "graph.copy",
      "graph.cut",
      "graph.paste",
      "graph.duplicate",
      "graph.undo",
      "graph.redo",
      "graph.play",
      "graph.step",
      "graph.stop"
    ]);

    disposeKeymap();
    disposeFunctions();
  });

  it("绑定后会执行 select-all、clear-selection、delete-selection 和 fit-view", () => {
    const host = createFakeHost({
      nodeIds: ["node-1", "node-2"],
      selectedNodeIds: ["node-1", "node-2"]
    });
    const scopeElement = document.createElement("div");
    scopeElement.tabIndex = 0;
    document.body.appendChild(scopeElement);

    const binding = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      platform: "windows"
    });

    scopeElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true
      })
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyA",
        ctrlKey: true
      })
    );
    expect(host.selectionHistory.at(-1)).toEqual(["node-1", "node-2"]);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Escape"
      })
    );
    expect(host.clearSelectionCount).toBe(1);

    host.selectedNodeIds = ["node-1", "node-2"];
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Delete"
      })
    );
    expect(host.removedNodeIds).toEqual(["node-1", "node-2"]);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyF"
      })
    );
    expect(host.fitViewCount).toBe(1);

    binding.destroy();
    scopeElement.remove();
  });

  it("提供 clipboard 宿主后会执行 copy、cut、paste 和 duplicate", () => {
    const host = createFakeHost({
      nodeIds: ["node-1", "node-2"],
      selectedNodeIds: ["node-1"]
    });
    const clipboard = createFakeClipboard({
      canPaste: true
    });
    const scopeElement = document.createElement("div");
    document.body.appendChild(scopeElement);

    const binding = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      clipboard,
      platform: "windows"
    });
    scopeElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true
      })
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyC",
        ctrlKey: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyX",
        ctrlKey: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyV",
        ctrlKey: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyD",
        ctrlKey: true
      })
    );

    expect(clipboard.copyCount).toBe(1);
    expect(clipboard.cutCount).toBe(1);
    expect(clipboard.pasteCount).toBe(1);
    expect(clipboard.duplicateCount).toBe(1);

    binding.destroy();
    scopeElement.remove();
  });

  it("execution 组只有显式启用后才会注册", () => {
    const host = createFakeHost();
    const scopeElement = document.createElement("div");
    document.body.appendChild(scopeElement);

    const withoutExecution = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      platform: "windows"
    });
    scopeElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Enter",
        ctrlKey: true
      })
    );
    expect(host.playCount).toBe(0);
    withoutExecution.destroy();

    const withExecution = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      enableExecutionBindings: true,
      platform: "windows"
    });
    scopeElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Enter",
        ctrlKey: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Enter",
        ctrlKey: true,
        shiftKey: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Period",
        ctrlKey: true
      })
    );
    expect(host.playCount).toBe(1);
    expect(host.stepCount).toBe(1);
    expect(host.stopCount).toBe(1);

    withExecution.destroy();
    scopeElement.remove();
  });

  it("提供 history 宿主后会注册 undo / redo", () => {
    const host = createFakeHost();
    const history = createFakeHistory({
      canUndo: true,
      canRedo: true
    });
    const scopeElement = document.createElement("div");
    document.body.appendChild(scopeElement);

    const binding = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      history,
      platform: "windows"
    });
    scopeElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true
      })
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyZ",
        ctrlKey: true
      })
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyY",
        ctrlKey: true
      })
    );

    expect(history.undoCount).toBe(1);
    expect(history.redoCount).toBe(1);

    binding.destroy();
    scopeElement.remove();
  });

  it("redo 默认会按平台分流，并能解析当前已注册的快捷键标签", () => {
    const host = createFakeHost();
    const clipboard = createFakeClipboard();
    const history = createFakeHistory({
      canUndo: true,
      canRedo: true
    });
    const scopeElement = document.createElement("div");
    document.body.appendChild(scopeElement);

    const macBinding = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      clipboard,
      history,
      platform: "mac"
    });
    expect(macBinding.resolveShortcutLabel("graph.redo")).toBe("⌘⇧Z");
    macBinding.destroy();

    const windowsBinding = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      clipboard,
      history,
      platform: "windows"
    });
    expect(windowsBinding.resolveShortcutLabel("graph.redo")).toBe("Ctrl+Y");
    expect(windowsBinding.resolveShortcutLabel("graph.delete-selection")).toBe(
      "Delete / Backspace"
    );

    windowsBinding.destroy();
    scopeElement.remove();
  });

  it("菜单打开、文本编辑和交互活跃态会阻止误触发", () => {
    const host = createFakeHost({
      nodeIds: ["node-1"],
      selectedNodeIds: ["node-1"],
      contextMenuOpen: true,
      textEditingActive: true,
      interactionActivityState: {
        active: true,
        mode: "node-drag"
      }
    });
    const scopeElement = document.createElement("div");
    document.body.appendChild(scopeElement);

    const binding = bindLeaferGraphShortcuts({
      target: document,
      scopeElement,
      host,
      platform: "windows"
    });
    scopeElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true
      })
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Delete"
      })
    );
    expect(host.removedNodeIds).toEqual([]);

    host.contextMenuOpen = false;
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Delete"
      })
    );
    expect(host.removedNodeIds).toEqual([]);

    host.textEditingActive = false;
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Delete"
      })
    );
    expect(host.removedNodeIds).toEqual([]);

    host.interactionActivityState = {
      active: false,
      mode: "idle"
    };
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Delete"
      })
    );
    expect(host.removedNodeIds).toEqual(["node-1"]);

    binding.destroy();
    scopeElement.remove();
  });
});

function createFakeHost(options?: {
  nodeIds?: string[];
  selectedNodeIds?: string[];
  contextMenuOpen?: boolean;
  textEditingActive?: boolean;
  interactionActivityState?: {
    active: boolean;
    mode: string;
  };
}): LeaferGraphShortcutHost & {
  nodeIds: string[];
  selectedNodeIds: string[];
  selectionHistory: string[][];
  clearSelectionCount: number;
  removedNodeIds: string[];
  fitViewCount: number;
  playCount: number;
  stepCount: number;
  stopCount: number;
  contextMenuOpen: boolean;
  textEditingActive: boolean;
  interactionActivityState: {
    active: boolean;
    mode: string;
  };
} {
  const host = {
    nodeIds: [...(options?.nodeIds ?? [])],
    selectedNodeIds: [...(options?.selectedNodeIds ?? [])],
    selectionHistory: [] as string[][],
    clearSelectionCount: 0,
    removedNodeIds: [] as string[],
    fitViewCount: 0,
    playCount: 0,
    stepCount: 0,
    stopCount: 0,
    contextMenuOpen: options?.contextMenuOpen ?? false,
    textEditingActive: options?.textEditingActive ?? false,
    interactionActivityState: options?.interactionActivityState ?? {
      active: false,
      mode: "idle"
    },
    listNodeIds() {
      return [...host.nodeIds];
    },
    listSelectedNodeIds() {
      return [...host.selectedNodeIds];
    },
    setSelectedNodeIds(nodeIds: readonly string[]) {
      host.selectedNodeIds = [...nodeIds];
      host.selectionHistory.push([...nodeIds]);
      return [...host.selectedNodeIds];
    },
    clearSelectedNodes() {
      host.clearSelectionCount += 1;
      host.selectedNodeIds = [];
      return [];
    },
    removeNode(nodeId: string) {
      host.removedNodeIds.push(nodeId);
      host.selectedNodeIds = host.selectedNodeIds.filter((currentId) => currentId !== nodeId);
      host.nodeIds = host.nodeIds.filter((currentId) => currentId !== nodeId);
    },
    fitView() {
      host.fitViewCount += 1;
    },
    play() {
      host.playCount += 1;
    },
    step() {
      host.stepCount += 1;
    },
    stop() {
      host.stopCount += 1;
    },
    isTextEditingActive() {
      return host.textEditingActive;
    },
    isContextMenuOpen() {
      return host.contextMenuOpen;
    },
    getInteractionActivityState() {
      return host.interactionActivityState;
    }
  };

  return host;
}

function createFakeHistory(options?: {
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const state = {
    undoCount: 0,
    redoCount: 0,
    canUndo: options?.canUndo ?? false,
    canRedo: options?.canRedo ?? false
  };

  return {
    get undoCount() {
      return state.undoCount;
    },
    get redoCount() {
      return state.redoCount;
    },
    undo() {
      state.undoCount += 1;
      return state.canUndo;
    },
    redo() {
      state.redoCount += 1;
      return state.canRedo;
    },
    canUndo() {
      return state.canUndo;
    },
    canRedo() {
      return state.canRedo;
    }
  };
}

function createFakeClipboard(options?: {
  canCopy?: boolean;
  canCut?: boolean;
  canPaste?: boolean;
  canDuplicate?: boolean;
}) {
  const state = {
    copyCount: 0,
    cutCount: 0,
    pasteCount: 0,
    duplicateCount: 0,
    canCopy: options?.canCopy ?? true,
    canCut: options?.canCut ?? true,
    canPaste: options?.canPaste ?? false,
    canDuplicate: options?.canDuplicate ?? true
  };

  return {
    get copyCount() {
      return state.copyCount;
    },
    get cutCount() {
      return state.cutCount;
    },
    get pasteCount() {
      return state.pasteCount;
    },
    get duplicateCount() {
      return state.duplicateCount;
    },
    copySelection() {
      state.copyCount += 1;
      return state.canCopy;
    },
    cutSelection() {
      state.cutCount += 1;
      return state.canCut;
    },
    pasteClipboard() {
      state.pasteCount += 1;
      return state.canPaste;
    },
    duplicateSelection() {
      state.duplicateCount += 1;
      return state.canDuplicate;
    },
    canCopySelection() {
      return state.canCopy;
    },
    canCutSelection() {
      return state.canCut;
    },
    canPasteClipboard() {
      return state.canPaste;
    },
    canDuplicateSelection() {
      return state.canDuplicate;
    }
  };
}
