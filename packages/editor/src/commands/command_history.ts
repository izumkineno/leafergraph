/**
 * editor 命令历史记录模块。
 *
 * @remarks
 * 当前阶段先聚焦“核心节点操作可进入历史系统”：
 * - 创建节点
 * - 删除节点
 * - 剪切 / 粘贴 / duplicate
 * - 重置尺寸
 * - 连线创建 / 删除 / 重连
 *
 * 这一版刻意保持在 editor 层，不把 undo / redo 协议塞回主包。
 */

import type {
  GraphLink,
  GraphOperation,
  LeaferGraph,
} from "leafergraph";
import type {
  EditorCommandExecution,
  EditorCommandHistoryPayload,
  EditorCommandNodeSnapshot
} from "./command_bus";
import {
  createLinkCreateOperation,
  createLinkReconnectOperation,
  createLinkRemoveOperation,
  createNodeCreateOperationFromSnapshot,
  createNodeMoveOperation,
  createNodeRemoveOperation,
  createNodeResizeOperation,
  createNodeUpdateOperation,
  recreateGraphOperation
} from "./graph_operation_utils";
import type { EditorGraphDocumentSession } from "../session/graph_document_session";
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
  session: EditorGraphDocumentSession;
  selection: EditorNodeSelectionController;
  bindNode(node: { id: string; title: string; type?: string }): void;
  unbindNode(nodeId: string): void;
  /** 历史栈最大保留条目数。 */
  maxEntries?: number;
  /** 历史栈发生变化时的通知。 */
  onDidChange?(): void;
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

