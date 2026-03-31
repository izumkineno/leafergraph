import {
  resolveDefaultLeaferGraphGraphConfig,
  type LeaferGraphGraphHistoryConfig
} from "@leafergraph/config/graph";
import type {
  GraphOperation,
  LeaferGraphHistoryEvent,
  LeaferGraphHistoryRecord
} from "@leafergraph/contracts";
import { createUndoRedoController } from "../core/controller";
import type { UndoRedoEntry } from "../core/types";
import type {
  BindLeaferGraphUndoRedoOptions,
  BoundLeaferGraphUndoRedo,
  LeaferGraphUndoRedoHost
} from "./types";

export function bindLeaferGraphUndoRedo(
  options: BindLeaferGraphUndoRedoOptions
): BoundLeaferGraphUndoRedo {
  const config = normalizeHistoryConfig(options.config);
  const controller = createUndoRedoController({
    maxEntries: config.maxEntries
  });
  let replaying = false;
  const unsubscribe = options.host.subscribeHistory((event) => {
    if (replaying) {
      return;
    }

    handleHistoryEvent(event, options.host, controller, config);
  });

  return {
    controller,
    config,
    destroy() {
      unsubscribe();
      controller.destroy();
    }
  };

  function withReplayGuard(callback: () => void): void {
    replaying = true;

    try {
      callback();
    } finally {
      replaying = false;
    }
  }

  function handleHistoryEvent(
    event: LeaferGraphHistoryEvent,
    host: LeaferGraphUndoRedoHost,
    controllerInstance: BoundLeaferGraphUndoRedo["controller"],
    historyConfig: BoundLeaferGraphUndoRedo["config"]
  ): void {
    if (event.type === "history.reset") {
      if (historyConfig.resetOnDocumentSync) {
        controllerInstance.clear();
      }
      return;
    }

    controllerInstance.push(createUndoRedoEntry(event.record, host, withReplayGuard));
  }
}

function createUndoRedoEntry(
  record: LeaferGraphHistoryRecord,
  host: LeaferGraphUndoRedoHost,
  withReplayGuard: (callback: () => void) => void
): UndoRedoEntry {
  return {
    id: record.recordId,
    label: record.label,
    undo() {
      withReplayGuard(() => {
        if (record.kind === "operation") {
          applyOperations(host, record.undoOperations);
          return;
        }

        host.replaceGraphDocument(record.beforeDocument);
      });
    },
    redo() {
      withReplayGuard(() => {
        if (record.kind === "operation") {
          applyOperations(host, record.redoOperations);
          return;
        }

        host.replaceGraphDocument(record.afterDocument);
      });
    }
  };
}

function applyOperations(
  host: LeaferGraphUndoRedoHost,
  operations: readonly GraphOperation[]
): void {
  for (const operation of operations) {
    const result = host.applyGraphOperation(operation);
    if (!result.accepted || !result.changed) {
      throw new Error(result.reason ?? `历史回放失败: ${operation.type}`);
    }
  }
}

function normalizeHistoryConfig(
  config?: LeaferGraphGraphHistoryConfig
): BoundLeaferGraphUndoRedo["config"] {
  const defaults = resolveDefaultLeaferGraphGraphConfig().history;

  return {
    maxEntries: Math.max(
      0,
      Math.floor(config?.maxEntries ?? defaults.maxEntries)
    ),
    resetOnDocumentSync:
      config?.resetOnDocumentSync ?? defaults.resetOnDocumentSync
  };
}
