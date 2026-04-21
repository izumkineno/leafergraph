/**
 * 撤销重做核心契约模块。
 *
 * @remarks
 * 负责定义通用的撤销条目、控制器状态和最小控制器协议，
 * 供图宿主和其他扩展复用统一的历史栈抽象。
 */

/**
 * 单条撤销重做记录。
 */
export interface UndoRedoEntry {
  /** 记录自身的稳定 ID。 */
  id: string;
  /** 用户可读标签。 */
  label?: string;
  /** 执行一次撤销。 */
  undo(): void;
  /** 执行一次重做。 */
  redo(): void;
}

/**
 * 撤销重做控制器初始化选项。
 */
export interface UndoRedoControllerOptions {
  /** 最多保留多少条历史记录。 */
  maxEntries?: number;
}

/**
 * 撤销重做控制器状态快照。
 */
export interface UndoRedoControllerState {
  /** 当前是否可撤销。 */
  canUndo: boolean;
  /** 当前是否可重做。 */
  canRedo: boolean;
  /** 当前撤销栈长度。 */
  undoCount: number;
  /** 当前重做栈长度。 */
  redoCount: number;
  /** 下一条将被撤销的记录标签。 */
  nextUndoLabel?: string;
  /** 下一条将被重做的记录标签。 */
  nextRedoLabel?: string;
}

/**
 * 撤销重做控制器协议。
 */
export interface UndoRedoController {
  /** 推入一条新的历史记录。 */
  push(entry: UndoRedoEntry): boolean;
  /** 执行一次撤销。 */
  undo(): boolean;
  /** 执行一次重做。 */
  redo(): boolean;
  /** 清空全部历史记录。 */
  clear(): void;
  /** 获取当前状态快照。 */
  getState(): UndoRedoControllerState;
  /** 订阅状态变化。 */
  subscribeState(listener: (state: UndoRedoControllerState) => void): () => void;
  /** 销毁控制器及其内部资源。 */
  destroy(): void;
}
