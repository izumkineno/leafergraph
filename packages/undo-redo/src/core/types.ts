export interface UndoRedoEntry {
  id: string;
  label?: string;
  undo(): void;
  redo(): void;
}

export interface UndoRedoControllerOptions {
  maxEntries?: number;
}

export interface UndoRedoControllerState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  nextUndoLabel?: string;
  nextRedoLabel?: string;
}

export interface UndoRedoController {
  push(entry: UndoRedoEntry): boolean;
  undo(): boolean;
  redo(): boolean;
  clear(): void;
  getState(): UndoRedoControllerState;
  subscribeState(listener: (state: UndoRedoControllerState) => void): () => void;
  destroy(): void;
}
