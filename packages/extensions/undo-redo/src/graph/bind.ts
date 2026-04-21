import {
  resolveDefaultLeaferGraphGraphConfig,
  type LeaferGraphGraphHistoryConfig
} from "@leafergraph/core/config";
import type {
  GraphOperation,
  LeaferGraphHistoryEvent,
  LeaferGraphHistoryRecord
} from "@leafergraph/core/contracts";
import { createUndoRedoController } from "../core/controller";
import type { UndoRedoEntry } from "../core/types";
import type {
  BindLeaferGraphUndoRedoOptions,
  BoundLeaferGraphUndoRedo,
  LeaferGraphUndoRedoHost
} from "./types";

/**
 * 处理 `bindLeaferGraphUndoRedo` 相关逻辑。
 *
 * @param options - 可选配置项。
 * @returns 用于解除当前绑定的清理函数。
 */
export function bindLeaferGraphUndoRedo(
  options: BindLeaferGraphUndoRedoOptions
): BoundLeaferGraphUndoRedo {
  // 先准备宿主依赖、初始状态和需要挂载的资源。
  const config = normalizeHistoryConfig(options.config);
  const controller = createUndoRedoController({
    maxEntries: config.maxEntries
  });
  let replaying = false;
  // 再建立绑定与同步关系，让运行期交互能够稳定生效。
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

  /**
   * 处理 `withReplayGuard` 相关逻辑。
   *
   * @param callback - `callback`。
   * @returns 无返回值。
   */
  function withReplayGuard(callback: () => void): void {
    replaying = true;

    try {
      callback();
    } finally {
      replaying = false;
    }
  }

  /**
   * 处理历史事件。
   *
   * @param event - 当前事件对象。
   * @param host - 当前宿主实现。
   * @param controllerInstance - 控制器`Instance`。
   * @param historyConfig - 当前配置。
   * @returns 无返回值。
   */
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

/**
 * 处理 `createUndoRedoEntry` 相关逻辑。
 *
 * @param record - 记录。
 * @param host - 当前宿主实现。
 * @param withReplayGuard - `withReplayGuard` 参数。
 * @returns 创建后的结果对象。
 */
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

/**
 * 应用`Operations`。
 *
 * @param host - 当前宿主实现。
 * @param operations - `operations`。
 * @returns 无返回值。
 */
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

/**
 * 规范化历史配置。
 *
 * @param config - 当前配置。
 * @returns 处理后的结果。
 */
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