/** 重放一组记录过的正式操作，并给历史方向补充新的来源标记。 */
function replayGraphOperations(
  session: EditorGraphDocumentSession,
  operations: readonly GraphOperation[],
  source: string
): boolean {
  let changed = false;

  for (const operation of operations) {
    const result = session.submitOperation(
      recreateGraphOperation(operation, source)
    );
    changed = (result.accepted && result.changed) || changed;
  }

  return changed;
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

  const removeNodeIds = (
    nodeIds: readonly string[],
    source: string
  ): boolean => {
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
      const result = options.session.submitOperation(
        createNodeRemoveOperation(nodeId, source)
      );
      removed = (result.accepted && result.changed) || removed;
    }

    return removed;
  };

  const restoreNodeSnapshots = (
    nodeSnapshots: readonly EditorCommandNodeSnapshot[],
    source: string
  ): string[] => {
    const restoredNodeIds: string[] = [];

    for (const snapshot of nodeSnapshots) {
      const existingSnapshot = options.graph.getNodeSnapshot(snapshot.id);
      if (existingSnapshot) {
        options.bindNode({
          id: existingSnapshot.id,
          title: existingSnapshot.title ?? existingSnapshot.id,
          type: existingSnapshot.type
        });
        restoredNodeIds.push(existingSnapshot.id);
        continue;
      }

      const result = options.session.submitOperation(
        createNodeCreateOperationFromSnapshot(snapshot, source)
      );
      if (!result.accepted) {
        continue;
      }

      const restoredSnapshot = options.graph.getNodeSnapshot(snapshot.id);
      if (!restoredSnapshot) {
        continue;
      }

      options.bindNode({
        id: restoredSnapshot.id,
        title: restoredSnapshot.title ?? restoredSnapshot.id,
        type: restoredSnapshot.type
      });

      if (snapshot.flags?.collapsed) {
        options.graph.setNodeCollapsed(snapshot.id, true);
      }

      restoredNodeIds.push(restoredSnapshot.id);
    }

    options.selection.setMany(restoredNodeIds);
    return restoredNodeIds;
  };

  const restoreLinks = (links: readonly GraphLink[], source: string): void => {
    for (const link of links) {
      options.session.submitOperation(createLinkCreateOperation(link, source));
    }
  };

  const removeLinksByIds = (linkIds: readonly string[], source: string): void => {
    for (const linkId of linkIds) {
      options.session.submitOperation(createLinkRemoveOperation(linkId, source));
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
    const recordedOperations = execution.operations ?? [];

    switch (payload.kind) {
      case "create-nodes": {
        const nodeIds = payload.nodeSnapshots.map((snapshot) => snapshot.id);
        return {
          ...baseEntry,
          undo() {
            removeNodeIds(nodeIds, "editor.history.undo");
          },
          redo() {
            restoreNodeSnapshots(payload.nodeSnapshots, "editor.history.redo");
          }
        };
      }
      case "remove-nodes": {
        const nodeIds = payload.nodeSnapshots.map((snapshot) => snapshot.id);
        return {
          ...baseEntry,
          undo() {
            restoreNodeSnapshots(payload.nodeSnapshots, "editor.history.undo");
            restoreLinks(payload.links, "editor.history.undo");
          },
          redo() {
            removeNodeIds(nodeIds, "editor.history.redo");
          }
        };
      }
      case "resize-node": {
        return {
          ...baseEntry,
          undo() {
            const result = options.session.submitOperation(
              createNodeResizeOperation(
                payload.nodeId,
                payload.beforeSize,
                "editor.history.undo"
              )
            );
            if (result.accepted && result.changed) {
              options.selection.select(payload.nodeId);
            }
          },
          redo() {
            const changed = recordedOperations.length
              ? replayGraphOperations(
                  options.session,
                  recordedOperations,
                  "editor.history.redo"
                )
              : options.session.submitOperation(
                    createNodeResizeOperation(
                      payload.nodeId,
                      payload.afterSize,
                      "editor.history.redo"
                    )
                  ).changed;
            if (changed) {
              options.selection.select(payload.nodeId);
            }
          }
        };
      }
      case "move-nodes": {
        const movedNodeIds = payload.positions.map((item) => item.nodeId);
        return {
          ...baseEntry,
          undo() {
            let changed = false;
            for (const item of payload.positions) {
              const result = options.session.submitOperation(
                createNodeMoveOperation(
                  item.nodeId,
                  item.beforePosition,
                  "editor.history.undo"
                )
              );
              changed = (result.accepted && result.changed) || changed;
            }

            if (changed) {
              options.selection.setMany(movedNodeIds);
            }
          },
          redo() {
            const changed = recordedOperations.length
              ? replayGraphOperations(
                  options.session,
                  recordedOperations,
                  "editor.history.redo"
                )
              : (() => {
                  let replayChanged = false;
                  for (const item of payload.positions) {
                    const result = options.session.submitOperation(
                      createNodeMoveOperation(
                        item.nodeId,
                        item.afterPosition,
                        "editor.history.redo"
                      )
                    );
                    replayChanged =
                      (result.accepted && result.changed) || replayChanged;
                  }

                  return replayChanged;
                })();
            if (changed) {
              options.selection.setMany(movedNodeIds);
            }
          }
        };
      }
      case "create-links": {
        const linkIds = payload.links.map((link) => link.id);
        return {
          ...baseEntry,
          undo() {
            removeLinksByIds(linkIds, "editor.history.undo");
          },
          redo() {
            if (recordedOperations.length) {
              replayGraphOperations(
                options.session,
                recordedOperations,
                "editor.history.redo"
              );
              return;
            }

            restoreLinks(payload.links, "editor.history.redo");
          }
        };
      }
      case "remove-links": {
        const linkIds = payload.links.map((link) => link.id);
        return {
          ...baseEntry,
          undo() {
            restoreLinks(payload.links, "editor.history.undo");
          },
          redo() {
            if (recordedOperations.length) {
              replayGraphOperations(
                options.session,
                recordedOperations,
                "editor.history.redo"
              );
              return;
            }

            removeLinksByIds(linkIds, "editor.history.redo");
          }
        };
      }
      case "reconnect-link": {
        return {
          ...baseEntry,
          undo() {
            options.session.submitOperation(
              createLinkReconnectOperation(
                payload.afterLink.id,
                {
                  source: payload.beforeLink.source,
                  target: payload.beforeLink.target
                },
                "editor.history.undo"
              )
            );
          },
          redo() {
            if (recordedOperations.length) {
              replayGraphOperations(
                options.session,
                recordedOperations,
                "editor.history.redo"
              );
              return;
            }

            options.session.submitOperation(
              createLinkReconnectOperation(
                payload.beforeLink.id,
                {
                  source: payload.afterLink.source,
                  target: payload.afterLink.target
                },
                "editor.history.redo"
              )
            );
          }
        };
      }
      case "update-node": {
        return {
          ...baseEntry,
          undo() {
            const result = options.session.submitOperation(
              createNodeUpdateOperation(
                payload.nodeId,
                payload.beforeInput,
                "editor.history.undo"
              )
            );
            if (result.accepted && result.changed) {
              options.selection.select(payload.nodeId);
            }
          },
          redo() {
            const changed = recordedOperations.length
              ? replayGraphOperations(
                  options.session,
                  recordedOperations,
                  "editor.history.redo"
                )
              : options.session.submitOperation(
                    createNodeUpdateOperation(
                      payload.nodeId,
                      payload.afterInput,
                      "editor.history.redo"
                    )
                  ).changed;
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
    options.onDidChange?.();
  };

  const applyRecordedExecution = (
    execution: EditorCommandExecution
  ): EditorCommandHistoryEntry | null => {
    const entry = buildHistoryEntry(execution);
    if (!entry) {
      return null;
    }

    pushUndoEntry(entry);
    redoStack.length = 0;
    return entry;
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
      if (execution.authority.status === "pending") {
        void execution.authority.confirmation?.then((confirmations) => {
          const hasRejectedConfirmation = confirmations.some(
            (confirmation) => !confirmation.accepted
          );
          if (hasRejectedConfirmation) {
            return;
          }

          applyRecordedExecution({
            ...execution,
            authority: {
              ...execution.authority,
              status: "confirmed",
              pendingOperationIds: []
            }
          });
        });
        return null;
      }

      if (execution.authority.status === "rejected") {
        return null;
      }

      return applyRecordedExecution(execution);
    },

    undo(): EditorCommandHistoryStep | null {
      const entry = undoStack.pop();
      if (!entry) {
        return null;
      }

      entry.undo();
      redoStack.push(entry);
      options.onDidChange?.();
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
      options.onDidChange?.();
    }
  };
}
