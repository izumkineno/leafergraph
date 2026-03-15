/**
 * editor 命令历史记录模块。
 *
 * @remarks
 * 当前阶段先聚焦“核心节点操作可进入历史系统”：
 * - 创建节点
 * - 删除节点
 * - 剪切 / 粘贴 / duplicate
 * - 重置尺寸
 *
 * 这一版刻意保持在 editor 层，不把 undo / redo 协议塞回主包。
 */

import type {
  LeaferGraph,
  LeaferGraphCreateNodeInput,
  LeaferGraphLinkData,
  LeaferGraphResizeNodeInput
} from "leafergraph";
import type {
  EditorCommandExecution,
  EditorCommandHistoryPayload,
  EditorCommandNodeSnapshot
} from "./command_bus";
import type { EditorNodeSelectionController } from "../state/selection";

/** editor 历史记录的公开条目。 */
export interface EditorCommandHistoryEntry {
  /** 进入历史栈时的摘要。 */
  summary: string;
  /** 提示用户“撤销什么”的文案。 */
  undoSummary: string;
  /** 提示用户“重做什么”的文案。 */
  redoSummary: string;
  /** 对应原始命令的执行时间。 */
  timestamp: number;
}

/** 一次撤销或重做操作的返回结果。 */
export interface EditorCommandHistoryStep {
  /** 本次执行方向。 */
  direction: "undo" | "redo";
  /** 实际执行的历史条目。 */
  entry: EditorCommandHistoryEntry;
}

/** editor 历史记录管理器。 */
export interface EditorCommandHistory {
  /** 当前是否存在可撤销操作。 */
  readonly canUndo: boolean;
  /** 当前是否存在可重做操作。 */
  readonly canRedo: boolean;
  /** 最近一条可撤销条目。 */
  readonly undoEntry: EditorCommandHistoryEntry | null;
  /** 最近一条可重做条目。 */
  readonly redoEntry: EditorCommandHistoryEntry | null;
  /** 读取当前历史栈快照。 */
  listEntries(): readonly EditorCommandHistoryEntry[];
  /** 尝试把一条命令执行记录推进历史栈。 */
  record(execution: EditorCommandExecution): EditorCommandHistoryEntry | null;
  /** 执行撤销。 */
  undo(): EditorCommandHistoryStep | null;
  /** 执行重做。 */
  redo(): EditorCommandHistoryStep | null;
  /** 清空历史栈。 */
  clear(): void;
}

/**
 * editor 历史记录创建参数。
 *
 * @remarks
 * 历史记录本身不重新实现节点命令，
 * 但需要复用 GraphViewport 已有的节点绑定与选区同步能力。
 */
export interface CreateEditorCommandHistoryOptions {
  graph: LeaferGraph;
  selection: EditorNodeSelectionController;
  bindNode(node: { id: string; title: string; type?: string }): void;
  unbindNode(nodeId: string): void;
  /** 历史栈最大保留条目数。 */
  maxEntries?: number;
}

interface EditorCommandHistoryStackEntry extends EditorCommandHistoryEntry {
  undo(): void;
  redo(): void;
}

/** 规范化节点 ID 列表，保留原顺序并移除空值与重复项。 */
function normalizeNodeIdList(nodeIds: readonly string[]): string[] {
  const nextNodeIds: string[] = [];
  const nodeIdSet = new Set<string>();

  for (const nodeId of nodeIds) {
    const safeNodeId = nodeId.trim();
    if (!safeNodeId || nodeIdSet.has(safeNodeId)) {
      continue;
    }

    nodeIdSet.add(safeNodeId);
    nextNodeIds.push(safeNodeId);
  }

  return nextNodeIds;
}

/** 把正式节点快照恢复成主包 `createNode(...)` 可消费的输入。 */
function createRestoreNodeInput(
  snapshot: EditorCommandNodeSnapshot
): LeaferGraphCreateNodeInput {
  return structuredClone({
    id: snapshot.id,
    type: snapshot.type,
    title: snapshot.title,
    x: snapshot.layout.x,
    y: snapshot.layout.y,
    width: snapshot.layout.width,
    height: snapshot.layout.height,
    properties: snapshot.properties,
    propertySpecs: snapshot.propertySpecs,
    inputs: snapshot.inputs,
    outputs: snapshot.outputs,
    widgets: snapshot.widgets,
    data: snapshot.data
  } satisfies LeaferGraphCreateNodeInput);
}

/** 恢复节点尺寸时使用的最小宽高结构。 */
function createResizeInput(size: {
  width: number;
  height: number;
}): LeaferGraphResizeNodeInput {
  return {
    width: size.width,
    height: size.height
  };
}

/** 深拷贝正式连线快照。 */
function cloneLink(link: LeaferGraphLinkData): LeaferGraphLinkData {
  return structuredClone(link);
}

/**
 * 创建 editor 历史记录管理器。
 *
 * @param options - 历史记录依赖项。
 * @returns 可供 GraphViewport、工具栏和快捷键复用的历史栈管理器。
 */
