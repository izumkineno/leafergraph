import type {
  UndoRedoController,
  UndoRedoControllerOptions,
  UndoRedoControllerState,
  UndoRedoEntry
} from "./types";

let undoRedoEntrySeed = 1;

/**
 * 处理 `createUndoRedoController` 相关逻辑。
 *
 * @param options - 可选配置项。
 * @returns 创建后的结果对象。
 */
export function createUndoRedoController(
  options: UndoRedoControllerOptions = {}
): UndoRedoController {
  // 先归一化输入和默认值，为后续组装阶段提供稳定基线。
  const listeners = new Set<(state: UndoRedoControllerState) => void>();
  const undoStack: UndoRedoEntry[] = [];
  const redoStack: UndoRedoEntry[] = [];
  // 再按当前规则组合结果，并把派生数据一并收口到输出里。
  const maxEntries = normalizeMaxEntries(options.maxEntries);

  /**
   * 派发状态。
   *
   * @returns 无返回值。
   */
  const emitState = (): void => {
    if (!listeners.size) {
      return;
    }

    const state = getState();
    for (const listener of listeners) {
      listener(state);
    }
  };

  /**
   * 获取状态。
   *
   * @returns 处理后的结果。
   */
  const getState = (): UndoRedoControllerState => ({
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    nextUndoLabel: undoStack.at(-1)?.label,
    nextRedoLabel: redoStack.at(-1)?.label
  });

  return {
    push(entry) {
      if (maxEntries === 0) {
        if (redoStack.length) {
          redoStack.length = 0;
          emitState();
        }
        return false;
      }

      undoStack.push(ensureEntryId(entry));
      if (undoStack.length > maxEntries) {
        undoStack.splice(0, undoStack.length - maxEntries);
      }
      if (redoStack.length) {
        redoStack.length = 0;
      }
      emitState();
      return true;
    },
    undo() {
      const entry = undoStack.at(-1);
      if (!entry) {
        return false;
      }

      try {
        entry.undo();
      } catch {
        return false;
      }

      undoStack.pop();
      redoStack.push(entry);
      emitState();
      return true;
    },
    redo() {
      const entry = redoStack.at(-1);
      if (!entry) {
        return false;
      }

      try {
        entry.redo();
      } catch {
        return false;
      }

      redoStack.pop();
      undoStack.push(entry);
      emitState();
      return true;
    },
    clear() {
      if (!undoStack.length && !redoStack.length) {
        return;
      }

      undoStack.length = 0;
      redoStack.length = 0;
      emitState();
    },
    getState,
    subscribeState(listener) {
      listeners.add(listener);
      listener(getState());

      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      undoStack.length = 0;
      redoStack.length = 0;
      listeners.clear();
    }
  };
}

/**
 * 处理 `normalizeMaxEntries` 相关逻辑。
 *
 * @param maxEntries - `maxEntries` 参数。
 * @returns 处理后的结果。
 */
function normalizeMaxEntries(maxEntries?: number): number {
  if (typeof maxEntries !== "number" || !Number.isFinite(maxEntries)) {
    return 100;
  }

  return Math.max(0, Math.floor(maxEntries));
}

/**
 * 确保条目 ID。
 *
 * @param entry - 条目。
 * @returns 确保条目 ID的结果。
 */
function ensureEntryId(entry: UndoRedoEntry): UndoRedoEntry {
  if (entry.id.trim()) {
    return entry;
  }

  return {
    ...entry,
    id: `undo-redo-entry:${undoRedoEntrySeed++}`
  };
}
