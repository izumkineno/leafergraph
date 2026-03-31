import type {
  UndoRedoController,
  UndoRedoControllerOptions,
  UndoRedoControllerState,
  UndoRedoEntry
} from "./types";

let undoRedoEntrySeed = 1;

export function createUndoRedoController(
  options: UndoRedoControllerOptions = {}
): UndoRedoController {
  const listeners = new Set<(state: UndoRedoControllerState) => void>();
  const undoStack: UndoRedoEntry[] = [];
  const redoStack: UndoRedoEntry[] = [];
  const maxEntries = normalizeMaxEntries(options.maxEntries);

  const emitState = (): void => {
    if (!listeners.size) {
      return;
    }

    const state = getState();
    for (const listener of listeners) {
      listener(state);
    }
  };

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

function normalizeMaxEntries(maxEntries?: number): number {
  if (typeof maxEntries !== "number" || !Number.isFinite(maxEntries)) {
    return 100;
  }

  return Math.max(0, Math.floor(maxEntries));
}

function ensureEntryId(entry: UndoRedoEntry): UndoRedoEntry {
  if (entry.id.trim()) {
    return entry;
  }

  return {
    ...entry,
    id: `undo-redo-entry:${undoRedoEntrySeed++}`
  };
}