export function createEditorCommandHistory(
  options: CreateEditorCommandHistoryOptions
): EditorCommandHistory {
  const maxEntries = Math.max(1, options.maxEntries ?? 100);
  const undoStack: EditorCommandHistoryStackEntry[] = [];
  const redoStack: EditorCommandHistoryStackEntry[] = [];

  const removeNodeIds = (nodeIds: readonly string[]): boolean => {
    const orderedNodeIds = normalizeNodeIdList(nodeIds);
    if (!orderedNodeIds.length) {
      return false;
    }

    const nextSelectedNodeIds = options.selection.selectedNodeIds.filter(
      (selectedNodeId) => !orderedNodeIds.includes(selectedNodeId)
    );
    options.selection.setMany(nextSelectedNodeIds);

    let removed = false;
    for (const nodeId of orderedNodeIds) {
      options.unbindNode(nodeId);
      removed = options.graph.removeNode(nodeId) || removed;
    }

    return removed;
  };

  const restoreNodeSnapshots = (
    nodeSnapshots: readonly EditorCommandNodeSnapshot[]
  ): string[] => {
    const restoredNodeIds: string[] = [];

    for (const snapshot of nodeSnapshots) {
      if (options.graph.getNodeSnapshot(snapshot.id)) {
        restoredNodeIds.push(snapshot.id);
        continue;
      }

      const node = options.graph.createNode(createRestoreNodeInput(snapshot));
      options.bindNode(node);

      if (snapshot.flags?.collapsed) {
        options.graph.setNodeCollapsed(snapshot.id, true);
      }

      restoredNodeIds.push(node.id);
    }

    options.selection.setMany(restoredNodeIds);
    return restoredNodeIds;
  };

  const restoreLinks = (links: readonly LeaferGraphLinkData[]): void => {
    for (const link of links) {
      try {
        options.graph.createLink(cloneLink(link));
      } catch {
        // 当前阶段历史记录优先保证主流程可继续，
        // 若某条连线因端点不存在或 ID 冲突无法恢复，则跳过单条连线。
      }
    }
  };

  const buildHistoryEntry = (
    execution: EditorCommandExecution
  ): EditorCommandHistoryStackEntry | null => {
    if (
      !execution.recordable ||
      !execution.changed ||
      !execution.historyPayload
    ) {
      return null;
    }

    const baseEntry: EditorCommandHistoryEntry = {
      summary: execution.summary,
      undoSummary: `撤销：${execution.summary}`,
      redoSummary: `重做：${execution.summary}`,
      timestamp: execution.timestamp
    };

    const payload: EditorCommandHistoryPayload = execution.historyPayload;

    switch (payload.kind) {
      case "create-nodes": {
        const nodeIds = payload.nodeSnapshots.map((snapshot) => snapshot.id);
        return {
          ...baseEntry,
          undo() {
            removeNodeIds(nodeIds);
          },
          redo() {
            restoreNodeSnapshots(payload.nodeSnapshots);
          }
        };
      }
      case "remove-nodes": {
        const nodeIds = payload.nodeSnapshots.map((snapshot) => snapshot.id);
        return {
          ...baseEntry,
          undo() {
            restoreNodeSnapshots(payload.nodeSnapshots);
            restoreLinks(payload.links);
          },
          redo() {
            removeNodeIds(nodeIds);
          }
        };
      }
      case "resize-node": {
        return {
          ...baseEntry,
          undo() {
            const changed = options.graph.resizeNode(
              payload.nodeId,
              createResizeInput(payload.beforeSize)
            );
            if (changed) {
              options.selection.select(payload.nodeId);
            }
          },
          redo() {
            const changed = options.graph.resizeNode(
              payload.nodeId,
              createResizeInput(payload.afterSize)
            );
            if (changed) {
              options.selection.select(payload.nodeId);
            }
          }
        };
      }
      default:
        return null;
    }
  };

  const pushUndoEntry = (entry: EditorCommandHistoryStackEntry): void => {
    undoStack.push(entry);
    if (undoStack.length > maxEntries) {
      undoStack.shift();
    }
  };

  return {
    get canUndo(): boolean {
      return undoStack.length > 0;
    },

    get canRedo(): boolean {
      return redoStack.length > 0;
    },

    get undoEntry(): EditorCommandHistoryEntry | null {
      return undoStack.at(-1) ?? null;
    },

    get redoEntry(): EditorCommandHistoryEntry | null {
      return redoStack.at(-1) ?? null;
    },

    listEntries(): readonly EditorCommandHistoryEntry[] {
      return undoStack;
    },

    record(execution: EditorCommandExecution): EditorCommandHistoryEntry | null {
      const entry = buildHistoryEntry(execution);
      if (!entry) {
        return null;
      }

      pushUndoEntry(entry);
      redoStack.length = 0;
      return entry;
    },

    undo(): EditorCommandHistoryStep | null {
      const entry = undoStack.pop();
      if (!entry) {
        return null;
      }

      entry.undo();
      redoStack.push(entry);
      return {
        direction: "undo",
        entry
      };
    },

    redo(): EditorCommandHistoryStep | null {
      const entry = redoStack.pop();
      if (!entry) {
        return null;
      }

      entry.redo();
      pushUndoEntry(entry);
      return {
        direction: "redo",
        entry
      };
    },

    clear(): void {
      undoStack.length = 0;
      redoStack.length = 0;
    }
  };
}
